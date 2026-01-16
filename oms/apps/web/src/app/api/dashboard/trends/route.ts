import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/dashboard/trends - Get trend data for charts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d, 365d
    const metric = searchParams.get("metric") || "orders"; // orders, revenue, returns, inventory

    // Calculate date range
    const now = new Date();
    const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "365d" ? 365 : 30;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Generate date labels
    const dateLabels: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      dateLabels.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let trendData: { date: string; value: number }[] = [];

    switch (metric) {
      case "orders": {
        const orders = await prisma.order.groupBy({
          by: ["createdAt"],
          where: {
            createdAt: { gte: startDate },
          },
          _count: true,
        });

        // Aggregate by date
        const ordersByDate = new Map<string, number>();
        for (const order of orders) {
          const date = order.createdAt.toISOString().split("T")[0];
          ordersByDate.set(date, (ordersByDate.get(date) || 0) + order._count);
        }

        trendData = dateLabels.map((date) => ({
          date,
          value: ordersByDate.get(date) || 0,
        }));
        break;
      }

      case "revenue": {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: startDate },
            status: { notIn: ["CANCELLED"] },
          },
          select: {
            createdAt: true,
            totalAmount: true,
          },
        });

        // Aggregate by date
        const revenueByDate = new Map<string, number>();
        for (const order of orders) {
          const date = order.createdAt.toISOString().split("T")[0];
          revenueByDate.set(
            date,
            (revenueByDate.get(date) || 0) + Number(order.totalAmount || 0)
          );
        }

        trendData = dateLabels.map((date) => ({
          date,
          value: Math.round(revenueByDate.get(date) || 0),
        }));
        break;
      }

      case "returns": {
        const returns = await prisma.return.groupBy({
          by: ["createdAt"],
          where: {
            createdAt: { gte: startDate },
          },
          _count: true,
        });

        const returnsByDate = new Map<string, number>();
        for (const ret of returns) {
          const date = ret.createdAt.toISOString().split("T")[0];
          returnsByDate.set(date, (returnsByDate.get(date) || 0) + ret._count);
        }

        trendData = dateLabels.map((date) => ({
          date,
          value: returnsByDate.get(date) || 0,
        }));
        break;
      }

      case "inventory": {
        // For inventory, we show the current snapshot - historical data would need inventory snapshots
        const totalInventory = await prisma.inventory.aggregate({
          _sum: { quantity: true },
        });

        trendData = dateLabels.map((date, index) => ({
          date,
          value: index === dateLabels.length - 1 ? Number(totalInventory._sum.quantity || 0) : 0,
        }));
        break;
      }
    }

    // Calculate statistics
    const values = trendData.map((t) => t.value);
    const total = values.reduce((a, b) => a + b, 0);
    const average = values.length > 0 ? total / values.length : 0;
    const max = Math.max(...values);
    const min = Math.min(...values);

    // Calculate trend direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const trendDirection = secondAvg > firstAvg ? "up" : secondAvg < firstAvg ? "down" : "flat";
    const trendPercent = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

    return NextResponse.json({
      metric,
      period,
      data: trendData,
      statistics: {
        total,
        average: Math.round(average * 100) / 100,
        max,
        min,
        trendDirection,
        trendPercent,
      },
    });
  } catch (error) {
    console.error("Error fetching trend data:", error);
    return NextResponse.json(
      { error: "Failed to fetch trend data" },
      { status: 500 }
    );
  }
}
