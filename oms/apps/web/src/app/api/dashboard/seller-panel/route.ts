import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/dashboard/seller-panel - Get seller panel dashboard statistics (Vinculum style)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7"; // days
    const locationId = searchParams.get("locationId") || "";

    // Calculate date range
    const now = new Date();
    const daysAgo = parseInt(period) || 7;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysAgo);
    startDate.setHours(0, 0, 0, 0);

    // Build location filter for Prisma queries
    const locationFilter: Record<string, unknown> = {};
    if (locationId) {
      locationFilter.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      locationFilter.locationId = { in: session.user.locationAccess };
    }

    // Parallel queries for all dashboard metrics
    const [
      // Order counts and totals
      totalOrdersData,
      orderItemsStats,
      distinctSkuSold,

      // Financial metrics
      financialStats,
      codOrdersCount,

      // Pending and unfulfillable orders
      pendingOrders,
      unfulfillableOrders,
      unfulfillableLineItems,

      // SLA and failed orders
      slaBreachedOrders,
      failedOrders,

      // Inventory pending stock
      pendingStockQty,
    ] = await Promise.all([
      // Total Orders
      prisma.order.count({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
        },
      }),

      // Order Items stats (total lines, total quantity)
      prisma.orderItem.aggregate({
        where: {
          Order: {
            ...locationFilter,
            createdAt: { gte: startDate },
          },
        },
        _count: { _all: true },
        _sum: { quantity: true },
      }),

      // Distinct SKU sold
      prisma.orderItem.groupBy({
        by: ["skuId"],
        where: {
          Order: {
            ...locationFilter,
            createdAt: { gte: startDate },
            status: { notIn: ["CANCELLED"] },
          },
        },
      }),

      // Financial stats (total amount, discount)
      prisma.order.aggregate({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
          status: { notIn: ["CANCELLED"] },
        },
        _sum: {
          totalAmount: true,
          discount: true,
        },
        _count: { _all: true },
      }),

      // COD orders count
      prisma.order.count({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
          paymentMode: "COD",
        },
      }),

      // Pending orders (not yet processed)
      prisma.order.count({
        where: {
          ...locationFilter,
          status: { in: ["CREATED", "CONFIRMED", "ON_HOLD"] },
        },
      }),

      // Unfulfillable orders (partially allocated or no stock)
      prisma.order.count({
        where: {
          ...locationFilter,
          status: { in: ["PARTIALLY_ALLOCATED"] },
        },
      }),

      // Unfulfillable line level items
      prisma.orderItem.count({
        where: {
          Order: locationFilter,
          status: "PENDING",
          allocatedQty: 0,
        },
      }),

      // SLA breached orders (past promised date and not delivered)
      prisma.order.count({
        where: {
          ...locationFilter,
          promisedDate: { lt: now },
          status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
        },
      }),

      // Failed/Cancelled orders
      prisma.order.count({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
          status: "CANCELLED",
        },
      }),

      // Order quantity with pending stock (items with 0 allocation)
      prisma.orderItem.aggregate({
        where: {
          Order: {
            ...locationFilter,
            status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED", "SHIPPED"] },
          },
          allocatedQty: 0,
        },
        _sum: { quantity: true },
      }),
    ]);

    // Get chart data using Prisma groupBy (more reliable than raw SQL)
    const ordersByDate = await prisma.order.groupBy({
      by: ["orderDate"],
      where: {
        ...locationFilter,
        createdAt: { gte: startDate },
      },
      _count: { _all: true },
      orderBy: { orderDate: "asc" },
    });

    // For order line count by date, we need to join through orders
    // Get all orders with their item counts
    const ordersWithItemCounts = await prisma.order.findMany({
      where: {
        ...locationFilter,
        createdAt: { gte: startDate },
      },
      select: {
        orderDate: true,
        _count: { select: { OrderItem: true } },
      },
    });

    // Aggregate order line counts by date
    const orderLinesByDateMap = new Map<string, number>();
    ordersWithItemCounts.forEach((order) => {
      const dateKey = order.orderDate.toISOString().split("T")[0];
      const currentCount = orderLinesByDateMap.get(dateKey) || 0;
      orderLinesByDateMap.set(dateKey, currentCount + order._count.OrderItem);
    });

    // Calculate derived metrics
    const totalOrders = totalOrdersData;
    const totalOrderLines = orderItemsStats._count._all;
    const totalOrderQuantity = Number(orderItemsStats._sum.quantity || 0);
    const distinctSkuCount = distinctSkuSold.length;
    const avgLinesPerOrder = totalOrders > 0 ? Math.round((totalOrderLines / totalOrders) * 100) / 100 : 0;

    const totalOrderAmount = Number(financialStats._sum.totalAmount || 0);
    const validOrderCount = financialStats._count._all;
    const avgOrderAmount = validOrderCount > 0 ? Math.round(totalOrderAmount / validOrderCount) : 0;
    const codPercentage = totalOrders > 0 ? Math.round((codOrdersCount / totalOrders) * 10000) / 100 : 0;
    const totalDiscount = Number(financialStats._sum.discount || 0);
    const orderQtyPendingStock = Number(pendingStockQty._sum.quantity || 0);

    // Format chart data and fill missing dates
    const orderCountByDate = fillMissingDates(
      ordersByDate.map((item) => ({
        date: item.orderDate.toISOString().split("T")[0],
        count: item._count._all,
      })),
      startDate,
      now
    );

    const orderLineCountByDate = fillMissingDates(
      Array.from(orderLinesByDateMap.entries()).map(([date, count]) => ({
        date,
        count,
      })),
      startDate,
      now
    );

    return NextResponse.json({
      // Row 1: Order Volume Metrics
      totalOrders,
      totalOrderLines,
      totalOrderQuantity,
      distinctSkuSold: distinctSkuCount,
      avgLinesPerOrder,

      // Row 2: Financial Metrics
      totalOrderAmount,
      avgOrderAmount,
      codPercentage,
      totalDiscount,
      orderQtyPendingStock,

      // Row 3: Order Status Metrics
      totalPendingOrder: pendingOrders,
      unfulfillableLineLevelOrder: unfulfillableLineItems,
      totalUnfulfillableOrder: unfulfillableOrders,
      totalSlaBreachedOrder: slaBreachedOrders,
      totalFailedOrder: failedOrders,

      // Charts data
      orderCountByDate,
      orderLineCountByDate,

      // Metadata
      period: daysAgo,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching seller panel dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Helper function to fill missing dates in chart data
function fillMissingDates(
  data: { date: string; count: number }[],
  startDate: Date,
  endDate: Date
): { date: string; count: number }[] {
  const dateMap = new Map(data.map((d) => [d.date, d.count]));
  const result: { date: string; count: number }[] = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    result.push({
      date: dateStr,
      count: dateMap.get(dateStr) || 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}
