/**
 * AI/ML Types for OMS Intelligence Layer
 */

// =============================================================================
// ANOMALY DETECTION TYPES
// =============================================================================

export type AnomalyType =
  | 'ORDER_FRAUD'
  | 'ORDER_VELOCITY'
  | 'VALUE_ANOMALY'
  | 'ADDRESS_MISMATCH'
  | 'INVENTORY_DISCREPANCY'
  | 'PATTERN_DEVIATION'
  | 'RETURN_ABUSE'
  | 'COD_RISK';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AnomalyAction = 'APPROVE' | 'REVIEW' | 'HOLD' | 'BLOCK';

export interface AnomalyFactor {
  name: string;
  score: number;
  weight: number;
  details: string;
}

export interface AnomalyDetectionResult {
  entityType: 'ORDER' | 'CUSTOMER' | 'INVENTORY' | 'RETURN';
  entityId: string;
  overallScore: number;
  severity: AnomalySeverity;
  anomalyTypes: AnomalyType[];
  factors: AnomalyFactor[];
  recommendedAction: AnomalyAction;
  confidence: number;
  explanation: string;
  timestamp: Date;
}

export interface OrderRiskProfile {
  orderId: string;
  riskScore: number;
  severity: AnomalySeverity;
  factors: {
    velocityScore: number;
    valueScore: number;
    addressScore: number;
    customerHistoryScore: number;
    paymentRiskScore: number;
    patternScore: number;
  };
  flags: string[];
  action: AnomalyAction;
}

// =============================================================================
// DEMAND FORECASTING TYPES
// =============================================================================

export interface ForecastRequest {
  skuId?: string;
  skuIds?: string[];
  categoryId?: string;
  locationId?: string;
  channel?: string;
  horizonDays: number;
  granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  includeConfidenceInterval?: boolean;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface DemandForecast {
  skuId: string;
  skuCode: string;
  skuName: string;
  locationId?: string;
  channel?: string;
  horizon: number;
  generatedAt: Date;
  modelVersion: string;
  accuracy: number;
  forecasts: ForecastPoint[];
  seasonalFactors: {
    dayOfWeek: Record<string, number>;
    monthOfYear: Record<string, number>;
  };
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  trendStrength: number;
  recommendations: string[];
}

export interface InventoryRecommendation {
  skuId: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedReorderQty: number;
  daysOfCover: number;
  stockoutRisk: number;
  overstockRisk: number;
  action: 'REORDER_NOW' | 'REORDER_SOON' | 'ADEQUATE' | 'OVERSTOCK' | 'CRITICAL';
}

// =============================================================================
// CONTROL TOWER TYPES
// =============================================================================

export type PerformanceMetric = 'D0' | 'D1' | 'D2' | 'D3_PLUS';

export type SLAStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'CRITICAL';

export type AlertPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface SLAPrediction {
  orderId: string;
  orderNo: string;
  currentStatus: string;
  promisedDate: Date;
  predictedDeliveryDate: Date;
  predictedStatus: SLAStatus;
  breachProbability: number;
  delayMinutes: number;
  riskFactors: string[];
  suggestedActions: string[];
}

export interface DayPerformancePrediction {
  metric: PerformanceMetric;
  date: string;
  predictedOrders: number;
  predictedOnTime: number;
  predictedDelayed: number;
  predictedPercentage: number;
  targetPercentage: number;
  status: 'EXCEEDING' | 'ON_TARGET' | 'BELOW_TARGET' | 'CRITICAL';
  riskFactors: string[];
}

export interface CapacityPrediction {
  locationId: string;
  locationCode: string;
  locationName: string;
  date: string;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY';
  predictedOrderVolume: number;
  predictedUnits: number;
  currentCapacity: {
    picking: number;
    packing: number;
    shipping: number;
  };
  predictedUtilization: {
    picking: number;
    packing: number;
    shipping: number;
  };
  bottleneck: 'PICKING' | 'PACKING' | 'SHIPPING' | 'NONE';
  capacityStatus: 'UNDER_UTILIZED' | 'OPTIMAL' | 'STRETCHED' | 'OVERLOADED';
  recommendations: string[];
}

export interface ControlTowerAlert {
  id: string;
  type: string;
  priority: AlertPriority;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metrics: Record<string, number>;
  predictedImpact: string;
  suggestedActions: string[];
  autoResolvable: boolean;
  createdAt: Date;
  expiresAt?: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface ControlTowerSnapshot {
  timestamp: Date;

  // Real-time metrics
  activeOrders: number;
  ordersAtRisk: number;
  ordersBreached: number;

  // SLA predictions
  slaPredictions: {
    onTrack: number;
    atRisk: number;
    breached: number;
    critical: number;
  };

  // Day performance predictions
  dayPerformance: {
    d0: DayPerformancePrediction;
    d1: DayPerformancePrediction;
    d2: DayPerformancePrediction;
  };

  // Capacity status
  capacityStatus: {
    overall: 'GREEN' | 'YELLOW' | 'RED';
    locations: CapacityPrediction[];
  };

  // Active alerts
  alerts: {
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    total: number;
  };

  // Carrier performance
  carrierHealth: {
    carrierId: string;
    carrierName: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    avgDelay: number;
    ndrRate: number;
  }[];

  // Inventory health
  inventoryHealth: {
    stockoutRisk: number;
    lowStockSkus: number;
    criticalSkus: number;
  };
}

export interface PredictiveInsight {
  type: 'SLA_RISK' | 'CAPACITY_CONSTRAINT' | 'CARRIER_ISSUE' | 'INVENTORY_RISK' | 'DEMAND_SPIKE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  predictedImpact: {
    affectedOrders?: number;
    revenueAtRisk?: number;
    slaImpact?: number;
  };
  timeToImpact: number; // minutes
  confidence: number;
  recommendations: {
    action: string;
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
}
