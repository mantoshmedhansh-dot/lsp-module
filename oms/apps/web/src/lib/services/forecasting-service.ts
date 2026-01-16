import { prisma } from "@oms/database";

export interface DemandForecast {
  skuId: string;
  skuCode: string;
  skuName: string;
  historicalData: {
    period: string;
    quantity: number;
    revenue: number;
  }[];
  forecast: {
    period: string;
    expectedQuantity: number;
    lowEstimate: number;
    highEstimate: number;
    confidence: number;
  }[];
  trend: {
    direction: "up" | "down" | "stable";
    percentChange: number;
    seasonality: boolean;
  };
  inventory: {
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    daysOfStock: number;
    reorderPoint: number;
    suggestedReorderQty: number;
    urgency: "CRITICAL" | "LOW" | "ADEQUATE" | "EXCESS";
  } | null;
}

interface HistoricalDataPoint {
  period: string;
  quantity: number;
  revenue: number;
}

// Simple moving average calculation
function calculateSMA(values: number[], periods: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < periods - 1) {
      result.push(values[i]);
    } else {
      const sum = values.slice(i - periods + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / periods);
    }
  }
  return result;
}

// Exponential smoothing forecast
function exponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  periods: number = 7
): { forecast: number[]; confidence: number } {
  if (data.length === 0) return { forecast: [], confidence: 0 };

  let smoothed = data[0];
  const forecasts: number[] = [];

  // Calculate smoothed values
  for (let i = 1; i < data.length; i++) {
    smoothed = alpha * data[i] + (1 - alpha) * smoothed;
  }

  // Generate forecasts
  for (let i = 0; i < periods; i++) {
    forecasts.push(Math.round(smoothed));
  }

  // Calculate confidence based on variance
  const variance =
    data.length > 1
      ? data.reduce((sum, val) => sum + Math.pow(val - smoothed, 2), 0) /
        (data.length - 1)
      : 0;
  const cv = smoothed > 0 ? Math.sqrt(variance) / smoothed : 0;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  return { forecast: forecasts, confidence };
}

// Detect trend direction
function detectTrend(data: number[]): {
  direction: "up" | "down" | "stable";
  percentChange: number;
} {
  if (data.length < 4) return { direction: "stable", percentChange: 0 };

  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);

  const firstAvg =
    firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const percentChange =
    firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

  const direction =
    percentChange > 10 ? "up" : percentChange < -10 ? "down" : "stable";

  return { direction, percentChange };
}

// Detect seasonality (simple weekly pattern detection)
function detectSeasonality(dailyData: number[]): boolean {
  if (dailyData.length < 14) return false;

  // Compare weekly patterns
  const week1 = dailyData.slice(0, 7);
  const week2 = dailyData.slice(7, 14);

  let correlationScore = 0;
  for (let i = 0; i < 7; i++) {
    if (
      (week1[i] > 0 && week2[i] > 0) ||
      (week1[i] === 0 && week2[i] === 0)
    ) {
      correlationScore++;
    }
  }

  return correlationScore >= 5; // 5+ days similar pattern suggests seasonality
}

// Generate forecast for a single SKU
export async function generateSkuForecast(
  skuId: string,
  forecastDays: number = 30,
  historicalDays: number = 90
): Promise<DemandForecast | null> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - historicalDays);

  // Get SKU info
  const sku = await prisma.sKU.findUnique({
    where: { id: skuId },
    select: { id: true, code: true, name: true },
  });

  if (!sku) return null;

  // Get historical order data
  const orderItems = await prisma.orderItem.findMany({
    where: {
      skuId,
      Order: {
        createdAt: { gte: startDate },
        status: { notIn: ["CANCELLED"] },
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      Order: {
        select: { createdAt: true },
      },
    },
  });

  // Aggregate by day
  const dailyData = new Map<string, { quantity: number; revenue: number }>();
  for (const item of orderItems) {
    const date = item.Order.createdAt.toISOString().split("T")[0];
    const current = dailyData.get(date) || { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.unitPrice) * item.quantity;
    dailyData.set(date, current);
  }

  // Fill in missing days with zeros
  const allDates: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= now) {
    allDates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const historicalData: HistoricalDataPoint[] = allDates.map((date) => ({
    period: date,
    quantity: dailyData.get(date)?.quantity || 0,
    revenue: dailyData.get(date)?.revenue || 0,
  }));

  const quantities = historicalData.map((d) => d.quantity);

  // Calculate forecasts
  const avgDaily =
    quantities.length > 0
      ? quantities.reduce((a, b) => a + b, 0) / quantities.length
      : 0;

  const { forecast: rawForecast, confidence } = exponentialSmoothing(
    quantities,
    0.3,
    forecastDays
  );

  const trend = detectTrend(quantities);
  const seasonality = detectSeasonality(quantities);

  // Adjust forecast for trend
  const trendMultiplier =
    trend.direction === "up"
      ? 1 + trend.percentChange / 200
      : trend.direction === "down"
      ? 1 + trend.percentChange / 200
      : 1;

  // Calculate variance for confidence intervals
  const variance =
    quantities.length > 1
      ? quantities.reduce((sum, val) => sum + Math.pow(val - avgDaily, 2), 0) /
        (quantities.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  // Generate forecast periods
  const forecastData = [];
  for (let i = 0; i < forecastDays; i++) {
    const forecastDate = new Date(now);
    forecastDate.setDate(forecastDate.getDate() + i + 1);
    const period = forecastDate.toISOString().split("T")[0];

    const baseExpected = rawForecast[i] || avgDaily;
    const adjusted = Math.round(baseExpected * trendMultiplier);

    forecastData.push({
      period,
      expectedQuantity: Math.max(0, adjusted),
      lowEstimate: Math.max(0, Math.round(adjusted - 1.96 * stdDev)),
      highEstimate: Math.round(adjusted + 1.96 * stdDev),
      confidence,
    });
  }

  // Get current inventory
  const inventory = await prisma.inventory.aggregate({
    where: { skuId },
    _sum: { quantity: true, reservedQty: true },
  });

  const currentStock = Number(inventory._sum.quantity || 0);
  const reservedStock = Number(inventory._sum.reservedQty || 0);
  const availableStock = currentStock - reservedStock;

  const expectedDemand = forecastData.reduce(
    (sum, f) => sum + f.expectedQuantity,
    0
  );
  const dailyDemand = forecastDays > 0 ? expectedDemand / forecastDays : 0;

  const daysOfStock = dailyDemand > 0 ? Math.round(availableStock / dailyDemand) : 999;
  const safetyStock = Math.ceil(dailyDemand * 7);
  const reorderPoint = Math.ceil(dailyDemand * 14 + safetyStock);
  const suggestedReorderQty = Math.max(0, Math.ceil(reorderPoint - availableStock + safetyStock * 2));

  let urgency: "CRITICAL" | "LOW" | "ADEQUATE" | "EXCESS";
  if (daysOfStock <= 7) urgency = "CRITICAL";
  else if (daysOfStock <= 14) urgency = "LOW";
  else if (daysOfStock <= 60) urgency = "ADEQUATE";
  else urgency = "EXCESS";

  return {
    skuId: sku.id,
    skuCode: sku.code,
    skuName: sku.name,
    historicalData,
    forecast: forecastData,
    trend: {
      ...trend,
      seasonality,
    },
    inventory: {
      currentStock,
      reservedStock,
      availableStock,
      daysOfStock,
      reorderPoint,
      suggestedReorderQty,
      urgency,
    },
  };
}

// Generate forecasts for all active SKUs
export async function generateAllForecasts(
  forecastDays: number = 30,
  limit: number = 100
): Promise<{
  forecasts: DemandForecast[];
  summary: {
    totalSKUs: number;
    criticalStock: number;
    lowStock: number;
    trendingUp: number;
    trendingDown: number;
  };
}> {
  // Get top SKUs by recent sales
  const topSkus = await prisma.orderItem.groupBy({
    by: ["skuId"],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
    where: {
      Order: {
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const forecasts: DemandForecast[] = [];

  for (const sku of topSkus) {
    const forecast = await generateSkuForecast(sku.skuId, forecastDays);
    if (forecast) {
      forecasts.push(forecast);
    }
  }

  const summary = {
    totalSKUs: forecasts.length,
    criticalStock: forecasts.filter((f) => f.inventory?.urgency === "CRITICAL")
      .length,
    lowStock: forecasts.filter((f) => f.inventory?.urgency === "LOW").length,
    trendingUp: forecasts.filter((f) => f.trend.direction === "up").length,
    trendingDown: forecasts.filter((f) => f.trend.direction === "down").length,
  };

  return { forecasts, summary };
}

// Get reorder recommendations
export async function getReorderRecommendations(): Promise<
  Array<{
    skuId: string;
    skuCode: string;
    skuName: string;
    currentStock: number;
    reorderPoint: number;
    suggestedQty: number;
    urgency: string;
    expectedDemand: number;
  }>
> {
  const { forecasts } = await generateAllForecasts(30, 200);

  return forecasts
    .filter(
      (f) =>
        f.inventory &&
        (f.inventory.urgency === "CRITICAL" || f.inventory.urgency === "LOW")
    )
    .map((f) => ({
      skuId: f.skuId,
      skuCode: f.skuCode,
      skuName: f.skuName,
      currentStock: f.inventory!.availableStock,
      reorderPoint: f.inventory!.reorderPoint,
      suggestedQty: f.inventory!.suggestedReorderQty,
      urgency: f.inventory!.urgency,
      expectedDemand: f.forecast.reduce((sum, p) => sum + p.expectedQuantity, 0),
    }))
    .sort((a, b) => {
      if (a.urgency === "CRITICAL" && b.urgency !== "CRITICAL") return -1;
      if (b.urgency === "CRITICAL" && a.urgency !== "CRITICAL") return 1;
      return b.suggestedQty - a.suggestedQty;
    });
}
