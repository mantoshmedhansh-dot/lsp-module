import { NextRequest, NextResponse } from "next/server";
import { prisma, Channel } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/reports - Get various reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") || "sales"; // sales, inventory, fulfillment, returns, sku-performance
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const locationId = searchParams.get("locationId") || "";
    const channel = searchParams.get("channel") || "";
    const groupBy = searchParams.get("groupBy") || "day"; // day, week, month

    // Calculate date range
    const now = new Date();
    const startDate = fromDate ? new Date(fromDate) : new Date(now.setDate(now.getDate() - 30));
    const endDate = toDate ? new Date(toDate + "T23:59:59") : new Date();

    // Build location filter
    const locationFilter: Record<string, unknown> = {};
    if (locationId) {
      locationFilter.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      locationFilter.locationId = { in: session.user.locationAccess };
    }

    switch (reportType) {
      case "sales": {
        return await getSalesReport(startDate, endDate, locationFilter, channel, groupBy);
      }
      case "inventory": {
        return await getInventoryReport(locationFilter);
      }
      case "fulfillment": {
        return await getFulfillmentReport(startDate, endDate, locationFilter);
      }
      case "returns": {
        return await getReturnsReport(startDate, endDate);
      }
      case "sku-performance": {
        return await getSKUPerformanceReport(startDate, endDate, locationFilter);
      }
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function getSalesReport(
  startDate: Date,
  endDate: Date,
  locationFilter: Record<string, unknown>,
  channel: string,
  groupBy: string
) {
  const channelFilter = channel ? { channel: channel as Channel } : {};

  // Daily/Weekly/Monthly sales
  let dateGroup: string;
  switch (groupBy) {
    case "week":
      dateGroup = "week";
      break;
    case "month":
      dateGroup = "month";
      break;
    default:
      dateGroup = "day";
  }

  const salesTrend = await prisma.$queryRaw<{
    date: Date;
    orders: bigint;
    revenue: number;
    items: bigint;
  }[]>`
    SELECT
      DATE_TRUNC(${dateGroup}, o."orderDate") as date,
      COUNT(*)::bigint as orders,
      COALESCE(SUM(o."totalAmount"), 0)::numeric as revenue,
      COALESCE(SUM(oi.quantity), 0)::bigint as items
    FROM "Order" o
    LEFT JOIN "OrderItem" oi ON o.id = oi."orderId"
    WHERE o."orderDate" >= ${startDate}
    AND o."orderDate" <= ${endDate}
    AND o.status NOT IN ('CANCELLED')
    ${channel ? prisma.$queryRaw`AND o.channel = ${channel}` : prisma.$queryRaw``}
    GROUP BY DATE_TRUNC(${dateGroup}, o."orderDate")
    ORDER BY date ASC
  `;

  // Sales by channel
  const salesByChannel = await prisma.order.groupBy({
    by: ["channel"],
    where: {
      ...locationFilter,
      ...channelFilter,
      orderDate: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  // Sales by payment mode
  const salesByPaymentMode = await prisma.order.groupBy({
    by: ["paymentMode"],
    where: {
      ...locationFilter,
      ...channelFilter,
      orderDate: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  // Top selling SKUs
  const topSKUs = await prisma.$queryRaw<{
    skuId: string;
    skuCode: string;
    skuName: string;
    quantity: bigint;
    revenue: number;
    orders: bigint;
  }[]>`
    SELECT
      s.id as "skuId",
      s.code as "skuCode",
      s.name as "skuName",
      SUM(oi.quantity)::bigint as quantity,
      SUM(oi."totalPrice")::numeric as revenue,
      COUNT(DISTINCT o.id)::bigint as orders
    FROM "OrderItem" oi
    JOIN "Order" o ON oi."orderId" = o.id
    JOIN "SKU" s ON oi."skuId" = s.id
    WHERE o."orderDate" >= ${startDate}
    AND o."orderDate" <= ${endDate}
    AND o.status NOT IN ('CANCELLED')
    GROUP BY s.id, s.code, s.name
    ORDER BY quantity DESC
    LIMIT 10
  `;

  // Summary stats
  const summary = await prisma.order.aggregate({
    where: {
      ...locationFilter,
      ...channelFilter,
      orderDate: { gte: startDate, lte: endDate },
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
    _sum: { totalAmount: true, discount: true, shippingCharges: true, taxAmount: true },
    _avg: { totalAmount: true },
  });

  return NextResponse.json({
    reportType: "sales",
    dateRange: { from: startDate, to: endDate },
    summary: {
      totalOrders: summary._count && typeof summary._count === 'object' ? summary._count._all ?? 0 : 0,
      totalRevenue: Number(summary._sum?.totalAmount || 0),
      totalDiscount: Number(summary._sum?.discount || 0),
      totalShipping: Number(summary._sum?.shippingCharges || 0),
      totalTax: Number(summary._sum?.taxAmount || 0),
      avgOrderValue: Number(summary._avg?.totalAmount || 0),
    },
    trend: salesTrend.map((item) => ({
      date: item.date,
      orders: Number(item.orders),
      revenue: Number(item.revenue),
      items: Number(item.items),
    })),
    byChannel: salesByChannel.map((item) => ({
      channel: item.channel,
      orders: item._count && typeof item._count === 'object' ? item._count._all ?? 0 : 0,
      revenue: Number(item._sum?.totalAmount || 0),
    })),
    byPaymentMode: salesByPaymentMode.map((item) => ({
      paymentMode: item.paymentMode,
      orders: item._count && typeof item._count === 'object' ? item._count._all ?? 0 : 0,
      revenue: Number(item._sum?.totalAmount || 0),
    })),
    topSKUs: topSKUs.map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      skuName: item.skuName,
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
      orders: Number(item.orders),
    })),
  });
}

async function getInventoryReport(locationFilter: Record<string, unknown>) {
  // Inventory by zone type
  const inventoryByZone = await prisma.$queryRaw<{
    zoneType: string;
    quantity: bigint;
    skuCount: bigint;
  }[]>`
    SELECT
      z.type as "zoneType",
      COALESCE(SUM(i.quantity), 0)::bigint as quantity,
      COUNT(DISTINCT i."skuId")::bigint as "skuCount"
    FROM "Zone" z
    LEFT JOIN "Bin" b ON z.id = b."zoneId"
    LEFT JOIN "Inventory" i ON b.id = i."binId"
    GROUP BY z.type
    ORDER BY quantity DESC
  `;

  // Inventory by location
  const inventoryByLocation = await prisma.$queryRaw<{
    locationId: string;
    locationCode: string;
    locationName: string;
    quantity: bigint;
    skuCount: bigint;
  }[]>`
    SELECT
      l.id as "locationId",
      l.code as "locationCode",
      l.name as "locationName",
      COALESCE(SUM(i.quantity), 0)::bigint as quantity,
      COUNT(DISTINCT i."skuId")::bigint as "skuCount"
    FROM "Location" l
    LEFT JOIN "Inventory" i ON l.id = i."locationId"
    WHERE l."isActive" = true
    GROUP BY l.id, l.code, l.name
    ORDER BY quantity DESC
  `;

  // Low stock items
  const lowStockItems = await prisma.$queryRaw<{
    skuId: string;
    skuCode: string;
    skuName: string;
    quantity: bigint;
    reorderLevel: number;
  }[]>`
    SELECT
      s.id as "skuId",
      s.code as "skuCode",
      s.name as "skuName",
      COALESCE(SUM(i.quantity), 0)::bigint as quantity,
      s."reorderLevel"
    FROM "SKU" s
    LEFT JOIN "Inventory" i ON s.id = i."skuId"
    WHERE s."isActive" = true
    AND s."reorderLevel" IS NOT NULL
    GROUP BY s.id, s.code, s.name, s."reorderLevel"
    HAVING COALESCE(SUM(i.quantity), 0) <= s."reorderLevel"
    ORDER BY quantity ASC
    LIMIT 50
  `;

  // Out of stock items
  const outOfStockItems = await prisma.$queryRaw<{
    skuId: string;
    skuCode: string;
    skuName: string;
  }[]>`
    SELECT
      s.id as "skuId",
      s.code as "skuCode",
      s.name as "skuName"
    FROM "SKU" s
    LEFT JOIN "Inventory" i ON s.id = i."skuId"
    WHERE s."isActive" = true
    GROUP BY s.id, s.code, s.name
    HAVING COALESCE(SUM(i.quantity), 0) = 0
    LIMIT 50
  `;

  // Expiring inventory (next 30 days)
  const expiringInventory = await prisma.inventory.findMany({
    where: {
      expiryDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      quantity: { gt: 0 },
    },
    include: {
      SKU: { select: { id: true, code: true, name: true } },
      Bin: { select: { code: true, Zone: { select: { code: true, name: true } } } },
    },
    orderBy: { expiryDate: "asc" },
    take: 50,
  });

  // Summary
  const summary = await prisma.inventory.aggregate({
    _sum: { quantity: true, reservedQty: true },
  });

  const uniqueSKUs = await prisma.inventory.groupBy({
    by: ["skuId"],
    _count: { _all: true },
  });

  return NextResponse.json({
    reportType: "inventory",
    summary: {
      totalQuantity: Number(summary._sum.quantity || 0),
      reservedQuantity: Number(summary._sum.reservedQty || 0),
      availableQuantity: Number(summary._sum.quantity || 0) - Number(summary._sum.reservedQty || 0),
      uniqueSKUs: uniqueSKUs.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      expiringCount: expiringInventory.length,
    },
    byZoneType: inventoryByZone.map((item) => ({
      zoneType: item.zoneType,
      quantity: Number(item.quantity),
      skuCount: Number(item.skuCount),
    })),
    byLocation: inventoryByLocation.map((item) => ({
      locationId: item.locationId,
      locationCode: item.locationCode,
      locationName: item.locationName,
      quantity: Number(item.quantity),
      skuCount: Number(item.skuCount),
    })),
    lowStockItems: lowStockItems.map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      skuName: item.skuName,
      quantity: Number(item.quantity),
      reorderLevel: item.reorderLevel,
    })),
    outOfStockItems,
    expiringInventory,
  });
}

async function getFulfillmentReport(
  startDate: Date,
  endDate: Date,
  locationFilter: Record<string, unknown>
) {
  // Orders by status in period
  const ordersByStatus = await prisma.order.groupBy({
    by: ["status"],
    where: {
      ...locationFilter,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { _all: true },
  });

  // Daily fulfillment
  const dailyFulfillment = await prisma.$queryRaw<{
    date: Date;
    created: bigint;
    shipped: bigint;
    delivered: bigint;
  }[]>`
    SELECT
      DATE(o."createdAt") as date,
      COUNT(*) FILTER (WHERE DATE(o."createdAt") = DATE(o."createdAt"))::bigint as created,
      COUNT(*) FILTER (WHERE o.status IN ('SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'))::bigint as shipped,
      COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::bigint as delivered
    FROM "Order" o
    WHERE o."createdAt" >= ${startDate}
    AND o."createdAt" <= ${endDate}
    GROUP BY DATE(o."createdAt")
    ORDER BY date ASC
  `;

  // Average fulfillment time (order to ship)
  const fulfillmentTime = await prisma.$queryRaw<{ avgHours: number }[]>`
    SELECT
      AVG(EXTRACT(EPOCH FROM (d."shipDate" - o."createdAt")) / 3600)::numeric as "avgHours"
    FROM "Order" o
    JOIN "Delivery" d ON o.id = d."orderId"
    WHERE d."shipDate" IS NOT NULL
    AND o."createdAt" >= ${startDate}
    AND o."createdAt" <= ${endDate}
  `;

  // Average delivery time
  const deliveryTime = await prisma.$queryRaw<{ avgHours: number }[]>`
    SELECT
      AVG(EXTRACT(EPOCH FROM (d."deliveryDate" - d."shipDate")) / 3600)::numeric as "avgHours"
    FROM "Delivery" d
    WHERE d."deliveryDate" IS NOT NULL
    AND d."shipDate" IS NOT NULL
    AND d."shipDate" >= ${startDate}
    AND d."shipDate" <= ${endDate}
  `;

  // Deliveries by transporter
  const deliveriesByTransporter = await prisma.$queryRaw<{
    transporterId: string;
    transporterName: string;
    total: bigint;
    delivered: bigint;
    rto: bigint;
  }[]>`
    SELECT
      t.id as "transporterId",
      t.name as "transporterName",
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE d.status = 'DELIVERED')::bigint as delivered,
      COUNT(*) FILTER (WHERE d.status IN ('RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED'))::bigint as rto
    FROM "Delivery" d
    JOIN "Transporter" t ON d."transporterId" = t.id
    WHERE d."createdAt" >= ${startDate}
    AND d."createdAt" <= ${endDate}
    GROUP BY t.id, t.name
    ORDER BY total DESC
  `;

  // RTO analysis
  const rtoOrders = await prisma.order.count({
    where: {
      ...locationFilter,
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ["RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"] },
    },
  });

  const totalShipped = await prisma.order.count({
    where: {
      ...locationFilter,
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"] },
    },
  });

  return NextResponse.json({
    reportType: "fulfillment",
    dateRange: { from: startDate, to: endDate },
    summary: {
      avgFulfillmentTime: Math.round((fulfillmentTime[0]?.avgHours || 0) * 10) / 10,
      avgDeliveryTime: Math.round((deliveryTime[0]?.avgHours || 0) * 10) / 10,
      rtoRate: totalShipped > 0 ? Math.round((rtoOrders / totalShipped) * 10000) / 100 : 0,
      totalRTO: rtoOrders,
    },
    ordersByStatus: ordersByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count && typeof item._count === 'object' ? item._count._all ?? 0 : 0;
        return acc;
      },
      {} as Record<string, number>
    ),
    dailyFulfillment: dailyFulfillment.map((item) => ({
      date: item.date,
      created: Number(item.created),
      shipped: Number(item.shipped),
      delivered: Number(item.delivered),
    })),
    byTransporter: deliveriesByTransporter.map((item) => ({
      transporterId: item.transporterId,
      transporterName: item.transporterName,
      total: Number(item.total),
      delivered: Number(item.delivered),
      rto: Number(item.rto),
      deliveryRate: Number(item.total) > 0 ? Math.round((Number(item.delivered) / Number(item.total)) * 10000) / 100 : 0,
    })),
  });
}

async function getReturnsReport(startDate: Date, endDate: Date) {
  // Returns by type
  const returnsByType = await prisma.return.groupBy({
    by: ["type"],
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { _all: true },
  });

  // Returns by status
  const returnsByStatus = await prisma.return.groupBy({
    by: ["status"],
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { _all: true },
  });

  // Daily returns
  const dailyReturns = await prisma.$queryRaw<{
    date: Date;
    count: bigint;
    refundAmount: number;
  }[]>`
    SELECT
      DATE(r."createdAt") as date,
      COUNT(*)::bigint as count,
      COALESCE(SUM(r."refundAmount"), 0)::numeric as "refundAmount"
    FROM "Return" r
    WHERE r."createdAt" >= ${startDate}
    AND r."createdAt" <= ${endDate}
    GROUP BY DATE(r."createdAt")
    ORDER BY date ASC
  `;

  // Top returned SKUs
  const topReturnedSKUs = await prisma.$queryRaw<{
    skuId: string;
    skuCode: string;
    skuName: string;
    quantity: bigint;
    returns: bigint;
  }[]>`
    SELECT
      s.id as "skuId",
      s.code as "skuCode",
      s.name as "skuName",
      COALESCE(SUM(ri.quantity), 0)::bigint as quantity,
      COUNT(DISTINCT r.id)::bigint as returns
    FROM "ReturnItem" ri
    JOIN "Return" r ON ri."returnId" = r.id
    JOIN "SKU" s ON ri."skuId" = s.id
    WHERE r."createdAt" >= ${startDate}
    AND r."createdAt" <= ${endDate}
    GROUP BY s.id, s.code, s.name
    ORDER BY quantity DESC
    LIMIT 10
  `;

  // QC analysis
  const qcAnalysis = await prisma.$queryRaw<{
    qcStatus: string;
    count: bigint;
  }[]>`
    SELECT
      ri."qcStatus",
      COUNT(*)::bigint as count
    FROM "ReturnItem" ri
    JOIN "Return" r ON ri."returnId" = r.id
    WHERE r."createdAt" >= ${startDate}
    AND r."createdAt" <= ${endDate}
    AND ri."qcStatus" IS NOT NULL
    GROUP BY ri."qcStatus"
  `;

  // Summary
  const summary = await prisma.return.aggregate({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { _all: true },
    _sum: { refundAmount: true },
  });

  return NextResponse.json({
    reportType: "returns",
    dateRange: { from: startDate, to: endDate },
    summary: {
      totalReturns: summary._count && typeof summary._count === 'object' ? summary._count._all ?? 0 : 0,
      totalRefundAmount: Number(summary._sum?.refundAmount || 0),
    },
    byType: returnsByType.reduce(
      (acc, item) => {
        acc[item.type] = item._count && typeof item._count === 'object' ? item._count._all ?? 0 : 0;
        return acc;
      },
      {} as Record<string, number>
    ),
    byStatus: returnsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count && typeof item._count === 'object' ? item._count._all ?? 0 : 0;
        return acc;
      },
      {} as Record<string, number>
    ),
    dailyReturns: dailyReturns.map((item) => ({
      date: item.date,
      count: Number(item.count),
      refundAmount: Number(item.refundAmount),
    })),
    topReturnedSKUs: topReturnedSKUs.map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      skuName: item.skuName,
      quantity: Number(item.quantity),
      returns: Number(item.returns),
    })),
    qcAnalysis: qcAnalysis.reduce(
      (acc, item) => {
        acc[item.qcStatus || "PENDING"] = Number(item.count);
        return acc;
      },
      {} as Record<string, number>
    ),
  });
}

async function getSKUPerformanceReport(
  startDate: Date,
  endDate: Date,
  locationFilter: Record<string, unknown>
) {
  // SKU performance
  const skuPerformance = await prisma.$queryRaw<{
    skuId: string;
    skuCode: string;
    skuName: string;
    category: string;
    brand: string;
    orderCount: bigint;
    quantity: bigint;
    revenue: number;
    returns: bigint;
    currentStock: bigint;
  }[]>`
    SELECT
      s.id as "skuId",
      s.code as "skuCode",
      s.name as "skuName",
      s.category,
      s.brand,
      COUNT(DISTINCT o.id)::bigint as "orderCount",
      COALESCE(SUM(oi.quantity), 0)::bigint as quantity,
      COALESCE(SUM(oi."totalPrice"), 0)::numeric as revenue,
      (
        SELECT COALESCE(SUM(ri.quantity), 0)::bigint
        FROM "ReturnItem" ri
        JOIN "Return" r ON ri."returnId" = r.id
        WHERE ri."skuId" = s.id
        AND r."createdAt" >= ${startDate}
        AND r."createdAt" <= ${endDate}
      ) as returns,
      (
        SELECT COALESCE(SUM(i.quantity), 0)::bigint
        FROM "Inventory" i
        WHERE i."skuId" = s.id
      ) as "currentStock"
    FROM "SKU" s
    LEFT JOIN "OrderItem" oi ON s.id = oi."skuId"
    LEFT JOIN "Order" o ON oi."orderId" = o.id AND o."orderDate" >= ${startDate} AND o."orderDate" <= ${endDate} AND o.status NOT IN ('CANCELLED')
    WHERE s."isActive" = true
    GROUP BY s.id, s.code, s.name, s.category, s.brand
    ORDER BY revenue DESC
    LIMIT 100
  `;

  // Category performance
  const categoryPerformance = await prisma.$queryRaw<{
    category: string;
    orderCount: bigint;
    quantity: bigint;
    revenue: number;
  }[]>`
    SELECT
      COALESCE(s.category, 'Uncategorized') as category,
      COUNT(DISTINCT o.id)::bigint as "orderCount",
      COALESCE(SUM(oi.quantity), 0)::bigint as quantity,
      COALESCE(SUM(oi."totalPrice"), 0)::numeric as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON oi."orderId" = o.id
    JOIN "SKU" s ON oi."skuId" = s.id
    WHERE o."orderDate" >= ${startDate}
    AND o."orderDate" <= ${endDate}
    AND o.status NOT IN ('CANCELLED')
    GROUP BY s.category
    ORDER BY revenue DESC
  `;

  // Brand performance
  const brandPerformance = await prisma.$queryRaw<{
    brand: string;
    orderCount: bigint;
    quantity: bigint;
    revenue: number;
  }[]>`
    SELECT
      COALESCE(s.brand, 'Unbranded') as brand,
      COUNT(DISTINCT o.id)::bigint as "orderCount",
      COALESCE(SUM(oi.quantity), 0)::bigint as quantity,
      COALESCE(SUM(oi."totalPrice"), 0)::numeric as revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON oi."orderId" = o.id
    JOIN "SKU" s ON oi."skuId" = s.id
    WHERE o."orderDate" >= ${startDate}
    AND o."orderDate" <= ${endDate}
    AND o.status NOT IN ('CANCELLED')
    GROUP BY s.brand
    ORDER BY revenue DESC
    LIMIT 20
  `;

  return NextResponse.json({
    reportType: "sku-performance",
    dateRange: { from: startDate, to: endDate },
    skuPerformance: skuPerformance.map((item) => ({
      skuId: item.skuId,
      skuCode: item.skuCode,
      skuName: item.skuName,
      category: item.category,
      brand: item.brand,
      orderCount: Number(item.orderCount),
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
      returns: Number(item.returns),
      returnRate: Number(item.quantity) > 0 ? Math.round((Number(item.returns) / Number(item.quantity)) * 10000) / 100 : 0,
      currentStock: Number(item.currentStock),
    })),
    byCategory: categoryPerformance.map((item) => ({
      category: item.category,
      orderCount: Number(item.orderCount),
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
    })),
    byBrand: brandPerformance.map((item) => ({
      brand: item.brand,
      orderCount: Number(item.orderCount),
      quantity: Number(item.quantity),
      revenue: Number(item.revenue),
    })),
  });
}
