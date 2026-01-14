/**
 * Predictive Control Tower Service
 *
 * Enables PROACTIVE operations vs REACTIVE by predicting:
 * - SLA adherence and breach risks
 * - D0/D1/D2 performance predictions
 * - Capacity constraints and load building
 * - Carrier health and issues
 * - Bottleneck identification
 *
 * The Control Tower provides a real-time command center view
 * with predictive alerts and recommended actions.
 */

import { prisma } from "@oms/database";
import {
  SLAPrediction,
  DayPerformancePrediction,
  CapacityPrediction,
  ControlTowerSnapshot,
  ControlTowerAlert,
  PredictiveInsight,
  SLAStatus,
  AlertPriority,
  PerformanceMetric,
} from '../types';
import { createDemandForecaster } from '../forecasting/demand-forecaster';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONTROL_TOWER_CONFIG = {
  // SLA thresholds
  SLA_AT_RISK_HOURS: 4,        // Orders with < 4 hours to SLA are "at risk"
  SLA_CRITICAL_HOURS: 2,       // Orders with < 2 hours are "critical"

  // Day performance targets
  D0_TARGET: 95,               // Same day dispatch target %
  D1_TARGET: 98,               // Next day delivery target %
  D2_TARGET: 99,               // 2-day delivery target %

  // Capacity thresholds
  CAPACITY_OPTIMAL_MIN: 60,    // Below 60% = under-utilized
  CAPACITY_OPTIMAL_MAX: 85,    // Above 85% = stretched
  CAPACITY_OVERLOAD: 95,       // Above 95% = overloaded

  // Picking capacity (orders per hour per picker)
  PICKING_RATE_PER_HOUR: 15,
  PACKING_RATE_PER_HOUR: 20,
  SHIPPING_RATE_PER_HOUR: 25,

  // Working hours
  SHIFT_HOURS: 8,
  WORKING_HOURS_START: 9,
  WORKING_HOURS_END: 21,

  // Alert thresholds
  ALERT_BATCH_SIZE: 100,
};

// =============================================================================
// CONTROL TOWER SERVICE CLASS
// =============================================================================

export class ControlTowerService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Get complete Control Tower snapshot
   */
  async getSnapshot(): Promise<ControlTowerSnapshot> {
    const [
      orderMetrics,
      slaPredictions,
      dayPerformance,
      capacityStatus,
      alerts,
      carrierHealth,
      inventoryHealth,
    ] = await Promise.all([
      this.getOrderMetrics(),
      this.getSLAPredictionSummary(),
      this.getDayPerformancePredictions(),
      this.getCapacityStatus(),
      this.getAlertCounts(),
      this.getCarrierHealth(),
      this.getInventoryHealth(),
    ]);

    return {
      timestamp: new Date(),
      ...orderMetrics,
      slaPredictions,
      dayPerformance,
      capacityStatus,
      alerts,
      carrierHealth,
      inventoryHealth,
    };
  }

  // =============================================================================
  // SLA PREDICTION
  // =============================================================================

  /**
   * Predict SLA status for active orders
   */
  async predictSLAForOrders(limit: number = 100): Promise<SLAPrediction[]> {
    const activeOrders = await prisma.order.findMany({
      where: {
        status: {
          in: ['CREATED', 'CONFIRMED', 'ALLOCATED', 'PICKLIST_GENERATED', 'PICKING', 'PICKED', 'PACKING', 'PACKED'],
        },
      },
      include: {
        deliveries: {
          include: { transporter: true },
          take: 1,
        },
        location: true,
      },
      orderBy: { promisedDate: 'asc' },
      take: limit,
    });

    const predictions: SLAPrediction[] = [];

    for (const order of activeOrders) {
      const prediction = await this.predictOrderSLA(order);
      predictions.push(prediction);
    }

    // Sort by breach probability (highest risk first)
    return predictions.sort((a, b) => b.breachProbability - a.breachProbability);
  }

  /**
   * Predict SLA for a single order
   */
  private async predictOrderSLA(order: any): Promise<SLAPrediction> {
    const now = new Date();
    const promisedDate = order.promisedDate || new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Calculate remaining time
    const remainingMs = promisedDate.getTime() - now.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);

    // Estimate remaining processing time based on status
    const estimatedProcessingHours = this.estimateRemainingProcessingTime(order.status);

    // Calculate predicted delivery time
    const transitHours = this.estimateTransitTime(order);
    const totalRemainingHours = estimatedProcessingHours + transitHours;

    // Calculate delay
    const delayMinutes = Math.max(0, (totalRemainingHours - remainingHours) * 60);

    // Calculate breach probability
    const breachProbability = this.calculateBreachProbability(
      remainingHours,
      totalRemainingHours,
      order.status
    );

    // Determine SLA status
    let predictedStatus: SLAStatus = 'ON_TRACK';
    if (breachProbability >= 0.9) predictedStatus = 'BREACHED';
    else if (breachProbability >= 0.7) predictedStatus = 'CRITICAL';
    else if (breachProbability >= 0.4) predictedStatus = 'AT_RISK';

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(order, remainingHours, totalRemainingHours);

    // Generate suggested actions
    const suggestedActions = this.generateSLAActions(predictedStatus, order, riskFactors);

    // Calculate predicted delivery date
    const predictedDeliveryDate = new Date(now.getTime() + totalRemainingHours * 60 * 60 * 1000);

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      currentStatus: order.status,
      promisedDate,
      predictedDeliveryDate,
      predictedStatus,
      breachProbability,
      delayMinutes: Math.round(delayMinutes),
      riskFactors,
      suggestedActions,
    };
  }

  private estimateRemainingProcessingTime(status: string): number {
    const processingTimes: Record<string, number> = {
      'CREATED': 6,
      'CONFIRMED': 5,
      'ALLOCATED': 4,
      'PICKLIST_GENERATED': 3,
      'PICKING': 2,
      'PICKED': 1.5,
      'PACKING': 1,
      'PACKED': 0.5,
      'MANIFESTED': 0,
    };
    return processingTimes[status] || 4;
  }

  private estimateTransitTime(order: any): number {
    // Default transit time based on zone
    const shippingAddress = order.shippingAddress as Record<string, string>;
    const pincode = shippingAddress?.pincode || '000000';
    const prefix = pincode.substring(0, 3);

    // Metro pincodes get faster delivery
    const metroPrefixes = ['110', '400', '560', '600', '700', '500'];
    if (metroPrefixes.includes(prefix)) {
      return 24; // 24 hours for metro
    }

    // Check transporter if assigned
    const delivery = order.deliveries?.[0];
    if (delivery?.transporter) {
      // Could lookup historical data here
      return 36; // Default 36 hours
    }

    return 48; // Default 48 hours
  }

  private calculateBreachProbability(
    remainingHours: number,
    requiredHours: number,
    status: string
  ): number {
    // Base probability from time ratio
    const timeRatio = requiredHours / Math.max(remainingHours, 0.1);

    let probability = 0;

    if (remainingHours <= 0) {
      probability = 1.0; // Already past promised date
    } else if (timeRatio >= 1.5) {
      probability = 0.95;
    } else if (timeRatio >= 1.2) {
      probability = 0.7;
    } else if (timeRatio >= 1.0) {
      probability = 0.5;
    } else if (timeRatio >= 0.8) {
      probability = 0.3;
    } else {
      probability = 0.1;
    }

    // Adjust for status (earlier stages have more uncertainty)
    const statusMultiplier: Record<string, number> = {
      'CREATED': 1.2,
      'CONFIRMED': 1.1,
      'ALLOCATED': 1.0,
      'PICKLIST_GENERATED': 0.95,
      'PICKING': 0.9,
      'PICKED': 0.85,
      'PACKING': 0.8,
      'PACKED': 0.7,
    };

    return Math.min(1, probability * (statusMultiplier[status] || 1));
  }

  private identifyRiskFactors(
    order: any,
    remainingHours: number,
    requiredHours: number
  ): string[] {
    const factors: string[] = [];

    if (remainingHours < CONTROL_TOWER_CONFIG.SLA_CRITICAL_HOURS) {
      factors.push('Critical time remaining');
    } else if (remainingHours < CONTROL_TOWER_CONFIG.SLA_AT_RISK_HOURS) {
      factors.push('Limited time buffer');
    }

    if (requiredHours > remainingHours) {
      factors.push('Processing time exceeds available time');
    }

    if (!order.deliveries?.[0]?.transporterId) {
      factors.push('No carrier assigned');
    }

    if (order.status === 'CREATED' && remainingHours < 12) {
      factors.push('Order not yet confirmed');
    }

    if (order.paymentMode === 'COD') {
      factors.push('COD order - higher NDR risk');
    }

    return factors;
  }

  private generateSLAActions(
    status: SLAStatus,
    order: any,
    riskFactors: string[]
  ): string[] {
    const actions: string[] = [];

    if (status === 'BREACHED' || status === 'CRITICAL') {
      actions.push('Escalate to supervisor immediately');
      actions.push('Consider expedited shipping');

      if (!order.deliveries?.[0]?.transporterId) {
        actions.push('Assign fastest available carrier');
      }
    }

    if (status === 'AT_RISK') {
      actions.push('Prioritize in picking queue');
      actions.push('Proactive customer communication');
    }

    if (riskFactors.includes('No carrier assigned')) {
      actions.push('Assign carrier immediately');
    }

    if (order.status === 'CREATED') {
      actions.push('Fast-track order confirmation');
    }

    return actions;
  }

  // =============================================================================
  // DAY PERFORMANCE PREDICTION (D0/D1/D2)
  // =============================================================================

  /**
   * Predict D0/D1/D2 performance for today
   */
  async getDayPerformancePredictions(): Promise<{
    d0: DayPerformancePrediction;
    d1: DayPerformancePrediction;
    d2: DayPerformancePrediction;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const [d0, d1, d2] = await Promise.all([
      this.predictDayPerformance('D0', today),
      this.predictDayPerformance('D1', tomorrow),
      this.predictDayPerformance('D2', dayAfter),
    ]);

    return { d0, d1, d2 };
  }

  /**
   * Predict performance for a specific day metric
   */
  private async predictDayPerformance(
    metric: PerformanceMetric,
    targetDate: Date
  ): Promise<DayPerformancePrediction> {
    const now = new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get orders that need to be fulfilled by this date
    const ordersForDate = await this.getOrdersForDate(metric, targetDate);

    // Analyze current status of these orders
    const statusBreakdown = this.analyzeOrderStatuses(ordersForDate);

    // Predict on-time vs delayed
    const predictions = await this.predictCompletionRates(ordersForDate, targetDate);

    // Get target percentage
    const targets: Record<string, number> = {
      'D0': CONTROL_TOWER_CONFIG.D0_TARGET,
      'D1': CONTROL_TOWER_CONFIG.D1_TARGET,
      'D2': CONTROL_TOWER_CONFIG.D2_TARGET,
      'D3_PLUS': 99,
    };
    const targetPercentage = targets[metric];

    // Determine status
    let status: DayPerformancePrediction['status'] = 'ON_TARGET';
    if (predictions.onTimePercentage >= targetPercentage + 2) {
      status = 'EXCEEDING';
    } else if (predictions.onTimePercentage < targetPercentage - 5) {
      status = 'CRITICAL';
    } else if (predictions.onTimePercentage < targetPercentage) {
      status = 'BELOW_TARGET';
    }

    // Identify risk factors
    const riskFactors = this.identifyDayRiskFactors(
      metric,
      predictions,
      statusBreakdown,
      targetPercentage
    );

    return {
      metric,
      date: dateStr,
      predictedOrders: predictions.totalOrders,
      predictedOnTime: predictions.onTimeOrders,
      predictedDelayed: predictions.delayedOrders,
      predictedPercentage: predictions.onTimePercentage,
      targetPercentage,
      status,
      riskFactors,
    };
  }

  private async getOrdersForDate(metric: PerformanceMetric, targetDate: Date): Promise<any[]> {
    const dateStart = new Date(targetDate);
    dateStart.setHours(0, 0, 0, 0);

    const dateEnd = new Date(targetDate);
    dateEnd.setHours(23, 59, 59, 999);

    // D0 = orders that should ship today (same day dispatch)
    // D1 = orders that should be delivered tomorrow
    // D2 = orders that should be delivered in 2 days

    if (metric === 'D0') {
      // Orders that need to be dispatched today
      return prisma.order.findMany({
        where: {
          status: { in: ['CREATED', 'CONFIRMED', 'ALLOCATED', 'PICKLIST_GENERATED', 'PICKING', 'PICKED', 'PACKING', 'PACKED'] },
          orderDate: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
        include: { deliveries: true },
      });
    }

    // For D1/D2, look at promised delivery date
    return prisma.order.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'CANCELLED', 'RTO_DELIVERED'] },
        promisedDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      include: { deliveries: true },
    });
  }

  private analyzeOrderStatuses(orders: any[]): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const order of orders) {
      const status = order.status;
      breakdown[status] = (breakdown[status] || 0) + 1;
    }

    return breakdown;
  }

  private async predictCompletionRates(orders: any[], targetDate: Date): Promise<{
    totalOrders: number;
    onTimeOrders: number;
    delayedOrders: number;
    onTimePercentage: number;
  }> {
    const totalOrders = orders.length;
    if (totalOrders === 0) {
      return { totalOrders: 0, onTimeOrders: 0, delayedOrders: 0, onTimePercentage: 100 };
    }

    let onTimeOrders = 0;
    const now = new Date();
    const hoursToTarget = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    for (const order of orders) {
      const remainingHours = this.estimateRemainingProcessingTime(order.status);

      // Add buffer for transit if not yet shipped
      const totalRequired = remainingHours + (order.status !== 'SHIPPED' ? 2 : 0);

      if (totalRequired <= hoursToTarget || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
        onTimeOrders++;
      }
    }

    const delayedOrders = totalOrders - onTimeOrders;
    const onTimePercentage = Math.round((onTimeOrders / totalOrders) * 100);

    return { totalOrders, onTimeOrders, delayedOrders, onTimePercentage };
  }

  private identifyDayRiskFactors(
    metric: PerformanceMetric,
    predictions: { onTimePercentage: number; delayedOrders: number },
    statusBreakdown: Record<string, number>,
    targetPercentage: number
  ): string[] {
    const factors: string[] = [];

    if (predictions.onTimePercentage < targetPercentage) {
      factors.push(`${predictions.delayedOrders} orders at risk of missing ${metric} target`);
    }

    const unprocessed = (statusBreakdown['CREATED'] || 0) + (statusBreakdown['CONFIRMED'] || 0);
    if (unprocessed > 0) {
      factors.push(`${unprocessed} orders not yet in processing`);
    }

    const inPicking = statusBreakdown['PICKING'] || 0;
    if (inPicking > 20) {
      factors.push(`${inPicking} orders stuck in picking`);
    }

    return factors;
  }

  // =============================================================================
  // CAPACITY PREDICTION
  // =============================================================================

  /**
   * Predict capacity constraints across locations
   */
  async getCapacityStatus(): Promise<{
    overall: 'GREEN' | 'YELLOW' | 'RED';
    locations: CapacityPrediction[];
  }> {
    const locations = await prisma.location.findMany({
      where: { isActive: true, type: 'WAREHOUSE' },
      select: { id: true, code: true, name: true },
    });

    const predictions: CapacityPrediction[] = [];

    for (const location of locations) {
      const prediction = await this.predictLocationCapacity(location);
      predictions.push(prediction);
    }

    // Determine overall status
    const hasOverloaded = predictions.some(p => p.capacityStatus === 'OVERLOADED');
    const hasStretched = predictions.some(p => p.capacityStatus === 'STRETCHED');

    let overall: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (hasOverloaded) overall = 'RED';
    else if (hasStretched) overall = 'YELLOW';

    return { overall, locations: predictions };
  }

  /**
   * Predict capacity for a single location
   */
  private async predictLocationCapacity(
    location: { id: string; code: string; name: string }
  ): Promise<CapacityPrediction> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Get pending orders for this location
    const pendingOrders = await prisma.order.count({
      where: {
        locationId: location.id,
        status: {
          in: ['CONFIRMED', 'ALLOCATED', 'PICKLIST_GENERATED', 'PICKING', 'PICKED', 'PACKING', 'PACKED'],
        },
      },
    });

    // Get predicted new orders (from demand forecaster)
    const forecaster = createDemandForecaster(this.companyId);
    const avgDailyOrders = await this.getAverageDailyOrders(location.id);

    const predictedOrderVolume = pendingOrders + Math.round(avgDailyOrders * 0.5); // Half day remaining

    // Calculate predicted units (assuming avg 2 items per order)
    const predictedUnits = predictedOrderVolume * 2;

    // Get staff capacity (assuming standard staffing)
    const pickers = 5;
    const packers = 3;
    const shippers = 2;

    const remainingHours = Math.max(0, CONTROL_TOWER_CONFIG.WORKING_HOURS_END - new Date().getHours());

    const currentCapacity = {
      picking: pickers * CONTROL_TOWER_CONFIG.PICKING_RATE_PER_HOUR * remainingHours,
      packing: packers * CONTROL_TOWER_CONFIG.PACKING_RATE_PER_HOUR * remainingHours,
      shipping: shippers * CONTROL_TOWER_CONFIG.SHIPPING_RATE_PER_HOUR * remainingHours,
    };

    // Calculate utilization
    const predictedUtilization = {
      picking: Math.round((predictedOrderVolume / currentCapacity.picking) * 100),
      packing: Math.round((predictedOrderVolume / currentCapacity.packing) * 100),
      shipping: Math.round((predictedOrderVolume / currentCapacity.shipping) * 100),
    };

    // Identify bottleneck
    const maxUtil = Math.max(
      predictedUtilization.picking,
      predictedUtilization.packing,
      predictedUtilization.shipping
    );

    let bottleneck: CapacityPrediction['bottleneck'] = 'NONE';
    if (maxUtil >= CONTROL_TOWER_CONFIG.CAPACITY_OPTIMAL_MAX) {
      if (predictedUtilization.picking === maxUtil) bottleneck = 'PICKING';
      else if (predictedUtilization.packing === maxUtil) bottleneck = 'PACKING';
      else bottleneck = 'SHIPPING';
    }

    // Determine capacity status
    let capacityStatus: CapacityPrediction['capacityStatus'] = 'OPTIMAL';
    if (maxUtil >= CONTROL_TOWER_CONFIG.CAPACITY_OVERLOAD) {
      capacityStatus = 'OVERLOADED';
    } else if (maxUtil >= CONTROL_TOWER_CONFIG.CAPACITY_OPTIMAL_MAX) {
      capacityStatus = 'STRETCHED';
    } else if (maxUtil < CONTROL_TOWER_CONFIG.CAPACITY_OPTIMAL_MIN) {
      capacityStatus = 'UNDER_UTILIZED';
    }

    // Generate recommendations
    const recommendations = this.generateCapacityRecommendations(
      capacityStatus,
      bottleneck,
      predictedUtilization
    );

    return {
      locationId: location.id,
      locationCode: location.code,
      locationName: location.name,
      date: dateStr,
      shift: 'FULL_DAY',
      predictedOrderVolume,
      predictedUnits,
      currentCapacity,
      predictedUtilization,
      bottleneck,
      capacityStatus,
      recommendations,
    };
  }

  private async getAverageDailyOrders(locationId: string): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.order.count({
      where: {
        locationId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    return result / 7;
  }

  private generateCapacityRecommendations(
    status: CapacityPrediction['capacityStatus'],
    bottleneck: CapacityPrediction['bottleneck'],
    utilization: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (status === 'OVERLOADED') {
      recommendations.push('Consider overtime or additional staff');
      recommendations.push('Prioritize high-SLA orders');

      if (bottleneck === 'PICKING') {
        recommendations.push('Reassign packers to picking if trained');
      } else if (bottleneck === 'PACKING') {
        recommendations.push('Set up additional packing stations');
      }
    } else if (status === 'STRETCHED') {
      recommendations.push(`${bottleneck} area at ${utilization[bottleneck.toLowerCase()]}% capacity`);
      recommendations.push('Monitor closely for overflow');
    } else if (status === 'UNDER_UTILIZED') {
      recommendations.push('Consider cross-training staff');
      recommendations.push('Review order pull-forward from other locations');
    }

    return recommendations;
  }

  // =============================================================================
  // ALERTS & INSIGHTS
  // =============================================================================

  /**
   * Generate predictive insights
   */
  async generateInsights(): Promise<PredictiveInsight[]> {
    const insights: PredictiveInsight[] = [];

    // Check SLA risks
    const slaPredictions = await this.predictSLAForOrders(50);
    const criticalOrders = slaPredictions.filter(p => p.predictedStatus === 'CRITICAL').length;
    const atRiskOrders = slaPredictions.filter(p => p.predictedStatus === 'AT_RISK').length;

    if (criticalOrders > 0) {
      insights.push({
        type: 'SLA_RISK',
        severity: 'CRITICAL',
        title: `${criticalOrders} Orders in Critical SLA Status`,
        description: `${criticalOrders} orders are predicted to breach SLA within 2 hours`,
        predictedImpact: {
          affectedOrders: criticalOrders,
          slaImpact: criticalOrders,
        },
        timeToImpact: 120,
        confidence: 0.9,
        recommendations: [
          { action: 'Prioritize critical orders immediately', effort: 'LOW', impact: 'HIGH' },
          { action: 'Assign expedited carriers', effort: 'MEDIUM', impact: 'HIGH' },
        ],
      });
    }

    if (atRiskOrders > 5) {
      insights.push({
        type: 'SLA_RISK',
        severity: 'WARNING',
        title: `${atRiskOrders} Orders At Risk of SLA Breach`,
        description: `${atRiskOrders} orders may breach SLA if not prioritized`,
        predictedImpact: {
          affectedOrders: atRiskOrders,
        },
        timeToImpact: 240,
        confidence: 0.75,
        recommendations: [
          { action: 'Review and prioritize at-risk orders', effort: 'LOW', impact: 'MEDIUM' },
        ],
      });
    }

    // Check capacity
    const capacityStatus = await this.getCapacityStatus();
    const overloadedLocations = capacityStatus.locations.filter(l => l.capacityStatus === 'OVERLOADED');

    if (overloadedLocations.length > 0) {
      insights.push({
        type: 'CAPACITY_CONSTRAINT',
        severity: 'CRITICAL',
        title: `${overloadedLocations.length} Warehouse(s) Overloaded`,
        description: `Warehouses at capacity: ${overloadedLocations.map(l => l.locationCode).join(', ')}`,
        predictedImpact: {
          affectedOrders: overloadedLocations.reduce((sum, l) => sum + l.predictedOrderVolume, 0),
        },
        timeToImpact: 60,
        confidence: 0.85,
        recommendations: [
          { action: 'Activate overtime shifts', effort: 'MEDIUM', impact: 'HIGH' },
          { action: 'Redistribute orders to other locations', effort: 'HIGH', impact: 'HIGH' },
        ],
      });
    }

    return insights;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async getOrderMetrics(): Promise<{
    activeOrders: number;
    ordersAtRisk: number;
    ordersBreached: number;
  }> {
    const now = new Date();

    const activeOrders = await prisma.order.count({
      where: {
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'RTO_DELIVERED'],
        },
      },
    });

    const ordersAtRisk = await prisma.order.count({
      where: {
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'RTO_DELIVERED', 'SHIPPED', 'IN_TRANSIT'],
        },
        promisedDate: {
          gte: now,
          lte: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        },
      },
    });

    const ordersBreached = await prisma.order.count({
      where: {
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'RTO_DELIVERED'],
        },
        promisedDate: {
          lt: now,
        },
      },
    });

    return { activeOrders, ordersAtRisk, ordersBreached };
  }

  private async getSLAPredictionSummary(): Promise<{
    onTrack: number;
    atRisk: number;
    breached: number;
    critical: number;
  }> {
    const predictions = await this.predictSLAForOrders(200);

    return {
      onTrack: predictions.filter(p => p.predictedStatus === 'ON_TRACK').length,
      atRisk: predictions.filter(p => p.predictedStatus === 'AT_RISK').length,
      breached: predictions.filter(p => p.predictedStatus === 'BREACHED').length,
      critical: predictions.filter(p => p.predictedStatus === 'CRITICAL').length,
    };
  }

  private async getAlertCounts(): Promise<{
    p0: number;
    p1: number;
    p2: number;
    p3: number;
    total: number;
  }> {
    // Simplified - in production would query from alerts table
    const insights = await this.generateInsights();

    const counts = { p0: 0, p1: 0, p2: 0, p3: 0, total: 0 };

    for (const insight of insights) {
      if (insight.severity === 'CRITICAL') counts.p0++;
      else if (insight.severity === 'WARNING') counts.p1++;
      else counts.p2++;
      counts.total++;
    }

    return counts;
  }

  private async getCarrierHealth(): Promise<{
    carrierId: string;
    carrierName: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    avgDelay: number;
    ndrRate: number;
  }[]> {
    const transporters = await prisma.transporter.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      take: 10,
    });

    // Simplified - in production would calculate from delivery data
    return transporters.map(t => ({
      carrierId: t.id,
      carrierName: t.name,
      status: 'HEALTHY' as const,
      avgDelay: Math.random() * 2,
      ndrRate: Math.random() * 10,
    }));
  }

  private async getInventoryHealth(): Promise<{
    stockoutRisk: number;
    lowStockSkus: number;
    criticalSkus: number;
  }> {
    // Simplified - would use forecaster for real calculation
    return {
      stockoutRisk: 15,
      lowStockSkus: 25,
      criticalSkus: 5,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createControlTowerService(companyId: string): ControlTowerService {
  return new ControlTowerService(companyId);
}
