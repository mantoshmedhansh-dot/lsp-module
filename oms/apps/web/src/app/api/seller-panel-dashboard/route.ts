import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/seller-panel-dashboard - Get seller panel dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId") || "";
    const range = searchParams.get("range") || "all"; // all, last7days, last30days

    // Build location filter
    const locationFilter: Record<string, unknown> = {};
    if (locationId) {
      locationFilter.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      locationFilter.locationId = { in: session.user.locationAccess };
    }

    // Date filter based on range
    const now = new Date();
    let dateFilter: Record<string, unknown> = {};
    if (range === "last7days") {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { gte: startDate } };
    } else if (range === "last30days") {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      dateFilter = { createdAt: { gte: startDate } };
    }

    const whereClause = { ...locationFilter, ...dateFilter };

    // Parallel queries for dashboard data
    const [
      // Order counts
      totalOrders,
      totalOrderLines,
      totalOrderQuantity,
      distinctSkuSold,

      // Amount stats
      orderAmountStats,

      // COD stats
      codOrders,

      // Discount stats
      discountStats,

      // Pending stats
      pendingOrders,
      pendingStockQty,

      // Unfulfillable stats
      unfulfillableLineLevelOrders,
      unfulfillableOrders,

      // SLA and Failed
      slaBreachedOrders,
      failedOrders,

      // Daily order trend (last 7 days)
      orderTrend,

      // Daily order line trend (last 7 days)
      orderLineTrend,
    ] = await Promise.all([
      // Total Orders
      prisma.order.count({ where: whereClause }),

      // Total Order Lines
      prisma.orderItem.count({
        where: {
          Order: whereClause,
        },
      }),

      // Total Order Quantity (sum of all item quantities)
      prisma.orderItem.aggregate({
        where: {
          Order: whereClause,
        },
        _sum: { quantity: true },
      }),

      // Distinct SKU Sold
      prisma.orderItem.groupBy({
        by: ["skuId"],
        where: {
          Order: whereClause,
        },
      }),

      // Order amount stats (total and average)
      prisma.order.aggregate({
        where: whereClause,
        _sum: { totalAmount: true, discount: true },
        _avg: { totalAmount: true },
      }),

      // COD Orders count
      prisma.order.count({
        where: {
          ...whereClause,
          paymentMode: "COD",
        },
      }),

      // Total Discount
      prisma.order.aggregate({
        where: whereClause,
        _sum: { discount: true },
      }),

      // Pending Orders (not yet shipped)
      prisma.order.count({
        where: {
          ...whereClause,
          status: {
            in: ["CREATED", "CONFIRMED", "ALLOCATED", "PARTIALLY_ALLOCATED", "PICKLIST_GENERATED", "PICKING", "PICKED", "PACKING", "PACKED"],
          },
        },
      }),

      // Order Qty Pending Stock (items not yet allocated) - using raw query for comparison
      prisma.$queryRaw<{ sum: bigint | null }[]>`
        SELECT COALESCE(SUM(oi.quantity - oi."allocatedQty"), 0)::bigint as sum
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id
        WHERE o.status IN ('CREATED', 'CONFIRMED', 'PARTIALLY_ALLOCATED')
        AND oi."allocatedQty" < oi.quantity
      `,

      // Unfulfillable Line Level Orders (items with 0 allocation and inventory issue)
      prisma.orderItem.count({
        where: {
          Order: {
            ...whereClause,
            status: { in: ["CREATED", "CONFIRMED", "PARTIALLY_ALLOCATED"] },
          },
          allocatedQty: 0,
        },
      }),

      // Total Unfulfillable Orders (orders with at least one unfulfillable item)
      prisma.order.count({
        where: {
          ...whereClause,
          status: { in: ["CREATED", "CONFIRMED", "PARTIALLY_ALLOCATED"] },
          OrderItem: {
            some: {
              allocatedQty: 0,
            },
          },
        },
      }),

      // SLA Breached Orders (orders past their ship by date)
      prisma.order.count({
        where: {
          ...whereClause,
          shipByDate: { lt: now },
          status: {
            notIn: ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
          },
        },
      }),

      // Failed Orders (cancelled or RTO)
      prisma.order.count({
        where: {
          ...whereClause,
          status: { in: ["CANCELLED", "RTO_DELIVERED"] },
        },
      }),

      // Order trend - last 7 days
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT
          DATE(o."createdAt") as date,
          COUNT(*)::bigint as count
        FROM "Order" o
        WHERE o."createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
      `,

      // Order line trend - last 7 days
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT
          DATE(o."createdAt") as date,
          COUNT(oi.id)::bigint as count
        FROM "Order" o
        JOIN "OrderItem" oi ON o.id = oi."orderId"
        WHERE o."createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Calculate derived metrics
    const totalOrderLinesCount = totalOrderLines;
    const avgLinesPerOrder = totalOrders > 0 ? totalOrderLinesCount / totalOrders : 0;
    const codOrdersPercent = totalOrders > 0 ? (codOrders / totalOrders) * 100 : 0;

    // Format trend data
    const orderTrendData = orderTrend.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    const orderLineTrendData = orderLineTrend.map((item) => ({
      date: item.date,
      count: Number(item.count),
    }));

    // Fill in missing days for the last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      last7Days.push(date.toISOString().split("T")[0]);
    }

    const filledOrderTrend = last7Days.map((dateStr) => {
      const found = orderTrendData.find(
        (item) => new Date(item.date).toISOString().split("T")[0] === dateStr
      );
      return {
        date: dateStr,
        count: found ? found.count : 0,
      };
    });

    const filledOrderLineTrend = last7Days.map((dateStr) => {
      const found = orderLineTrendData.find(
        (item) => new Date(item.date).toISOString().split("T")[0] === dateStr
      );
      return {
        date: dateStr,
        count: found ? found.count : 0,
      };
    });

    return NextResponse.json({
      kpis: {
        // Row 1 - Blue cards
        totalOrders,
        totalOrderLines: totalOrderLinesCount,
        totalOrderQuantity: Number(totalOrderQuantity._sum.quantity || 0),
        distinctSkuSold: distinctSkuSold.length,
        avgLinesPerOrder: Math.round(avgLinesPerOrder * 100) / 100,

        // Row 2 - Orange/Yellow cards
        totalOrderAmount: Number(orderAmountStats._sum.totalAmount || 0),
        avgOrderAmount: Math.round(Number(orderAmountStats._avg.totalAmount || 0)),
        codOrdersPercent: Math.round(codOrdersPercent * 100) / 100,
        totalDiscount: Number(discountStats._sum.discount || 0),
        orderQtyPendingStock: Number(pendingStockQty[0]?.sum || 0),

        // Row 3 - Green/Red cards
        totalPendingOrder: pendingOrders,
        unfulfillableLineLevelOrder: unfulfillableLineLevelOrders,
        totalUnfulfillableOrder: unfulfillableOrders,
        totalSlaBreachedOrder: slaBreachedOrders,
        totalFailedOrder: failedOrders,
      },
      charts: {
        orderCountByDate: filledOrderTrend,
        orderLineCountByDate: filledOrderLineTrend,
      },
      range,
    });
  } catch (error) {
    console.error("Error fetching seller panel dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
