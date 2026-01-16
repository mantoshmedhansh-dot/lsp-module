import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today"; // today, week, month, year
    const locationId = searchParams.get("locationId") || "";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 30);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(startDate);
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
        break;
      default: // today
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
    }

    // Build location filter
    const locationFilter: Record<string, unknown> = {};
    if (locationId) {
      locationFilter.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      locationFilter.locationId = { in: session.user.locationAccess };
    }

    // Parallel queries for dashboard data
    const [
      // Orders stats
      totalOrders,
      ordersToday,
      ordersByStatus,
      ordersByChannel,
      revenueData,
      previousRevenue,

      // Inventory stats
      totalInventory,
      lowStockCount,
      outOfStockCount,

      // Fulfillment stats
      pendingPicklists,
      packingOrders,
      manifestedToday,
      deliveredToday,

      // Inbound stats
      pendingInbounds,
      pendingPOs,

      // Returns stats
      pendingReturns,
      returnsToday,

      // Recent orders
      recentOrders,

      // Daily order trend (last 7 days)
      orderTrend,
    ] = await Promise.all([
      // Total orders
      prisma.order.count({ where: locationFilter }),

      // Orders today
      prisma.order.count({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
        },
      }),

      // Orders by status
      prisma.order.groupBy({
        by: ["status"],
        where: locationFilter,
        _count: { _all: true },
      }),

      // Orders by channel
      prisma.order.groupBy({
        by: ["channel"],
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),

      // Revenue in period
      prisma.order.aggregate({
        where: {
          ...locationFilter,
          createdAt: { gte: startDate },
          status: { notIn: ["CANCELLED", "RTO_DELIVERED"] },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),

      // Previous period revenue for comparison
      prisma.order.aggregate({
        where: {
          ...locationFilter,
          createdAt: { gte: previousStartDate, lt: previousEndDate },
          status: { notIn: ["CANCELLED", "RTO_DELIVERED"] },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),

      // Total inventory quantity
      prisma.inventory.aggregate({
        _sum: { quantity: true, reservedQty: true },
      }),

      // Low stock SKUs
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT i."skuId")::bigint as count
        FROM "Inventory" i
        JOIN "SKU" s ON i."skuId" = s.id
        WHERE s."reorderLevel" IS NOT NULL
        AND i.quantity <= s."reorderLevel"
        AND i.quantity > 0
      `,

      // Out of stock SKUs
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT s.id)::bigint as count
        FROM "SKU" s
        LEFT JOIN "Inventory" i ON s.id = i."skuId"
        WHERE s."isActive" = true
        GROUP BY s.id
        HAVING COALESCE(SUM(i.quantity), 0) = 0
      `,

      // Pending picklists
      prisma.picklist.count({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
      }),

      // Orders ready for packing
      prisma.order.count({
        where: {
          ...locationFilter,
          status: { in: ["PICKED", "PACKING"] },
        },
      }),

      // Manifested today
      prisma.delivery.count({
        where: {
          shipDate: { gte: startDate },
          status: { in: ["MANIFESTED", "SHIPPED"] },
        },
      }),

      // Delivered today
      prisma.delivery.count({
        where: {
          deliveryDate: { gte: startDate },
          status: "DELIVERED",
        },
      }),

      // Pending inbounds
      prisma.inbound.count({
        where: {
          ...locationFilter,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Pending POs
      prisma.purchaseOrder.count({
        where: { status: "APPROVED" },
      }),

      // Pending returns
      prisma.return.count({
        where: { status: { in: ["INITIATED", "IN_TRANSIT", "RECEIVED", "QC_PENDING"] } },
      }),

      // Returns today
      prisma.return.count({
        where: { createdAt: { gte: startDate } },
      }),

      // Recent orders
      prisma.order.findMany({
        where: locationFilter,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNo: true,
          customerName: true,
          channel: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          _count: { select: { OrderItem: true } },
        },
      }),

      // Order trend - last 7 days
      prisma.$queryRaw<{ date: Date; count: bigint; revenue: number }[]>`
        SELECT
          DATE(o."createdAt") as date,
          COUNT(*)::bigint as count,
          COALESCE(SUM(o."totalAmount"), 0)::numeric as revenue
        FROM "Order" o
        WHERE o."createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Process status counts
    const statusCountMap = ordersByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    // Process channel data
    const channelData = ordersByChannel.map((item) => ({
      channel: item.channel,
      orders: item._count._all,
      revenue: Number(item._sum.totalAmount || 0),
    }));

    // Calculate percentage changes
    const currentRevenue = Number(revenueData._sum.totalAmount || 0);
    const prevRevenue = Number(previousRevenue._sum.totalAmount || 0);
    const revenueChange = prevRevenue > 0
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : 0;

    const currentOrderCount = revenueData._count._all;
    const prevOrderCount = previousRevenue._count._all;
    const orderChange = prevOrderCount > 0
      ? ((currentOrderCount - prevOrderCount) / prevOrderCount) * 100
      : 0;

    // Process order trend
    const trendData = orderTrend.map((item) => ({
      date: item.date,
      orders: Number(item.count),
      revenue: Number(item.revenue),
    }));

    // Calculate fulfillment metrics
    const totalFulfillable = (statusCountMap["CONFIRMED"] || 0) +
                            (statusCountMap["ALLOCATED"] || 0) +
                            (statusCountMap["PICKLIST_GENERATED"] || 0);

    const fulfilledToday = deliveredToday;
    const avgOrderValue = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;

    return NextResponse.json({
      summary: {
        totalOrders,
        ordersToday,
        revenue: currentRevenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
        orderChange: Math.round(orderChange * 10) / 10,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      orders: {
        byStatus: statusCountMap,
        byChannel: channelData,
        pending: totalFulfillable,
        processing: (statusCountMap["PICKING"] || 0) + (statusCountMap["PACKING"] || 0),
        shipped: (statusCountMap["SHIPPED"] || 0) + (statusCountMap["IN_TRANSIT"] || 0),
        delivered: statusCountMap["DELIVERED"] || 0,
        cancelled: statusCountMap["CANCELLED"] || 0,
        rto: (statusCountMap["RTO_INITIATED"] || 0) + (statusCountMap["RTO_IN_TRANSIT"] || 0),
      },
      inventory: {
        totalQuantity: Number(totalInventory._sum.quantity || 0),
        reservedQuantity: Number(totalInventory._sum.reservedQty || 0),
        availableQuantity: Number(totalInventory._sum.quantity || 0) - Number(totalInventory._sum.reservedQty || 0),
        lowStockCount: Number(lowStockCount[0]?.count || 0),
        outOfStockCount: Number(outOfStockCount.length || 0),
      },
      fulfillment: {
        pendingPicklists,
        packingOrders,
        manifestedToday,
        deliveredToday,
        fulfillmentRate: totalOrders > 0 ? Math.round((deliveredToday / totalOrders) * 10000) / 100 : 0,
      },
      inbound: {
        pendingInbounds,
        pendingPOs,
      },
      returns: {
        pendingReturns,
        returnsToday,
      },
      recentOrders,
      orderTrend: trendData,
      period,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
