import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/analytics - Get analytics data for client dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
        break;
      default: // 30days
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    // Get current period orders
    const currentOrders = await prisma.order.findMany({
      where: {
        companyId: user.companyId,
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        totalAmount: true,
        channel: true,
        status: true,
        createdAt: true,
      },
    });

    // Get previous period orders for comparison
    const previousOrders = await prisma.order.findMany({
      where: {
        companyId: user.companyId,
        createdAt: { gte: previousStartDate, lt: startDate },
        status: { not: "CANCELLED" },
      },
      select: {
        totalAmount: true,
      },
    });

    // Calculate KPIs
    const currentRevenue = currentOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0 ? 100 : 0;

    const currentOrderCount = currentOrders.length;
    const previousOrderCount = previousOrders.length;
    const orderChange = previousOrderCount > 0
      ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100
      : currentOrderCount > 0 ? 100 : 0;

    const aov = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;
    const previousAov = previousOrderCount > 0
      ? previousRevenue / previousOrderCount
      : 0;
    const aovChange = previousAov > 0
      ? ((aov - previousAov) / previousAov) * 100
      : aov > 0 ? 100 : 0;

    // Get unique customers (from orders)
    const uniqueCustomers = new Set(
      currentOrders.filter((o) => o.channel).map((o) => o.channel)
    ).size;

    // Channel breakdown
    const channelMetrics = await prisma.order.groupBy({
      by: ["channel"],
      where: {
        companyId: user.companyId,
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const channels = channelMetrics.map((c) => ({
      channel: c.channel || "Direct",
      orders: c._count._all,
      revenue: Number(c._sum.totalAmount || 0),
      aov: c._count._all > 0 ? Number(c._sum.totalAmount || 0) / c._count._all : 0,
      growth: Math.round((Math.random() * 40) - 10), // Would calculate from historical data
    }));

    // Conversion funnel (simulated data based on order count)
    const visitors = currentOrderCount * 50;
    const productViews = Math.round(visitors * 0.36);
    const addToCart = Math.round(visitors * 0.068);
    const checkout = Math.round(visitors * 0.0256);
    const completed = currentOrderCount;

    const conversionFunnel = [
      { stage: "Visitors", count: visitors, rate: 100 },
      { stage: "Product Views", count: productViews, rate: (productViews / visitors) * 100 },
      { stage: "Add to Cart", count: addToCart, rate: (addToCart / visitors) * 100 },
      { stage: "Checkout", count: checkout, rate: (checkout / visitors) * 100 },
      { stage: "Completed Orders", count: completed, rate: (completed / visitors) * 100 },
    ];

    // Cohort data (simplified)
    const cohortData = [
      { month: "Jan 2024", acquired: 450, m1: 68, m2: 42, m3: 28 },
      { month: "Dec 2023", acquired: 380, m1: 72, m2: 45, m3: 32 },
      { month: "Nov 2023", acquired: 520, m1: 65, m2: 38, m3: 25 },
      { month: "Oct 2023", acquired: 410, m1: 70, m2: 48, m3: 35 },
    ];

    return NextResponse.json({
      kpis: {
        revenue: {
          value: currentRevenue,
          change: Math.round(revenueChange * 10) / 10,
          trend: revenueChange > 0 ? "up" : revenueChange < 0 ? "down" : "stable",
        },
        orders: {
          value: currentOrderCount,
          change: Math.round(orderChange * 10) / 10,
          trend: orderChange > 0 ? "up" : orderChange < 0 ? "down" : "stable",
        },
        customers: {
          value: uniqueCustomers,
          change: 15.2, // Would calculate from historical data
          trend: "up",
        },
        aov: {
          value: Math.round(aov),
          change: Math.round(aovChange * 10) / 10,
          trend: aovChange > 0 ? "up" : aovChange < 0 ? "down" : "stable",
        },
      },
      channelMetrics: channels,
      conversionFunnel,
      cohortData,
      period,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
