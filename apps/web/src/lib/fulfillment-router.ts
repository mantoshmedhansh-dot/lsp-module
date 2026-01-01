import { prisma } from "@cjdquick/database";

/**
 * Fulfillment Router
 *
 * Determines the best fulfillment strategy for a shipment:
 * - OWN_FLEET: Full journey on our network
 * - PARTNER: Hand over to partner at first mile
 * - HYBRID: First mile + line haul on our network, last mile via partner
 */

export type FulfillmentMode = "OWN_FLEET" | "PARTNER" | "HYBRID";

export interface FulfillmentDecision {
  mode: FulfillmentMode;
  originHubId: string | null;
  destinationHubId: string | null;
  partnerId: string | null;
  partnerHandoverHubId: string | null;
  estimatedTransitDays: number;
  legs: JourneyLeg[];
  reason: string;
}

export interface JourneyLeg {
  legIndex: number;
  legType: "FIRST_MILE" | "LINE_HAUL" | "TRANSSHIPMENT" | "LAST_MILE";
  fromHubId: string | null;
  toHubId: string | null;
  fromLocation: string;
  toLocation: string;
  mode: "OWN_FLEET" | "PARTNER";
  partnerId: string | null;
  estimatedDays: number;
}

/**
 * Find nearest hub for a pincode
 */
export async function findNearestHub(
  pincode: string,
  type: "PICKUP" | "DELIVERY" | "BOTH"
): Promise<{ hub: any; mapping: any } | null> {
  const mappings = await prisma.hubPincodeMapping.findMany({
    where: {
      pincode,
      OR: [{ type }, { type: "BOTH" }],
      hub: { isActive: true },
    },
    include: { hub: true },
    orderBy: { priority: "asc" },
    take: 1,
  });

  if (mappings.length === 0) return null;
  return { hub: mappings[0].hub, mapping: mappings[0] };
}

/**
 * Check if a pincode is in a low-volume/partner zone
 */
export async function getPartnerZone(pincode: string): Promise<{
  partnerId: string;
  handoverHubId: string;
  estimatedTatDays: number;
  baseRate: number;
  ratePerKg: number;
} | null> {
  const zones = await prisma.partnerZoneMapping.findMany({
    where: {
      isActive: true,
      pincodes: { contains: pincode },
    },
  });

  if (zones.length === 0) return null;

  // Return first matching zone
  const zone = zones[0];
  return {
    partnerId: zone.partnerId,
    handoverHubId: zone.handoverHubId,
    estimatedTatDays: zone.estimatedTatDays,
    baseRate: zone.baseRate,
    ratePerKg: zone.ratePerKg,
  };
}

/**
 * Determine fulfillment strategy for a shipment
 */
export async function determineFulfillment(
  originPincode: string,
  destinationPincode: string
): Promise<FulfillmentDecision> {
  const legs: JourneyLeg[] = [];
  let totalTransitDays = 0;

  // Find origin hub (for pickup)
  const originHub = await findNearestHub(originPincode, "PICKUP");

  // Find destination hub (for delivery)
  const destHub = await findNearestHub(destinationPincode, "DELIVERY");

  // Check if destination is in partner zone
  const partnerZone = await getPartnerZone(destinationPincode);

  // Case 1: Neither origin nor destination covered - Pure partner fulfillment
  if (!originHub) {
    return {
      mode: "PARTNER",
      originHubId: null,
      destinationHubId: null,
      partnerId: partnerZone?.partnerId || null,
      partnerHandoverHubId: null,
      estimatedTransitDays: partnerZone?.estimatedTatDays || 5,
      legs: [
        {
          legIndex: 0,
          legType: "FIRST_MILE",
          fromHubId: null,
          toHubId: null,
          fromLocation: originPincode,
          toLocation: destinationPincode,
          mode: "PARTNER",
          partnerId: partnerZone?.partnerId || null,
          estimatedDays: partnerZone?.estimatedTatDays || 5,
        },
      ],
      reason: "Origin pincode not covered by our hub network",
    };
  }

  // Case 2: Origin covered, destination in partner zone - HYBRID
  if (originHub && partnerZone && !destHub) {
    // First Mile: Pickup to Origin Hub (our fleet)
    legs.push({
      legIndex: 0,
      legType: "FIRST_MILE",
      fromHubId: null,
      toHubId: originHub.hub.id,
      fromLocation: originPincode,
      toLocation: `${originHub.hub.name}, ${originHub.hub.city}`,
      mode: "OWN_FLEET",
      partnerId: null,
      estimatedDays: 1,
    });
    totalTransitDays += 1;

    // Line Haul: Origin Hub to Partner Handover Hub (if different)
    if (originHub.hub.id !== partnerZone.handoverHubId) {
      const handoverHub = await prisma.hub.findUnique({
        where: { id: partnerZone.handoverHubId },
      });

      legs.push({
        legIndex: 1,
        legType: "LINE_HAUL",
        fromHubId: originHub.hub.id,
        toHubId: partnerZone.handoverHubId,
        fromLocation: `${originHub.hub.name}, ${originHub.hub.city}`,
        toLocation: handoverHub
          ? `${handoverHub.name}, ${handoverHub.city}`
          : "Handover Hub",
        mode: "OWN_FLEET",
        partnerId: null,
        estimatedDays: 1,
      });
      totalTransitDays += 1;
    }

    // Last Mile: Partner delivery
    legs.push({
      legIndex: legs.length,
      legType: "LAST_MILE",
      fromHubId: partnerZone.handoverHubId,
      toHubId: null,
      fromLocation: "Partner Handover Hub",
      toLocation: destinationPincode,
      mode: "PARTNER",
      partnerId: partnerZone.partnerId,
      estimatedDays: partnerZone.estimatedTatDays,
    });
    totalTransitDays += partnerZone.estimatedTatDays;

    return {
      mode: "HYBRID",
      originHubId: originHub.hub.id,
      destinationHubId: partnerZone.handoverHubId,
      partnerId: partnerZone.partnerId,
      partnerHandoverHubId: partnerZone.handoverHubId,
      estimatedTransitDays: totalTransitDays,
      legs,
      reason: "Destination in low-volume/partner zone. First mile + line haul via own fleet, last mile via partner.",
    };
  }

  // Case 3: Both origin and destination covered - Full OWN_FLEET
  if (originHub && destHub) {
    // First Mile: Pickup to Origin Hub
    legs.push({
      legIndex: 0,
      legType: "FIRST_MILE",
      fromHubId: null,
      toHubId: originHub.hub.id,
      fromLocation: originPincode,
      toLocation: `${originHub.hub.name}, ${originHub.hub.city}`,
      mode: "OWN_FLEET",
      partnerId: null,
      estimatedDays: 1,
    });
    totalTransitDays += 1;

    // Line Haul: Origin Hub to Destination Hub (if different)
    if (originHub.hub.id !== destHub.hub.id) {
      // Check for intermediate hubs (transshipment)
      // For now, direct line haul
      legs.push({
        legIndex: 1,
        legType: "LINE_HAUL",
        fromHubId: originHub.hub.id,
        toHubId: destHub.hub.id,
        fromLocation: `${originHub.hub.name}, ${originHub.hub.city}`,
        toLocation: `${destHub.hub.name}, ${destHub.hub.city}`,
        mode: "OWN_FLEET",
        partnerId: null,
        estimatedDays: 1,
      });
      totalTransitDays += 1;
    }

    // Last Mile: Destination Hub to Consignee
    legs.push({
      legIndex: legs.length,
      legType: "LAST_MILE",
      fromHubId: destHub.hub.id,
      toHubId: null,
      fromLocation: `${destHub.hub.name}, ${destHub.hub.city}`,
      toLocation: destinationPincode,
      mode: "OWN_FLEET",
      partnerId: null,
      estimatedDays: 1,
    });
    totalTransitDays += 1;

    return {
      mode: "OWN_FLEET",
      originHubId: originHub.hub.id,
      destinationHubId: destHub.hub.id,
      partnerId: null,
      partnerHandoverHubId: null,
      estimatedTransitDays: totalTransitDays,
      legs,
      reason: "Full journey covered by our hub network",
    };
  }

  // Fallback: Use partner
  return {
    mode: "PARTNER",
    originHubId: originHub?.hub.id || null,
    destinationHubId: null,
    partnerId: partnerZone?.partnerId || null,
    partnerHandoverHubId: partnerZone?.handoverHubId || null,
    estimatedTransitDays: 5,
    legs: [
      {
        legIndex: 0,
        legType: "FIRST_MILE",
        fromHubId: null,
        toHubId: null,
        fromLocation: originPincode,
        toLocation: destinationPincode,
        mode: "PARTNER",
        partnerId: partnerZone?.partnerId || null,
        estimatedDays: 5,
      },
    ],
    reason: "Destination not covered by our network, routing via partner",
  };
}

/**
 * Create journey plan for a shipment
 */
export async function createJourneyPlan(
  originPincode: string,
  destinationPincode: string
): Promise<{ journeyPlanId: string; decision: FulfillmentDecision }> {
  const decision = await determineFulfillment(originPincode, destinationPincode);

  // Calculate estimated delivery date
  const estimatedDeliveryDate = new Date();
  estimatedDeliveryDate.setDate(
    estimatedDeliveryDate.getDate() + decision.estimatedTransitDays
  );

  const journeyPlan = await prisma.journeyPlan.create({
    data: {
      originPincode,
      originHubId: decision.originHubId || "",
      destinationPincode,
      destinationHubId: decision.destinationHubId || decision.partnerHandoverHubId || "",
      totalLegs: decision.legs.length,
      estimatedTransitDays: decision.estimatedTransitDays,
      estimatedDeliveryDate,
      fulfillmentMode: decision.mode,
      partnerHandoverLeg: decision.mode === "HYBRID"
        ? decision.legs.findIndex((l) => l.mode === "PARTNER")
        : null,
      partnerId: decision.partnerId,
      legs: JSON.stringify(decision.legs),
    },
  });

  return { journeyPlanId: journeyPlan.id, decision };
}
