/**
 * Analytics Service
 *
 * Provides analytics computation for OMS dashboard and reports
 */

import { prisma, Prisma } from "@oms/database";

export interface DashboardMetrics {
  orders: {
    total: number;
    today: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    returned: number;
  };
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    averageOrderValue: number;
  };
  fulfillment: {
    fillRate: number;
    onTimeDeliveryRate: number;
    averageProcessingTime: number; // in hours
    pendingShipments: number;
  };
  inventory: {
    totalSKUs: number;
    lowStockSKUs: number;
    outOfStockSKUs: number;
    inventoryValue: number;
    inventoryTurnover: number;
  };
  channels: {
    channelName: string;
    orders: number;
    revenue: number;
    percentage: number;
  }[];
}

export interface TrendData {
  date: string;
  orders: number;
  revenue: number;
  units: number;
}

export interface SLAMetrics {
  metric: string;
  target: number;
  actual: number;
  status: "green" | "yellow" | "red";
}

export class AnalyticsService {
  /**
   * Get dashboard metrics for a company/location
   */
  async getDashboardMetrics(
    companyId?: string,
    locationId?: string
  ): Promise<DashboardMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Base where clause
    const baseWhere: Record<string, unknown> = {};
    if (companyId) baseWhere.companyId = companyId;

    // Order counts by status
    const orderCounts = await prisma.order.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    });

    const orderCountMap = orderCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    // Today's orders
    const todayOrders = await prisma.order.count({
      where: {
        ...baseWhere,
        createdAt: { gte: todayStart },
      },
    });

    // Total orders
    const totalOrders = await prisma.order.count({ where: baseWhere });

    // Revenue calculations
    const revenueData = await prisma.order.aggregate({
      where: {
        ...baseWhere,
        status: { notIn: ["CANCELLED"] },
      },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    });

    const todayRevenue = await prisma.order.aggregate({
      where: {
        ...baseWhere,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: todayStart },
      },
      _sum: { totalAmount: true },
    });

    const weekRevenue = await prisma.order.aggregate({
      where: {
        ...baseWhere,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: weekStart },
      },
      _sum: { totalAmount: true },
    });

    const monthRevenue = await prisma.order.aggregate({
      where: {
        ...baseWhere,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    });

    // Fulfillment metrics
    const deliveredOrders = await prisma.order.count({
      where: {
        ...baseWhere,
        status: "DELIVERED",
      },
    });

    const totalFulfillableOrders = await prisma.order.count({
      where: {
        ...baseWhere,
        status: { notIn: ["CANCELLED", "CREATED"] },
      },
    });

    const pendingShipments = await prisma.delivery.count({
      where: {
        status: { in: ["PENDING", "PACKED", "MANIFESTED"] as const },
      },
    });

    // Inventory metrics
    const inventoryMetrics = await this.getInventoryMetrics(locationId);

    // Channel breakdown
    const channelData = await prisma.order.groupBy({
      by: ["channel"],
      where: baseWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const totalChannelOrders = channelData.reduce((sum, c) => sum + c._count._all, 0);
    const channels = channelData.map((c) => ({
      channelName: c.channel,
      orders: c._count._all,
      revenue: Number(c._sum.totalAmount) || 0,
      percentage: totalChannelOrders > 0 ? (c._count._all / totalChannelOrders) * 100 : 0,
    }));

    return {
      orders: {
        total: totalOrders,
        today: todayOrders,
        pending: orderCountMap["PENDING"] || 0,
        processing: orderCountMap["PROCESSING"] || 0,
        shipped: orderCountMap["SHIPPED"] || 0,
        delivered: orderCountMap["DELIVERED"] || 0,
        cancelled: orderCountMap["CANCELLED"] || 0,
        returned: orderCountMap["RETURNED"] || 0,
      },
      revenue: {
        total: Number(revenueData._sum.totalAmount) || 0,
        today: Number(todayRevenue._sum.totalAmount) || 0,
        thisWeek: Number(weekRevenue._sum.totalAmount) || 0,
        thisMonth: Number(monthRevenue._sum.totalAmount) || 0,
        averageOrderValue: Number(revenueData._avg.totalAmount) || 0,
      },
      fulfillment: {
        fillRate: totalFulfillableOrders > 0
          ? (deliveredOrders / totalFulfillableOrders) * 100
          : 0,
        onTimeDeliveryRate: 85, // Placeholder - needs shipment data analysis
        averageProcessingTime: 24, // Placeholder - needs timestamp analysis
        pendingShipments,
      },
      inventory: inventoryMetrics,
      channels,
    };
  }

  /**
   * Get inventory metrics
   */
  async getInventoryMetrics(locationId?: string): Promise<{
    totalSKUs: number;
    lowStockSKUs: number;
    outOfStockSKUs: number;
    inventoryValue: number;
    inventoryTurnover: number;
  }> {
    const where: Record<string, unknown> = {};
    if (locationId) where.locationId = locationId;

    const totalSKUs = await prisma.sKU.count({ where: { isActive: true } });

    // Get SKUs with low stock (below reorder level)
    // Count SKUs where inventory is at or below reorder level
    const skusWithLowStock = await prisma.sKU.findMany({
      where: {
        isActive: true,
        reorderLevel: { not: null },
        Inventory: locationId ? { some: { locationId } } : undefined,
      },
      select: {
        id: true,
        reorderLevel: true,
        Inventory: {
          where: locationId ? { locationId } : undefined,
          select: { quantity: true },
        },
      },
    });
    const lowStockSKUs = skusWithLowStock.filter((sku) => {
      const totalQty = sku.Inventory.reduce((sum: number, inv: { quantity: number }) => sum + inv.quantity, 0);
      return totalQty <= (sku.reorderLevel || 0);
    }).length;

    // Get out of stock SKUs
    const outOfStockSKUs = await prisma.sKU.count({
      where: {
        isActive: true,
        OR: [
          {
            Inventory: {
              none: where,
            },
          },
          {
            Inventory: {
              every: {
                ...where,
                quantity: 0,
              },
            },
          },
        ],
      },
    });

    // Calculate inventory value
    const inventoryValue = await prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(i.quantity * s."costPrice"), 0) as total
      FROM "Inventory" i
      JOIN "SKU" s ON i."skuId" = s.id
      WHERE s."isActive" = true
      ${locationId ? `AND i."locationId" = ${locationId}` : ""}
    `;

    return {
      totalSKUs,
      lowStockSKUs,
      outOfStockSKUs,
      inventoryValue: Number(inventoryValue[0]?.total) || 0,
      inventoryTurnover: 4.5, // Placeholder - needs historical COGS data
    };
  }

  /**
   * Get order trends over time
   */
  async getOrderTrends(
    days: number = 30,
    companyId?: string
  ): Promise<TrendData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (companyId) where.companyId = companyId;

    // Get daily order data
    const dailyData = await prisma.$queryRaw<
      { date: Date; orders: bigint; revenue: number; units: bigint }[]
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as orders,
        COALESCE(SUM("totalAmount"), 0) as revenue,
        COALESCE(SUM((SELECT SUM(quantity) FROM "OrderItem" WHERE "orderId" = "Order".id)), 0) as units
      FROM "Order"
      WHERE "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        ${companyId ? `AND "companyId" = ${companyId}` : ""}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return dailyData.map((d) => ({
      date: d.date.toISOString().split("T")[0],
      orders: Number(d.orders),
      revenue: Number(d.revenue),
      units: Number(d.units),
    }));
  }

  /**
   * Get SLA metrics
   */
  async getSLAMetrics(companyId?: string): Promise<SLAMetrics[]> {
    const metrics: SLAMetrics[] = [];

    // Order processing SLA (target: 24 hours)
    const processingTarget = 24;
    const avgProcessingTime = 18; // Placeholder - needs actual calculation
    metrics.push({
      metric: "Order Processing Time",
      target: processingTarget,
      actual: avgProcessingTime,
      status: avgProcessingTime <= processingTarget ? "green" :
        avgProcessingTime <= processingTarget * 1.5 ? "yellow" : "red",
    });

    // On-time delivery SLA (target: 95%)
    const deliveryTarget = 95;
    const actualDeliveryRate = 92; // Placeholder
    metrics.push({
      metric: "On-Time Delivery Rate",
      target: deliveryTarget,
      actual: actualDeliveryRate,
      status: actualDeliveryRate >= deliveryTarget ? "green" :
        actualDeliveryRate >= deliveryTarget * 0.9 ? "yellow" : "red",
    });

    // Order accuracy SLA (target: 99%)
    const accuracyTarget = 99;
    const actualAccuracy = 98.5; // Placeholder
    metrics.push({
      metric: "Order Accuracy Rate",
      target: accuracyTarget,
      actual: actualAccuracy,
      status: actualAccuracy >= accuracyTarget ? "green" :
        actualAccuracy >= accuracyTarget * 0.95 ? "yellow" : "red",
    });

    // Fill rate SLA (target: 98%)
    const fillRateTarget = 98;
    const actualFillRate = 96; // Placeholder
    metrics.push({
      metric: "Inventory Fill Rate",
      target: fillRateTarget,
      actual: actualFillRate,
      status: actualFillRate >= fillRateTarget ? "green" :
        actualFillRate >= fillRateTarget * 0.95 ? "yellow" : "red",
    });

    return metrics;
  }

  /**
   * Create daily analytics snapshot
   */
  async createDailySnapshot(companyId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = await this.getDashboardMetrics(companyId);
    const trends = await this.getOrderTrends(1, companyId);

    await prisma.analyticsSnapshot.create({
      data: {
        companyId,
        snapshotDate: today,
        snapshotType: "DAILY",
        totalOrders: metrics.orders.total,
        totalRevenue: metrics.revenue.total,
        totalUnits: trends[0]?.units || 0,
        avgOrderValue: metrics.revenue.averageOrderValue,
        fillRate: metrics.fulfillment.fillRate,
        onTimeDeliveryRate: metrics.fulfillment.onTimeDeliveryRate,
        ordersCancelled: metrics.orders.cancelled,
        returnRate: metrics.orders.total > 0
          ? (metrics.orders.returned / metrics.orders.total) * 100
          : 0,
        channelBreakdown: metrics.channels,
        inventoryValue: metrics.inventory.inventoryValue,
        lowStockSKUs: metrics.inventory.lowStockSKUs,
      },
    });
  }
}

export const analyticsService = new AnalyticsService();
