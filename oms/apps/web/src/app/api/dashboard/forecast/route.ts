import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/dashboard/forecast - Get demand forecast
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const forecastDays = parseInt(searchParams.get("days") || "30");
    const skuId = searchParams.get("skuId");

    const now = new Date();

    // Get historical data (last 90 days)
    const historicalDays = 90;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - historicalDays);

    // Query historical order data
    const orderItemsWhere: Record<string, unknown> = {
      Order: {
        createdAt: { gte: startDate },
        status: { notIn: ["CANCELLED", "FAILED"] },
      },
    };

    if (skuId) {
      orderItemsWhere.skuId = skuId;
    }

    const historicalData = await prisma.orderItem.findMany({
      where: orderItemsWhere,
      select: {
        skuId: true,
        quantity: true,
        Order: {
          select: { createdAt: true },
        },
        SKU: {
          select: { code: true },
        },
      },
    });

    // Aggregate by SKU and date
    const skuDailyDemand = new Map<
      string,
      { sku: string; dailyDemand: Map<string, number> }
    >();

    for (const item of historicalData) {
      const skuKey = item.skuId;
      const dateKey = item.Order.createdAt.toISOString().split("T")[0];

      if (!skuDailyDemand.has(skuKey)) {
        skuDailyDemand.set(skuKey, {
          sku: item.SKU?.code || skuKey,
          dailyDemand: new Map(),
        });
      }

      const skuData = skuDailyDemand.get(skuKey)!;
      skuData.dailyDemand.set(
        dateKey,
        (skuData.dailyDemand.get(dateKey) || 0) + item.quantity
      );
    }

    // Calculate forecast for each SKU
    const forecasts: Array<{
      skuId: string;
      skuCode: string;
      historical: {
        avgDailyDemand: number;
        totalDemand: number;
        daysCovered: number;
      };
      forecast: {
        days: number;
        expectedDemand: number;
        lowEstimate: number;
        highEstimate: number;
      };
      trend: {
        direction: "up" | "down" | "stable";
        percentChange: number;
      };
      stockStatus: {
        currentStock: number;
        daysOfStock: number;
        reorderPoint: number;
        suggestedReorder: number;
      } | null;
    }> = [];

    for (const [skuKey, data] of skuDailyDemand.entries()) {
      const dailyValues = Array.from(data.dailyDemand.values());
      const totalDemand = dailyValues.reduce((a, b) => a + b, 0);
      const avgDailyDemand = totalDemand / historicalDays;

      // Simple linear regression for trend
      const sortedDates = Array.from(data.dailyDemand.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      // Split into first and second half for trend
      const midPoint = Math.floor(sortedDates.length / 2);
      const firstHalf = sortedDates.slice(0, midPoint);
      const secondHalf = sortedDates.slice(midPoint);

      const firstAvg =
        firstHalf.length > 0
          ? firstHalf.reduce((sum, [, val]) => sum + val, 0) / firstHalf.length
          : 0;
      const secondAvg =
        secondHalf.length > 0
          ? secondHalf.reduce((sum, [, val]) => sum + val, 0) / secondHalf.length
          : 0;

      const trendDirection =
        secondAvg > firstAvg * 1.1
          ? "up"
          : secondAvg < firstAvg * 0.9
          ? "down"
          : "stable";

      const percentChange =
        firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

      // Forecast calculation with trend adjustment
      const trendMultiplier =
        trendDirection === "up"
          ? 1 + percentChange / 200
          : trendDirection === "down"
          ? 1 + percentChange / 200
          : 1;

      const expectedDemand = Math.round(avgDailyDemand * forecastDays * trendMultiplier);

      // Calculate variance for confidence intervals
      const variance =
        dailyValues.length > 1
          ? dailyValues.reduce((sum, val) => sum + Math.pow(val - avgDailyDemand, 2), 0) /
            (dailyValues.length - 1)
          : 0;
      const stdDev = Math.sqrt(variance);

      const lowEstimate = Math.max(
        0,
        Math.round(expectedDemand - 1.96 * stdDev * Math.sqrt(forecastDays))
      );
      const highEstimate = Math.round(
        expectedDemand + 1.96 * stdDev * Math.sqrt(forecastDays)
      );

      // Get current stock
      let stockStatus = null;
      if (skuId || skuDailyDemand.size <= 20) {
        const inventory = await prisma.inventory.aggregate({
          where: { skuId: skuKey },
          _sum: { quantity: true, reservedQty: true },
        });

        const currentStock =
          Number(inventory._sum.quantity || 0) - Number(inventory._sum.reservedQty || 0);
        const daysOfStock = avgDailyDemand > 0 ? Math.round(currentStock / avgDailyDemand) : 999;
        const safetyStock = Math.ceil(avgDailyDemand * 7); // 7 days safety stock
        const reorderPoint = Math.ceil(avgDailyDemand * 14); // 14 days lead time
        const suggestedReorder = Math.max(0, reorderPoint - currentStock + safetyStock);

        stockStatus = {
          currentStock,
          daysOfStock,
          reorderPoint,
          suggestedReorder: Math.ceil(suggestedReorder),
        };
      }

      forecasts.push({
        skuId: skuKey,
        skuCode: data.sku,
        historical: {
          avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
          totalDemand,
          daysCovered: sortedDates.length,
        },
        forecast: {
          days: forecastDays,
          expectedDemand,
          lowEstimate,
          highEstimate,
        },
        trend: {
          direction: trendDirection,
          percentChange,
        },
        stockStatus,
      });
    }

    // Sort by expected demand
    forecasts.sort((a, b) => b.forecast.expectedDemand - a.forecast.expectedDemand);

    // Take top SKUs if no specific SKU requested
    const topForecasts = skuId ? forecasts : forecasts.slice(0, 50);

    // Calculate overall summary
    const totalExpectedDemand = topForecasts.reduce(
      (sum, f) => sum + f.forecast.expectedDemand,
      0
    );

    const skusNeedingReorder = topForecasts.filter(
      (f) => f.stockStatus && f.stockStatus.currentStock < f.stockStatus.reorderPoint
    ).length;

    return NextResponse.json({
      forecastPeriod: {
        days: forecastDays,
        startDate: now.toISOString().split("T")[0],
        endDate: new Date(now.getTime() + forecastDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      },
      historicalPeriod: {
        days: historicalDays,
        startDate: startDate.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
      },
      forecasts: topForecasts,
      summary: {
        totalSKUs: topForecasts.length,
        totalExpectedDemand,
        skusNeedingReorder,
        skusTrendingUp: topForecasts.filter((f) => f.trend.direction === "up").length,
        skusTrendingDown: topForecasts.filter((f) => f.trend.direction === "down")
          .length,
      },
    });
  } catch (error) {
    console.error("Error generating forecast:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}
