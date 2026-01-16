/**
 * Demand Forecasting Service
 *
 * Provides demand predictions using statistical methods:
 * - Exponential Smoothing (Holt-Winters)
 * - Moving Averages with Seasonality
 * - Trend Detection
 *
 * Features:
 * - SKU-level forecasting
 * - Category-level forecasting
 * - Channel-wise forecasting
 * - Seasonality detection (day-of-week, monthly)
 * - Confidence intervals
 */

import { prisma } from "@oms/database";
import {
  ForecastRequest,
  DemandForecast,
  ForecastPoint,
  InventoryRecommendation,
} from '../types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FORECAST_CONFIG = {
  // Minimum data points required for forecasting
  MIN_DATA_POINTS: 14,

  // Default horizon if not specified
  DEFAULT_HORIZON_DAYS: 14,

  // Smoothing parameters for exponential smoothing
  ALPHA: 0.3, // Level smoothing
  BETA: 0.1,  // Trend smoothing
  GAMMA: 0.2, // Seasonal smoothing

  // Confidence interval z-scores
  CONFIDENCE_90: 1.645,
  CONFIDENCE_95: 1.96,

  // Safety stock days of cover
  DEFAULT_SERVICE_LEVEL: 0.95,
  SAFETY_STOCK_MULTIPLIER: 1.65, // For 95% service level
};

// =============================================================================
// DEMAND FORECASTER CLASS
// =============================================================================

export class DemandForecaster {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Generate demand forecast for a SKU
   */
  async forecastSKU(skuId: string, horizonDays: number = 14): Promise<DemandForecast> {
    // Get SKU details
    const sku = await prisma.sKU.findUnique({
      where: { id: skuId },
      select: { id: true, code: true, name: true },
    });

    if (!sku) {
      throw new Error(`SKU not found: ${skuId}`);
    }

    // Get historical demand data (last 90 days)
    const historicalData = await this.getHistoricalDemand(skuId, 90);

    if (historicalData.length < FORECAST_CONFIG.MIN_DATA_POINTS) {
      // Not enough data - use simple average
      return this.generateSimpleForecast(sku, historicalData, horizonDays);
    }

    // Calculate seasonality factors
    const seasonalFactors = this.calculateSeasonality(historicalData);

    // Calculate trend
    const trend = this.calculateTrend(historicalData);

    // Generate forecasts using Holt-Winters method
    const forecasts = this.holtWintersForeccast(
      historicalData,
      seasonalFactors,
      horizonDays
    );

    // Calculate model accuracy (using holdout validation)
    const accuracy = this.calculateAccuracy(historicalData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(forecasts, trend);

    return {
      skuId: sku.id,
      skuCode: sku.code,
      skuName: sku.name,
      horizon: horizonDays,
      generatedAt: new Date(),
      modelVersion: '1.0-holt-winters',
      accuracy,
      forecasts,
      seasonalFactors,
      trend: trend.direction,
      trendStrength: trend.strength,
      recommendations,
    };
  }

  /**
   * Batch forecast multiple SKUs
   */
  async forecastMultipleSKUs(request: ForecastRequest): Promise<DemandForecast[]> {
    let skuIds = request.skuIds || [];

    // If category specified, get SKUs in category
    if (request.categoryId) {
      const skus = await prisma.sKU.findMany({
        where: {
          companyId: this.companyId,
          category: request.categoryId,
          isActive: true,
        },
        select: { id: true },
      });
      skuIds = skus.map(s => s.id);
    }

    // If no SKUs specified, get top moving SKUs
    if (skuIds.length === 0) {
      const topSkus = await this.getTopMovingSKUs(100);
      skuIds = topSkus.map(s => s.skuId);
    }

    const forecasts = await Promise.all(
      skuIds.map(id => this.forecastSKU(id, request.horizonDays))
    );

    return forecasts;
  }

  /**
   * Get inventory recommendations based on forecasts
   */
  async getInventoryRecommendations(
    locationId?: string,
    limit: number = 50
  ): Promise<InventoryRecommendation[]> {
    // Get SKUs with inventory
    const skusWithInventory = await prisma.inventory.groupBy({
      by: ['skuId'],
      where: locationId ? { locationId } : {},
      _sum: { quantity: true, reservedQty: true },
    });

    const recommendations: InventoryRecommendation[] = [];

    for (const inv of skusWithInventory.slice(0, limit)) {
      try {
        const forecast = await this.forecastSKU(inv.skuId, 14);

        const currentStock = (inv._sum.quantity || 0) - (inv._sum.reservedQty || 0);
        const avgDailyDemand = this.calculateAverageDemand(forecast.forecasts);
        const demandStdDev = this.calculateDemandStdDev(forecast.forecasts);

        // Calculate safety stock (95% service level)
        const leadTime = 3; // Assume 3 days lead time
        const safetyStock = Math.ceil(
          FORECAST_CONFIG.SAFETY_STOCK_MULTIPLIER * demandStdDev * Math.sqrt(leadTime)
        );

        // Calculate reorder point
        const reorderPoint = Math.ceil(avgDailyDemand * leadTime + safetyStock);

        // Calculate suggested reorder quantity (EOQ-based)
        const suggestedReorderQty = Math.ceil(avgDailyDemand * 14); // 2 weeks cover

        // Calculate days of cover
        const daysOfCover = avgDailyDemand > 0
          ? Math.round(currentStock / avgDailyDemand)
          : 999;

        // Calculate risks
        const stockoutRisk = currentStock <= reorderPoint
          ? Math.min(100, Math.round((1 - currentStock / reorderPoint) * 100))
          : 0;

        const overstockRisk = daysOfCover > 60
          ? Math.min(100, Math.round((daysOfCover - 30) / 60 * 100))
          : 0;

        // Determine action
        let action: InventoryRecommendation['action'] = 'ADEQUATE';
        if (currentStock <= 0) action = 'CRITICAL';
        else if (currentStock <= safetyStock) action = 'REORDER_NOW';
        else if (currentStock <= reorderPoint) action = 'REORDER_SOON';
        else if (daysOfCover > 90) action = 'OVERSTOCK';

        recommendations.push({
          skuId: inv.skuId,
          currentStock,
          safetyStock,
          reorderPoint,
          suggestedReorderQty,
          daysOfCover,
          stockoutRisk,
          overstockRisk,
          action,
        });
      } catch {
        // Skip SKUs with forecasting errors
        continue;
      }
    }

    // Sort by action priority
    const actionPriority = {
      'CRITICAL': 0,
      'REORDER_NOW': 1,
      'REORDER_SOON': 2,
      'OVERSTOCK': 3,
      'ADEQUATE': 4,
    };

    return recommendations.sort((a, b) =>
      actionPriority[a.action] - actionPriority[b.action]
    );
  }

  // =============================================================================
  // FORECASTING METHODS
  // =============================================================================

  /**
   * Get historical demand data
   */
  private async getHistoricalDemand(
    skuId: string,
    days: number
  ): Promise<{ date: Date; demand: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyDemand = await prisma.$queryRaw<{ date: Date; demand: bigint }[]>`
      SELECT
        DATE_TRUNC('day', o."orderDate") as date,
        COALESCE(SUM(oi.quantity), 0) as demand
      FROM "OrderItem" oi
      JOIN "Order" o ON oi."orderId" = o.id
      WHERE oi."skuId" = ${skuId}
        AND o."orderDate" >= ${startDate}
        AND o.status NOT IN ('CANCELLED')
      GROUP BY DATE_TRUNC('day', o."orderDate")
      ORDER BY date ASC
    `;

    // Fill in missing dates with 0 demand
    const result: { date: Date; demand: number }[] = [];
    const demandMap = new Map(
      dailyDemand.map(d => [d.date.toISOString().split('T')[0], Number(d.demand)])
    );

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      result.push({
        date: new Date(dateKey),
        demand: demandMap.get(dateKey) || 0,
      });
    }

    return result;
  }

  /**
   * Calculate seasonality factors (day-of-week, month)
   */
  private calculateSeasonality(
    data: { date: Date; demand: number }[]
  ): DemandForecast['seasonalFactors'] {
    const dayOfWeek: Record<string, number[]> = {
      '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [],
    };
    const monthOfYear: Record<string, number[]> = {};

    const avgDemand = data.reduce((sum, d) => sum + d.demand, 0) / data.length || 1;

    for (const point of data) {
      const dow = point.date.getDay().toString();
      const month = (point.date.getMonth() + 1).toString();

      dayOfWeek[dow].push(point.demand / avgDemand);

      if (!monthOfYear[month]) monthOfYear[month] = [];
      monthOfYear[month].push(point.demand / avgDemand);
    }

    // Calculate average factors
    const dowFactors: Record<string, number> = {};
    for (const [day, values] of Object.entries(dayOfWeek)) {
      dowFactors[day] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 1;
    }

    const monthFactors: Record<string, number> = {};
    for (const [month, values] of Object.entries(monthOfYear)) {
      monthFactors[month] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 1;
    }

    return {
      dayOfWeek: dowFactors,
      monthOfYear: monthFactors,
    };
  }

  /**
   * Calculate trend direction and strength
   */
  private calculateTrend(
    data: { date: Date; demand: number }[]
  ): { direction: 'INCREASING' | 'DECREASING' | 'STABLE'; strength: number } {
    if (data.length < 7) {
      return { direction: 'STABLE', strength: 0 };
    }

    // Simple linear regression
    const n = data.length;
    const xMean = (n - 1) / 2;
    const yMean = data.reduce((sum, d) => sum + d.demand, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (data[i].demand - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Normalize slope to percentage of mean
    const trendStrength = Math.abs(slope / (yMean || 1)) * 100;

    let direction: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    if (slope > 0.1 * yMean / n) direction = 'INCREASING';
    else if (slope < -0.1 * yMean / n) direction = 'DECREASING';

    return {
      direction,
      strength: Math.min(100, trendStrength),
    };
  }

  /**
   * Holt-Winters exponential smoothing forecast
   */
  private holtWintersForeccast(
    data: { date: Date; demand: number }[],
    seasonalFactors: DemandForecast['seasonalFactors'],
    horizonDays: number
  ): ForecastPoint[] {
    const demands = data.map(d => d.demand);
    const n = demands.length;

    // Initialize level and trend
    let level = demands.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    let trend = (demands[n - 1] - demands[0]) / n;

    // Calculate fitted values and errors for confidence interval
    const errors: number[] = [];
    let prevLevel = level;

    for (let i = 1; i < n; i++) {
      const actual = demands[i];
      const predicted = prevLevel + trend;
      errors.push(actual - predicted);

      prevLevel = level;
      level = FORECAST_CONFIG.ALPHA * actual +
              (1 - FORECAST_CONFIG.ALPHA) * (level + trend);
      trend = FORECAST_CONFIG.BETA * (level - prevLevel) +
              (1 - FORECAST_CONFIG.BETA) * trend;
    }

    // Calculate standard error
    const mse = errors.reduce((sum, e) => sum + e ** 2, 0) / errors.length;
    const se = Math.sqrt(mse);

    // Generate forecasts
    const forecasts: ForecastPoint[] = [];
    const lastDate = data[data.length - 1].date;

    for (let h = 1; h <= horizonDays; h++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + h);

      // Base forecast
      let predicted = level + trend * h;

      // Apply seasonality
      const dow = forecastDate.getDay().toString();
      const month = (forecastDate.getMonth() + 1).toString();
      const seasonalFactor = (seasonalFactors.dayOfWeek[dow] || 1) *
                            (seasonalFactors.monthOfYear[month] || 1);

      predicted = Math.max(0, Math.round(predicted * seasonalFactor));

      // Confidence interval widens with horizon
      const errorMultiplier = Math.sqrt(h);
      const margin = FORECAST_CONFIG.CONFIDENCE_95 * se * errorMultiplier;

      forecasts.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted,
        lowerBound: Math.max(0, Math.round(predicted - margin)),
        upperBound: Math.round(predicted + margin),
        confidence: Math.max(0.5, 0.95 - (h * 0.02)), // Confidence decreases with horizon
      });
    }

    return forecasts;
  }

  /**
   * Simple forecast for SKUs with limited data
   */
  private generateSimpleForecast(
    sku: { id: string; code: string; name: string },
    data: { date: Date; demand: number }[],
    horizonDays: number
  ): DemandForecast {
    const avgDemand = data.length > 0
      ? data.reduce((sum, d) => sum + d.demand, 0) / data.length
      : 1;

    const forecasts: ForecastPoint[] = [];
    const today = new Date();

    for (let h = 1; h <= horizonDays; h++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(forecastDate.getDate() + h);

      forecasts.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted: Math.round(avgDemand),
        lowerBound: Math.max(0, Math.round(avgDemand * 0.5)),
        upperBound: Math.round(avgDemand * 1.5),
        confidence: 0.6, // Lower confidence for simple forecast
      });
    }

    return {
      skuId: sku.id,
      skuCode: sku.code,
      skuName: sku.name,
      horizon: horizonDays,
      generatedAt: new Date(),
      modelVersion: '1.0-simple-average',
      accuracy: 0.5,
      forecasts,
      seasonalFactors: {
        dayOfWeek: { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1 },
        monthOfYear: {},
      },
      trend: 'STABLE',
      trendStrength: 0,
      recommendations: ['Insufficient data for accurate forecasting - using simple average'],
    };
  }

  /**
   * Calculate forecast accuracy using holdout validation
   */
  private calculateAccuracy(data: { date: Date; demand: number }[]): number {
    if (data.length < 21) return 0.5;

    // Use last 7 days as holdout
    const trainingData = data.slice(0, -7);
    const testData = data.slice(-7);

    const seasonalFactors = this.calculateSeasonality(trainingData);

    // Generate forecasts for test period
    const forecasts = this.holtWintersForeccast(trainingData, seasonalFactors, 7);

    // Calculate MAPE (Mean Absolute Percentage Error)
    let totalError = 0;
    let count = 0;

    for (let i = 0; i < testData.length && i < forecasts.length; i++) {
      const actual = testData[i].demand;
      const predicted = forecasts[i].predicted;

      if (actual > 0) {
        totalError += Math.abs((actual - predicted) / actual);
        count++;
      }
    }

    const mape = count > 0 ? totalError / count : 0.5;

    // Convert MAPE to accuracy (1 - MAPE, capped at 0.5-0.99)
    return Math.max(0.5, Math.min(0.99, 1 - mape));
  }

  /**
   * Get top moving SKUs
   */
  private async getTopMovingSKUs(limit: number): Promise<{ skuId: string; totalQty: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.orderItem.groupBy({
      by: ['skuId'],
      where: {
        Order: {
          orderDate: { gte: thirtyDaysAgo },
          status: { notIn: ['CANCELLED'] },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return result.map(r => ({
      skuId: r.skuId,
      totalQty: r._sum.quantity || 0,
    }));
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private calculateAverageDemand(forecasts: ForecastPoint[]): number {
    if (forecasts.length === 0) return 0;
    return forecasts.reduce((sum, f) => sum + f.predicted, 0) / forecasts.length;
  }

  private calculateDemandStdDev(forecasts: ForecastPoint[]): number {
    const avg = this.calculateAverageDemand(forecasts);
    if (forecasts.length < 2) return avg * 0.3;

    const variance = forecasts.reduce((sum, f) =>
      sum + (f.predicted - avg) ** 2, 0
    ) / forecasts.length;

    return Math.sqrt(variance);
  }

  private generateRecommendations(
    forecasts: ForecastPoint[],
    trend: { direction: string; strength: number }
  ): string[] {
    const recommendations: string[] = [];
    const totalDemand = forecasts.reduce((sum, f) => sum + f.predicted, 0);

    if (trend.direction === 'INCREASING' && trend.strength > 20) {
      recommendations.push('Demand is trending upward - consider increasing safety stock');
    } else if (trend.direction === 'DECREASING' && trend.strength > 20) {
      recommendations.push('Demand is trending downward - review reorder quantities');
    }

    // Check for high uncertainty
    const avgConfidence = forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length;
    if (avgConfidence < 0.7) {
      recommendations.push('Forecast confidence is low - consider more frequent reviews');
    }

    // Check for potential stockout
    if (totalDemand > 0) {
      recommendations.push(`Expected demand over ${forecasts.length} days: ${totalDemand} units`);
    }

    return recommendations;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createDemandForecaster(companyId: string): DemandForecaster {
  return new DemandForecaster(companyId);
}
