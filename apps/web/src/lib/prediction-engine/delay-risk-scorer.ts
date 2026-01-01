import { prisma } from "@cjdquick/database";

export interface RiskFactor {
  factor: string;
  impact: number; // minutes added to delay
  weight: number; // importance 0-1
  description: string;
}

export interface DelayRiskResult {
  riskScore: number; // 0-100
  delayRisk: "LOW" | "MEDIUM" | "HIGH";
  factors: RiskFactor[];
  predictedDelayMinutes: number;
}

export interface TransitTimeData {
  avgTransitMinutes: number;
  stdDevMinutes: number;
  percentile90: number;
  onTimePercentage: number;
  sampleCount: number;
}

interface ShipmentInput {
  id: string;
  status: string;
  currentHubId: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  fulfillmentMode: string;
}

/**
 * Calculate delay risk score for a shipment
 */
export async function calculateDelayRisk(
  shipment: ShipmentInput,
  transitTimeData: TransitTimeData
): Promise<DelayRiskResult> {
  let riskScore = 0;
  const factors: RiskFactor[] = [];
  const now = new Date();

  // 1. Current delay status (0-30 points)
  const currentDelay = calculateCurrentDelay(shipment, now);
  if (currentDelay > 0) {
    const delayPoints = Math.min(30, (currentDelay / 60) * 10); // 10 points per hour, max 30
    riskScore += delayPoints;
    factors.push({
      factor: "CURRENT_DELAY",
      impact: currentDelay,
      weight: 0.3,
      description: `Currently ${Math.round(currentDelay / 60)} hours behind schedule`,
    });
  }

  // 2. Hub congestion (0-20 points)
  if (shipment.currentHubId) {
    const congestionResult = await getHubCongestionScore(shipment.currentHubId);
    if (congestionResult.utilizationPercent > 70) {
      const congestionPoints =
        ((congestionResult.utilizationPercent - 70) / 30) * 20;
      riskScore += congestionPoints;

      const estimatedCongestionDelay = Math.round(
        (congestionResult.utilizationPercent - 70) * 2
      ); // ~2 min per % over 70

      factors.push({
        factor: "HUB_CONGESTION",
        impact: estimatedCongestionDelay,
        weight: 0.2,
        description: `Hub at ${Math.round(congestionResult.utilizationPercent)}% capacity`,
      });
    }
  }

  // 3. Route historical performance (0-25 points)
  if (transitTimeData.onTimePercentage < 80 && transitTimeData.sampleCount > 5) {
    const routePoints = ((80 - transitTimeData.onTimePercentage) / 80) * 25;
    riskScore += routePoints;

    const avgDelayFromHistory = Math.max(
      0,
      transitTimeData.avgTransitMinutes - (transitTimeData.avgTransitMinutes * 0.8)
    );

    factors.push({
      factor: "ROUTE_PERFORMANCE",
      impact: Math.round(avgDelayFromHistory),
      weight: 0.25,
      description: `Route has ${Math.round(transitTimeData.onTimePercentage)}% on-time rate`,
    });
  }

  // 4. Journey complexity - estimate based on fulfillment mode (0-15 points)
  const remainingLegs = estimateRemainingLegs(shipment);
  if (remainingLegs > 2) {
    const legPoints = Math.min(15, remainingLegs * 5);
    riskScore += legPoints;
    factors.push({
      factor: "JOURNEY_COMPLEXITY",
      impact: remainingLegs * 30, // 30 min per leg potential delay
      weight: 0.15,
      description: `Estimated ${remainingLegs} legs remaining`,
    });
  }

  // 5. Time factors (0-10 points)
  const timeRisk = calculateTimeRisk(shipment.expectedDeliveryDate, now);
  if (timeRisk.points > 0) {
    riskScore += timeRisk.points;
    factors.push(timeRisk.factor);
  }

  // 6. Partner mode risk (0-10 points)
  if (shipment.fulfillmentMode === "PARTNER" || shipment.fulfillmentMode === "HYBRID") {
    const partnerPoints = shipment.fulfillmentMode === "PARTNER" ? 10 : 5;
    riskScore += partnerPoints;
    factors.push({
      factor: "PARTNER_DEPENDENCY",
      impact: shipment.fulfillmentMode === "PARTNER" ? 60 : 30, // 1 hour or 30 min buffer
      weight: 0.1,
      description: `${shipment.fulfillmentMode === "PARTNER" ? "Full partner" : "Hybrid"} fulfillment has variable SLA`,
    });
  }

  // Ensure score is within bounds
  riskScore = Math.min(100, Math.max(0, riskScore));

  // Determine risk level
  const delayRisk: "LOW" | "MEDIUM" | "HIGH" =
    riskScore >= 60 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

  // Calculate total predicted delay from factors
  const predictedDelayMinutes = factors.reduce((sum, f) => sum + f.impact, 0);

  return {
    riskScore: Math.round(riskScore),
    delayRisk,
    factors,
    predictedDelayMinutes: Math.round(predictedDelayMinutes),
  };
}

/**
 * Calculate current delay in minutes
 */
function calculateCurrentDelay(shipment: ShipmentInput, now: Date): number {
  if (!shipment.expectedDeliveryDate) return 0;

  // Calculate expected progress based on status
  const statusProgress: Record<string, number> = {
    BOOKED: 0,
    PICKUP_SCHEDULED: 0.05,
    PICKED_UP: 0.15,
    RECEIVED_AT_ORIGIN_HUB: 0.25,
    IN_SORTING: 0.3,
    SORTED: 0.35,
    CONSOLIDATED: 0.4,
    LOADED: 0.45,
    IN_TRANSIT: 0.6,
    ARRIVED_AT_HUB: 0.7,
    IN_HUB: 0.7,
    UNLOADED: 0.75,
    HANDED_TO_PARTNER: 0.8,
    WITH_PARTNER: 0.8,
    PARTNER_IN_TRANSIT: 0.85,
    OUT_FOR_DELIVERY: 0.95,
  };

  const expectedProgress = statusProgress[shipment.status] || 0;
  const createdAt = new Date(shipment.createdAt);
  const expectedDate = new Date(shipment.expectedDeliveryDate);

  // Total journey time in minutes
  const totalJourneyMinutes = (expectedDate.getTime() - createdAt.getTime()) / (1000 * 60);

  // How much time should have elapsed for current progress
  const expectedElapsedMinutes = totalJourneyMinutes * expectedProgress;

  // Actual elapsed time
  const actualElapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  // Delay = actual - expected (positive means behind schedule)
  const delayMinutes = actualElapsedMinutes - expectedElapsedMinutes;

  return Math.max(0, delayMinutes);
}

/**
 * Get hub congestion metrics
 */
async function getHubCongestionScore(
  hubId: string
): Promise<{ utilizationPercent: number; shipmentsInHub: number }> {
  // Get hub capacity
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
    select: { sortingCapacity: true },
  });

  if (!hub) {
    return { utilizationPercent: 0, shipmentsInHub: 0 };
  }

  // Count shipments currently in this hub
  const shipmentsInHub = await prisma.shipment.count({
    where: {
      currentHubId: hubId,
      status: {
        in: ["IN_HUB", "RECEIVED_AT_ORIGIN_HUB", "IN_SORTING", "SORTED", "CONSOLIDATED"],
      },
    },
  });

  const capacity = hub.sortingCapacity || 500;
  const utilizationPercent = Math.min(100, (shipmentsInHub / capacity) * 100);

  return { utilizationPercent, shipmentsInHub };
}

/**
 * Estimate remaining journey legs based on status and mode
 */
function estimateRemainingLegs(shipment: ShipmentInput): number {
  const statusToLegsRemaining: Record<string, number> = {
    BOOKED: 4,
    PICKUP_SCHEDULED: 4,
    PICKED_UP: 3,
    RECEIVED_AT_ORIGIN_HUB: 3,
    IN_SORTING: 3,
    SORTED: 2,
    CONSOLIDATED: 2,
    LOADED: 2,
    IN_TRANSIT: 2,
    ARRIVED_AT_HUB: 1,
    IN_HUB: 1,
    UNLOADED: 1,
    HANDED_TO_PARTNER: 1,
    WITH_PARTNER: 1,
    PARTNER_IN_TRANSIT: 1,
    OUT_FOR_DELIVERY: 0,
  };

  return statusToLegsRemaining[shipment.status] || 2;
}

/**
 * Calculate time-based risk factors
 */
function calculateTimeRisk(
  expectedDate: Date | null,
  now: Date
): { points: number; factor: RiskFactor } {
  const defaultFactor: RiskFactor = {
    factor: "TIME_RISK",
    impact: 0,
    weight: 0.1,
    description: "No time-based risk detected",
  };

  if (!expectedDate) {
    return { points: 0, factor: defaultFactor };
  }

  const hoursUntilExpected =
    (expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const dayOfWeek = now.getDay();
  const hourOfDay = now.getHours();

  let points = 0;
  let description = "";
  let impact = 0;

  // Weekend risk (Saturday = 6, Sunday = 0)
  if (dayOfWeek === 0) {
    points += 5;
    impact += 60; // 1 hour
    description = "Sunday - reduced operations";
  }

  // Peak hours risk (9-11 AM and 4-7 PM are peak)
  const isPeakHour = (hourOfDay >= 9 && hourOfDay <= 11) || (hourOfDay >= 16 && hourOfDay <= 19);
  if (isPeakHour && hoursUntilExpected < 24) {
    points += 3;
    impact += 30;
    description += description ? "; Peak delivery hours" : "Peak delivery hours";
  }

  // End of day risk (after 6 PM with delivery expected today)
  if (hourOfDay >= 18 && hoursUntilExpected < 6) {
    points += 5;
    impact += 60;
    description += description ? "; Late day delivery" : "Late day delivery";
  }

  // Tight deadline (less than 4 hours remaining)
  if (hoursUntilExpected > 0 && hoursUntilExpected < 4) {
    points += 7;
    impact += 45;
    description += description ? "; Tight deadline" : "Tight deadline";
  }

  return {
    points: Math.min(10, points),
    factor: {
      factor: "TIME_RISK",
      impact,
      weight: 0.1,
      description: description || "No time-based risk detected",
    },
  };
}
