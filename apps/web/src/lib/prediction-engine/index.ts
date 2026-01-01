import { prisma } from "@cjdquick/database";
import { calculateDelayRisk, RiskFactor } from "./delay-risk-scorer";
import { calculateTransitTime } from "./transit-time-calculator";
export {
  createAlert,
  runAlertGenerators,
  generateSLABreachAlerts,
  generateHubCongestionAlerts,
  generateStuckShipmentAlerts,
  cleanupExpiredAlerts,
} from "./alert-generator";

export interface ETAPrediction {
  shipmentId: string;
  awbNumber: string;

  // Predictions
  predictedDeliveryTime: Date;
  originalExpectedTime: Date | null;
  delayMinutes: number;

  // Risk Assessment
  delayRisk: "LOW" | "MEDIUM" | "HIGH";
  riskScore: number; // 0-100

  // Confidence
  confidenceLow: Date;
  confidenceHigh: Date;
  confidencePercent: number;

  // Contributing Factors
  factors: RiskFactor[];

  // Metadata
  calculatedAt: Date;
}

export interface ShipmentForPrediction {
  id: string;
  awbNumber: string;
  status: string;
  currentHubId: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  shipperPincode: string;
  consigneePincode: string;
  fulfillmentMode: string;
}

/**
 * Generate ETA prediction for a single shipment
 */
export async function generatePrediction(
  shipment: ShipmentForPrediction
): Promise<ETAPrediction> {
  const now = new Date();

  // Get historical transit time for this route
  const transitTimeData = await calculateTransitTime(
    shipment.shipperPincode,
    shipment.consigneePincode
  );

  // Calculate delay risk factors
  const riskResult = await calculateDelayRisk(shipment, transitTimeData);

  // Base expected time (from shipment or calculated)
  const baseExpectedTime = shipment.expectedDeliveryDate || new Date(
    now.getTime() + (transitTimeData.avgTransitMinutes || 72 * 60) * 60 * 1000
  );

  // Apply delay to get predicted time
  const predictedDeliveryTime = new Date(
    baseExpectedTime.getTime() + riskResult.predictedDelayMinutes * 60 * 1000
  );

  // Calculate confidence interval (using standard deviation from historical data)
  const stdDevMinutes = transitTimeData.stdDevMinutes || 120; // Default 2 hours
  const confidenceLow = new Date(
    predictedDeliveryTime.getTime() - stdDevMinutes * 60 * 1000
  );
  const confidenceHigh = new Date(
    predictedDeliveryTime.getTime() + stdDevMinutes * 60 * 1000
  );

  // Delay in minutes from expected
  const delayMinutes = Math.max(
    0,
    Math.round((predictedDeliveryTime.getTime() - (baseExpectedTime?.getTime() || now.getTime())) / (1000 * 60))
  );

  return {
    shipmentId: shipment.id,
    awbNumber: shipment.awbNumber,
    predictedDeliveryTime,
    originalExpectedTime: shipment.expectedDeliveryDate,
    delayMinutes,
    delayRisk: riskResult.delayRisk,
    riskScore: riskResult.riskScore,
    confidenceLow,
    confidenceHigh,
    confidencePercent: 80, // 80% confidence interval
    factors: riskResult.factors,
    calculatedAt: now,
  };
}

/**
 * Generate predictions for multiple shipments
 */
export async function generateBatchPredictions(
  shipmentIds?: string[],
  options?: {
    status?: string[];
    riskLevel?: ("LOW" | "MEDIUM" | "HIGH")[];
    limit?: number;
    offset?: number;
  }
): Promise<{
  predictions: ETAPrediction[];
  summary: {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    avgDelayMinutes: number;
  };
}> {
  // Fetch shipments
  const whereClause: any = {
    status: {
      notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"],
    },
  };

  if (shipmentIds && shipmentIds.length > 0) {
    whereClause.id = { in: shipmentIds };
  }

  if (options?.status && options.status.length > 0) {
    whereClause.status = { in: options.status };
  }

  const shipments = await prisma.shipment.findMany({
    where: whereClause,
    select: {
      id: true,
      awbNumber: true,
      status: true,
      currentHubId: true,
      expectedDeliveryDate: true,
      createdAt: true,
      shipperPincode: true,
      consigneePincode: true,
      fulfillmentMode: true,
    },
    take: options?.limit || 100,
    skip: options?.offset || 0,
    orderBy: { expectedDeliveryDate: "asc" },
  });

  // Generate predictions for each shipment
  const predictions: ETAPrediction[] = [];

  for (const shipment of shipments) {
    try {
      const prediction = await generatePrediction(shipment as ShipmentForPrediction);
      predictions.push(prediction);
    } catch (error) {
      console.error(`Failed to generate prediction for ${shipment.awbNumber}:`, error);
    }
  }

  // Filter by risk level if specified
  let filteredPredictions = predictions;
  if (options?.riskLevel && options.riskLevel.length > 0) {
    filteredPredictions = predictions.filter((p) =>
      options.riskLevel!.includes(p.delayRisk)
    );
  }

  // Sort by risk score (highest first)
  filteredPredictions.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate summary
  const highRiskCount = predictions.filter((p) => p.delayRisk === "HIGH").length;
  const mediumRiskCount = predictions.filter((p) => p.delayRisk === "MEDIUM").length;
  const lowRiskCount = predictions.filter((p) => p.delayRisk === "LOW").length;
  const avgDelayMinutes =
    predictions.length > 0
      ? Math.round(
          predictions.reduce((sum, p) => sum + p.delayMinutes, 0) /
            predictions.length
        )
      : 0;

  return {
    predictions: filteredPredictions,
    summary: {
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      avgDelayMinutes,
    },
  };
}

/**
 * Store prediction in database
 */
export async function storePrediction(prediction: ETAPrediction): Promise<void> {
  // Deactivate previous predictions for this shipment
  await prisma.eTAPrediction.updateMany({
    where: {
      shipmentId: prediction.shipmentId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Create new prediction
  await prisma.eTAPrediction.create({
    data: {
      shipmentId: prediction.shipmentId,
      predictedDeliveryTime: prediction.predictedDeliveryTime,
      delayMinutes: prediction.delayMinutes,
      riskScore: prediction.riskScore,
      delayRisk: prediction.delayRisk,
      confidenceLow: prediction.confidenceLow,
      confidenceHigh: prediction.confidenceHigh,
      confidencePercent: prediction.confidencePercent,
      factors: JSON.stringify(prediction.factors),
      calculatedAt: prediction.calculatedAt,
      isActive: true,
    },
  });
}
