/**
 * Anomaly Detection Service
 *
 * Detects anomalies in orders, customers, inventory, and returns
 * using statistical methods and rule-based scoring.
 *
 * Anomaly Types:
 * - Order Fraud: Suspicious order patterns
 * - Velocity: Unusual order frequency
 * - Value: Order values outside normal range
 * - Address: Mismatched or suspicious addresses
 * - Pattern: Unusual SKU combinations or quantities
 * - Return Abuse: Serial returners, wardrobing
 */

import { prisma } from "@oms/database";
import {
  AnomalyDetectionResult,
  OrderRiskProfile,
  AnomalyType,
  AnomalySeverity,
  AnomalyAction,
  AnomalyFactor,
} from '../types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const ANOMALY_THRESHOLDS = {
  // Velocity thresholds
  MAX_ORDERS_PER_DAY_SAME_ADDRESS: 3,
  MAX_ORDERS_PER_HOUR_SAME_CUSTOMER: 2,
  MAX_ORDERS_PER_DAY_NEW_CUSTOMER: 5,

  // Value thresholds
  VALUE_MULTIPLIER_HIGH: 3,    // Orders > 3x avg are flagged
  VALUE_MULTIPLIER_EXTREME: 5, // Orders > 5x avg are high risk
  MIN_SUSPICIOUS_VALUE: 10000, // Minimum value for high-value checks

  // Pattern thresholds
  MAX_QUANTITY_SINGLE_SKU: 10,
  MAX_UNIQUE_SKUS_SINGLE_ORDER: 20,

  // COD thresholds
  COD_HIGH_VALUE_THRESHOLD: 5000,
  COD_NEW_CUSTOMER_THRESHOLD: 2000,

  // Return thresholds
  RETURN_RATE_HIGH: 30,        // 30% return rate
  RETURN_RATE_EXTREME: 50,     // 50% return rate
  MIN_ORDERS_FOR_RETURN_CALC: 3,
};

const SCORING_WEIGHTS = {
  velocity: 0.20,
  value: 0.20,
  address: 0.15,
  customerHistory: 0.20,
  paymentRisk: 0.15,
  pattern: 0.10,
};

// =============================================================================
// MAIN ANOMALY DETECTOR CLASS
// =============================================================================

export class AnomalyDetector {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Analyze an order for anomalies
   */
  async analyzeOrder(orderId: string): Promise<OrderRiskProfile> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: { include: { SKU: true } },
        Location: true,
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const shippingAddress = order.shippingAddress as Record<string, string>;
    const billingAddress = order.billingAddress as Record<string, string> | null;

    // Calculate individual scores
    const [
      velocityScore,
      valueScore,
      addressScore,
      customerHistoryScore,
      paymentRiskScore,
      patternScore,
    ] = await Promise.all([
      this.calculateVelocityScore(order),
      this.calculateValueScore(order),
      this.calculateAddressScore(shippingAddress, billingAddress),
      this.calculateCustomerHistoryScore(order.customerPhone, order.customerEmail),
      this.calculatePaymentRiskScore(order),
      this.calculatePatternScore(order),
    ]);

    // Calculate weighted overall score
    const overallScore = Math.min(100, Math.round(
      velocityScore * SCORING_WEIGHTS.velocity +
      valueScore * SCORING_WEIGHTS.value +
      addressScore * SCORING_WEIGHTS.address +
      customerHistoryScore * SCORING_WEIGHTS.customerHistory +
      paymentRiskScore * SCORING_WEIGHTS.paymentRisk +
      patternScore * SCORING_WEIGHTS.pattern
    ));

    // Determine severity and action
    const severity = this.getSeverity(overallScore);
    const action = this.getRecommendedAction(overallScore, severity);
    const flags = this.getFlags(order, {
      velocityScore,
      valueScore,
      addressScore,
      customerHistoryScore,
      paymentRiskScore,
      patternScore,
    });

    return {
      orderId,
      riskScore: overallScore,
      severity,
      factors: {
        velocityScore,
        valueScore,
        addressScore,
        customerHistoryScore,
        paymentRiskScore,
        patternScore,
      },
      flags,
      action,
    };
  }

  /**
   * Batch analyze multiple orders
   */
  async analyzeOrders(orderIds: string[]): Promise<OrderRiskProfile[]> {
    return Promise.all(orderIds.map(id => this.analyzeOrder(id)));
  }

  /**
   * Scan for anomalies in recent orders
   */
  async scanRecentOrders(hours: number = 24): Promise<AnomalyDetectionResult[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['CREATED', 'CONFIRMED', 'ALLOCATED'] },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    const results: AnomalyDetectionResult[] = [];

    for (const order of orders) {
      const profile = await this.analyzeOrder(order.id);

      if (profile.riskScore >= 50) { // Only flag medium+ risk
        results.push({
          entityType: 'ORDER',
          entityId: order.id,
          overallScore: profile.riskScore,
          severity: profile.severity,
          anomalyTypes: this.getAnomalyTypes(profile),
          factors: this.convertFactorsToArray(profile.factors),
          recommendedAction: profile.action,
          confidence: this.calculateConfidence(profile),
          explanation: this.generateExplanation(profile),
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  // =============================================================================
  // SCORING METHODS
  // =============================================================================

  /**
   * Calculate velocity score - unusual order frequency
   */
  private async calculateVelocityScore(order: any): Promise<number> {
    const shippingAddress = order.shippingAddress as Record<string, string>;
    const addressKey = `${shippingAddress.addressLine1}|${shippingAddress.pincode}`;

    // Check orders from same address in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const sameAddressOrders = await prisma.order.count({
      where: {
        customerPhone: order.customerPhone,
        createdAt: { gte: oneDayAgo },
        id: { not: order.id },
      },
    });

    // Check orders from same customer in last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const sameHourOrders = await prisma.order.count({
      where: {
        customerPhone: order.customerPhone,
        createdAt: { gte: oneHourAgo },
        id: { not: order.id },
      },
    });

    let score = 0;

    // Same address velocity
    if (sameAddressOrders >= ANOMALY_THRESHOLDS.MAX_ORDERS_PER_DAY_SAME_ADDRESS) {
      score += 40;
    } else if (sameAddressOrders >= 2) {
      score += 20;
    }

    // Same hour velocity
    if (sameHourOrders >= ANOMALY_THRESHOLDS.MAX_ORDERS_PER_HOUR_SAME_CUSTOMER) {
      score += 40;
    } else if (sameHourOrders >= 1) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate value score - unusual order values
   */
  private async calculateValueScore(order: any): Promise<number> {
    const orderValue = Number(order.totalAmount);

    // Get average order value
    // Calculate average order value
    const avgResult = await prisma.order.aggregate({
      where: {
        status: { notIn: ['CANCELLED'] },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _avg: { totalAmount: true },
    });

    const avgValue = Number(avgResult._avg.totalAmount) || 1000;

    // Calculate standard deviation manually using raw query (Prisma doesn't support _stddev)
    const stdDevResult = await prisma.$queryRaw<[{ stddev: number }]>`
      SELECT COALESCE(STDDEV("totalAmount"), 500) as stddev
      FROM "Order"
      WHERE status NOT IN ('CANCELLED')
        AND "createdAt" >= NOW() - INTERVAL '90 days'
    `;
    const stdDev = Number(stdDevResult[0]?.stddev) || 500;

    let score = 0;

    // Z-score based detection
    const zScore = Math.abs((orderValue - avgValue) / (stdDev || 1));

    if (zScore > 3) {
      score += 50;
    } else if (zScore > 2) {
      score += 30;
    } else if (zScore > 1.5) {
      score += 15;
    }

    // Multiplier based detection
    const multiplier = orderValue / avgValue;

    if (multiplier >= ANOMALY_THRESHOLDS.VALUE_MULTIPLIER_EXTREME) {
      score += 40;
    } else if (multiplier >= ANOMALY_THRESHOLDS.VALUE_MULTIPLIER_HIGH) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate address score - suspicious address patterns
   */
  private async calculateAddressScore(
    shippingAddress: Record<string, string>,
    billingAddress: Record<string, string> | null
  ): Promise<number> {
    let score = 0;

    // Check address completeness
    if (!shippingAddress.addressLine1 || shippingAddress.addressLine1.length < 10) {
      score += 20;
    }

    // Check pincode validity
    if (!shippingAddress.pincode || !/^\d{6}$/.test(shippingAddress.pincode)) {
      score += 30;
    }

    // Check for suspicious keywords
    const suspiciousKeywords = ['test', 'demo', 'asdf', 'xyz', '123'];
    const addressText = `${shippingAddress.addressLine1} ${shippingAddress.city}`.toLowerCase();
    if (suspiciousKeywords.some(kw => addressText.includes(kw))) {
      score += 40;
    }

    // Check billing/shipping mismatch
    if (billingAddress) {
      const billingPincode = billingAddress.pincode;
      const shippingPincode = shippingAddress.pincode;

      if (billingPincode && shippingPincode && billingPincode !== shippingPincode) {
        // Different pincodes - mild flag
        score += 10;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate customer history score
   */
  private async calculateCustomerHistoryScore(
    customerPhone: string,
    customerEmail?: string | null
  ): Promise<number> {
    // Get customer order history
    const history = await prisma.order.findMany({
      where: {
        OR: [
          { customerPhone },
          customerEmail ? { customerEmail } : {},
        ].filter(c => Object.keys(c).length > 0),
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        totalAmount: true,
        paymentMode: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // New customer - higher risk for COD
    if (history.length === 0) {
      return 40; // New customer baseline risk
    }

    let score = 0;

    // Check for delivered orders (good history)
    const deliveredOrders = history.filter(o => o.status === 'DELIVERED').length;
    const deliveryRate = deliveredOrders / history.length;

    if (deliveryRate >= 0.8) {
      score -= 20; // Good history reduces risk
    } else if (deliveryRate < 0.5) {
      score += 30; // Poor delivery rate
    }

    // Check for cancelled orders
    const cancelledOrders = history.filter(o => o.status === 'CANCELLED').length;
    const cancelRate = cancelledOrders / history.length;

    if (cancelRate > 0.3) {
      score += 40;
    } else if (cancelRate > 0.15) {
      score += 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate payment risk score
   */
  private async calculatePaymentRiskScore(order: any): Promise<number> {
    let score = 0;
    const orderValue = Number(order.totalAmount);

    // COD specific risks
    if (order.paymentMode === 'COD') {
      score += 15; // Base COD risk

      // High value COD
      if (orderValue > ANOMALY_THRESHOLDS.COD_HIGH_VALUE_THRESHOLD) {
        score += 25;
      }

      // New customer + COD + high value
      const previousOrders = await prisma.order.count({
        where: {
          customerPhone: order.customerPhone,
          status: 'DELIVERED',
          id: { not: order.id },
        },
      });

      if (previousOrders === 0 && orderValue > ANOMALY_THRESHOLDS.COD_NEW_CUSTOMER_THRESHOLD) {
        score += 30;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate pattern score - unusual order patterns
   */
  private async calculatePatternScore(order: any): Promise<number> {
    let score = 0;

    const items = order.OrderItem || [];

    // Check for unusual quantities
    const maxQuantity = Math.max(...items.map((i: any) => i.quantity), 0);
    if (maxQuantity > ANOMALY_THRESHOLDS.MAX_QUANTITY_SINGLE_SKU) {
      score += 30;
    }

    // Check for too many unique SKUs
    if (items.length > ANOMALY_THRESHOLDS.MAX_UNIQUE_SKUS_SINGLE_ORDER) {
      score += 25;
    }

    // Check for all same SKU (bulk fraud pattern)
    const uniqueSkus = new Set(items.map((i: any) => i.skuId));
    if (items.length > 3 && uniqueSkus.size === 1) {
      score += 20;
    }

    return Math.min(100, score);
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private getSeverity(score: number): AnomalySeverity {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private getRecommendedAction(score: number, severity: AnomalySeverity): AnomalyAction {
    if (severity === 'CRITICAL') return 'BLOCK';
    if (severity === 'HIGH') return 'HOLD';
    if (severity === 'MEDIUM') return 'REVIEW';
    return 'APPROVE';
  }

  private getFlags(order: any, factors: Record<string, number>): string[] {
    const flags: string[] = [];

    if (factors.velocityScore >= 40) flags.push('HIGH_VELOCITY');
    if (factors.valueScore >= 40) flags.push('UNUSUAL_VALUE');
    if (factors.addressScore >= 40) flags.push('SUSPICIOUS_ADDRESS');
    if (factors.customerHistoryScore >= 40) flags.push('RISKY_CUSTOMER');
    if (factors.paymentRiskScore >= 40) flags.push('COD_RISK');
    if (factors.patternScore >= 40) flags.push('UNUSUAL_PATTERN');

    if (order.paymentMode === 'COD') flags.push('COD_ORDER');

    return flags;
  }

  private getAnomalyTypes(profile: OrderRiskProfile): AnomalyType[] {
    const types: AnomalyType[] = [];

    if (profile.factors.velocityScore >= 40) types.push('ORDER_VELOCITY');
    if (profile.factors.valueScore >= 40) types.push('VALUE_ANOMALY');
    if (profile.factors.addressScore >= 40) types.push('ADDRESS_MISMATCH');
    if (profile.factors.patternScore >= 40) types.push('PATTERN_DEVIATION');
    if (profile.factors.paymentRiskScore >= 40) types.push('COD_RISK');

    if (types.length === 0 && profile.riskScore >= 50) {
      types.push('ORDER_FRAUD');
    }

    return types;
  }

  private convertFactorsToArray(factors: Record<string, number>): AnomalyFactor[] {
    return Object.entries(factors).map(([name, score]) => ({
      name,
      score,
      weight: SCORING_WEIGHTS[name.replace('Score', '') as keyof typeof SCORING_WEIGHTS] || 0.1,
      details: this.getFactorDetails(name, score),
    }));
  }

  private getFactorDetails(name: string, score: number): string {
    if (score < 20) return 'Normal';
    if (score < 40) return 'Slightly elevated';
    if (score < 60) return 'Elevated - needs attention';
    if (score < 80) return 'High risk';
    return 'Critical - immediate action required';
  }

  private calculateConfidence(profile: OrderRiskProfile): number {
    // Higher scores = higher confidence
    const baseConfidence = Math.min(0.95, 0.5 + (profile.riskScore / 200));

    // More flags = higher confidence
    const flagBonus = profile.flags.length * 0.05;

    return Math.min(0.99, baseConfidence + flagBonus);
  }

  private generateExplanation(profile: OrderRiskProfile): string {
    const parts: string[] = [];

    if (profile.factors.velocityScore >= 40) {
      parts.push('multiple orders from same customer/address in short time');
    }
    if (profile.factors.valueScore >= 40) {
      parts.push('order value significantly above average');
    }
    if (profile.factors.addressScore >= 40) {
      parts.push('suspicious address patterns detected');
    }
    if (profile.factors.customerHistoryScore >= 40) {
      parts.push('customer has poor order history');
    }
    if (profile.factors.paymentRiskScore >= 40) {
      parts.push('high-value COD order from new/risky customer');
    }
    if (profile.factors.patternScore >= 40) {
      parts.push('unusual SKU quantities or combinations');
    }

    if (parts.length === 0) {
      return 'Order appears normal with no significant risk factors.';
    }

    return `Risk detected: ${parts.join('; ')}.`;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAnomalyDetector(companyId: string): AnomalyDetector {
  return new AnomalyDetector(companyId);
}
