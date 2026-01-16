import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/dashboard/sla - Get SLA metrics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    // Calculate date range
    const now = new Date();
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Get orders in period
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        promisedDate: true,
        channel: true,
        Delivery: {
          select: {
            createdAt: true,
            status: true,
            deliveryDate: true,
          },
        },
      },
    });

    // Calculate SLA metrics
    let totalOrders = orders.length;
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    let pendingOrders = 0;
    let slaBreaches = 0;

    // Processing time metrics (in hours)
    const processingTimes: number[] = [];

    // Order to ship times (in hours)
    const orderToShipTimes: number[] = [];

    // Delivery times (in days)
    const deliveryTimes: number[] = [];

    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      const expectedDate = order.promisedDate
        ? new Date(order.promisedDate)
        : null;

      // Check if order has deliveries
      if (order.Delivery.length > 0) {
        const firstDelivery = order.Delivery[0];
        const deliveryCreatedDate = new Date(firstDelivery.createdAt);

        // Order to ship time
        const orderToShip = (deliveryCreatedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        orderToShipTimes.push(orderToShip);

        // Check if delivered
        if (firstDelivery.deliveryDate) {
          const deliveredDate = new Date(firstDelivery.deliveryDate);
          const deliveryDays =
            (deliveredDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
          deliveryTimes.push(deliveryDays);

          // Check on-time vs late
          if (expectedDate) {
            if (deliveredDate <= expectedDate) {
              onTimeDeliveries++;
            } else {
              lateDeliveries++;
              slaBreaches++;
            }
          } else {
            // Default SLA: 5 days
            if (deliveryDays <= 5) {
              onTimeDeliveries++;
            } else {
              lateDeliveries++;
              slaBreaches++;
            }
          }
        } else {
          // Not yet delivered
          pendingOrders++;

          // Check if past expected date
          if (expectedDate && now > expectedDate) {
            slaBreaches++;
          }
        }
      } else {
        // No delivery yet
        pendingOrders++;

        // Check order aging for SLA breach
        const orderAge = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        if (orderAge > 24) {
          // More than 24 hours without delivery
          slaBreaches++;
        }
      }
    }

    // Calculate averages
    const avgOrderToShip =
      orderToShipTimes.length > 0
        ? orderToShipTimes.reduce((a, b) => a + b, 0) / orderToShipTimes.length
        : 0;

    const avgDeliveryTime =
      deliveryTimes.length > 0
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
        : 0;

    // Channel-wise SLA
    const channelSLA = new Map<string, { total: number; onTime: number }>();
    for (const order of orders) {
      const channel = order.channel || "UNKNOWN";
      const current = channelSLA.get(channel) || { total: 0, onTime: 0 };
      current.total++;

      if (order.Delivery.length > 0 && order.Delivery[0].deliveryDate) {
        const deliveredDate = new Date(order.Delivery[0].deliveryDate);
        const promisedDate = order.promisedDate
          ? new Date(order.promisedDate)
          : null;
        if (promisedDate && deliveredDate <= promisedDate) {
          current.onTime++;
        }
      }

      channelSLA.set(channel, current);
    }

    const channelMetrics = Array.from(channelSLA.entries()).map(([channel, data]) => ({
      channel,
      totalOrders: data.total,
      onTimeDeliveries: data.onTime,
      slaPercent: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
    }));

    // Fill rate calculation
    const orderItems = await prisma.orderItem.findMany({
      where: {
        Order: {
          createdAt: { gte: startDate },
        },
      },
      select: {
        quantity: true,
        allocatedQty: true,
      },
    });

    const totalItemsOrdered = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalItemsAllocated = orderItems.reduce(
      (sum, item) => sum + (item.allocatedQty || 0),
      0
    );
    const fillRate =
      totalItemsOrdered > 0
        ? Math.round((totalItemsAllocated / totalItemsOrdered) * 100)
        : 100;

    return NextResponse.json({
      period,
      summary: {
        totalOrders,
        onTimeDeliveries,
        lateDeliveries,
        pendingOrders,
        slaBreaches,
        onTimePercent:
          totalOrders - pendingOrders > 0
            ? Math.round(
                (onTimeDeliveries / (totalOrders - pendingOrders)) * 100
              )
            : 100,
      },
      performance: {
        avgOrderToShipHours: Math.round(avgOrderToShip * 10) / 10,
        avgDeliveryDays: Math.round(avgDeliveryTime * 10) / 10,
        fillRate,
      },
      channelMetrics,
      targets: {
        orderToShipTarget: 24, // hours
        deliveryTarget: 5, // days
        onTimeTarget: 95, // percent
        fillRateTarget: 98, // percent
      },
    });
  } catch (error) {
    console.error("Error fetching SLA metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch SLA metrics" },
      { status: 500 }
    );
  }
}
