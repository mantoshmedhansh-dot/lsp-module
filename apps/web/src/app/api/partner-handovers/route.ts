import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

/**
 * Partner Handover API
 *
 * Manages handover of shipments to partner networks for last-mile delivery
 * in areas where CJDarcl Quick doesn't have own fleet coverage
 */

// Generate handover number: HO + YYYYMMDD + Partner Code + Seq
function generateHandoverNumber(partnerCode: string): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HO${date}${partnerCode}${random}`;
}

// GET /api/partner-handovers - List handovers
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const partnerId = searchParams.get("partnerId");
    const hubId = searchParams.get("hubId");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) where.status = status;
    if (partnerId) where.partnerId = partnerId;
    if (hubId) where.handoverHubId = hubId;
    if (search) {
      where.handoverNumber = { contains: search };
    }

    const [handovers, total] = await Promise.all([
      prisma.partnerHandover.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.partnerHandover.count({ where }),
    ]);

    // Enrich with partner and hub details
    const partnerIds = [...new Set(handovers.map((h) => h.partnerId))];
    const hubIds = [...new Set(handovers.map((h) => h.handoverHubId))];

    const [partners, hubs] = await Promise.all([
      prisma.partner.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, code: true, name: true, displayName: true },
      }),
      prisma.hub.findMany({
        where: { id: { in: hubIds } },
        select: { id: true, code: true, name: true, city: true },
      }),
    ]);

    const partnerMap = new Map(partners.map((p) => [p.id, p]));
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    const enrichedHandovers = handovers.map((h) => ({
      ...h,
      partner: partnerMap.get(h.partnerId),
      handoverHub: hubMap.get(h.handoverHubId),
      shipmentIds: JSON.parse(h.shipmentIds || "[]"),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedHandovers,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching handovers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch handovers" },
      { status: 500 }
    );
  }
}

// POST /api/partner-handovers - Create a new handover
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { partnerId, handoverHubId, awbNumbers, handedOverBy, remarks } = body;

    // Validate partner
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: "Partner not found" },
        { status: 404 }
      );
    }

    // Validate hub
    const hub = await prisma.hub.findUnique({
      where: { id: handoverHubId },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Hub not found" },
        { status: 404 }
      );
    }

    if (!awbNumbers || awbNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No AWB numbers provided" },
        { status: 400 }
      );
    }

    // Find shipments
    const shipments = await prisma.shipment.findMany({
      where: {
        awbNumber: { in: awbNumbers },
        handedOverToPartner: false,
        fulfillmentMode: { in: ["PARTNER", "HYBRID"] },
      },
    });

    if (shipments.length === 0) {
      return NextResponse.json(
        { success: false, error: "No eligible shipments found for handover" },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalWeight = shipments.reduce(
      (sum, s) => sum + (s.chargeableWeightKg || 0),
      0
    );

    // Generate handover number
    const handoverNumber = generateHandoverNumber(partner.code);

    // Create handover record
    const handover = await prisma.partnerHandover.create({
      data: {
        handoverNumber,
        partnerId,
        handoverHubId,
        shipmentCount: shipments.length,
        totalWeightKg: totalWeight,
        shipmentIds: JSON.stringify(shipments.map((s) => s.id)),
        handedOverBy,
        remarks,
        status: "PENDING",
      },
    });

    // Update shipments
    const scanTime = new Date();
    for (const shipment of shipments) {
      // Update shipment status
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          handedOverToPartner: true,
          partnerId,
          partnerHandoverAt: scanTime,
          status: "WITH_PARTNER",
        },
      });

      // Create handover scan
      await prisma.shipmentScan.create({
        data: {
          shipmentId: shipment.id,
          scanType: "HANDOVER_SCAN",
          scanCode: shipment.awbNumber,
          hubId: handoverHubId,
          scannedBy: handedOverBy || "SYSTEM",
          scanTime,
          location: `${hub.name}, ${hub.city}`,
          remarks: `Handed over to ${partner.displayName || partner.name}`,
        },
      });

      // Create event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "HANDOVER",
          status: "WITH_PARTNER",
          statusText: `Handed over to partner: ${partner.displayName || partner.name}`,
          location: `${hub.name}, ${hub.city}`,
          hubId: handoverHubId,
          source: "PARTNER_HANDOVER",
          eventTime: scanTime,
          remarks: `Handover: ${handoverNumber}, Partner: ${partner.name}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        handover: {
          ...handover,
          partner: { code: partner.code, name: partner.name },
          hub: { code: hub.code, name: hub.name },
        },
        shipmentCount: shipments.length,
        awbNumbers: shipments.map((s) => s.awbNumber),
      },
    });
  } catch (error) {
    console.error("Error creating handover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create handover" },
      { status: 500 }
    );
  }
}
