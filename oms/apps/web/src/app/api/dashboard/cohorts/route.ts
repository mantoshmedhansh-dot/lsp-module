import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/dashboard/cohorts - Get cohort analysis data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cohortType = searchParams.get("type") || "channel"; // channel, customer, sku

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    // Generate month labels
    const months: string[] = [];
    const currentMonth = new Date(sixMonthsAgo);
    while (currentMonth <= now) {
      months.push(
        `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`
      );
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    let cohortData: Array<{
      cohort: string;
      data: Array<{ month: string; orders: number; revenue: number }>;
      totals: { orders: number; revenue: number };
    }> = [];

    switch (cohortType) {
      case "channel": {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: sixMonthsAgo },
          },
          select: {
            channel: true,
            createdAt: true,
            totalAmount: true,
          },
        });

        // Group by channel
        const channelMap = new Map<
          string,
          Map<string, { orders: number; revenue: number }>
        >();

        for (const order of orders) {
          const channel = order.channel || "UNKNOWN";
          const month = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, "0")}`;

          if (!channelMap.has(channel)) {
            channelMap.set(channel, new Map());
          }

          const monthMap = channelMap.get(channel)!;
          const current = monthMap.get(month) || { orders: 0, revenue: 0 };
          current.orders++;
          current.revenue += Number(order.totalAmount || 0);
          monthMap.set(month, current);
        }

        cohortData = Array.from(channelMap.entries()).map(([channel, monthMap]) => {
          const data = months.map((month) => ({
            month,
            orders: monthMap.get(month)?.orders || 0,
            revenue: monthMap.get(month)?.revenue || 0,
          }));

          return {
            cohort: channel,
            data,
            totals: {
              orders: data.reduce((sum, d) => sum + d.orders, 0),
              revenue: data.reduce((sum, d) => sum + d.revenue, 0),
            },
          };
        });
        break;
      }

      case "customer": {
        // Get customer cohorts by first order month
        const customers = await prisma.order.groupBy({
          by: ["customerName"],
          where: {
            createdAt: { gte: sixMonthsAgo },
          },
          _count: true,
          _min: { createdAt: true },
        });

        // Group customers by acquisition month
        const acquisitionCohorts = new Map<string, string[]>();
        for (const customer of customers) {
          if (!customer._min.createdAt) continue;
          const acqMonth = `${customer._min.createdAt.getFullYear()}-${String(customer._min.createdAt.getMonth() + 1).padStart(2, "0")}`;
          const cohortCustomers = acquisitionCohorts.get(acqMonth) || [];
          if (customer.customerName) {
            cohortCustomers.push(customer.customerName);
          }
          acquisitionCohorts.set(acqMonth, cohortCustomers);
        }

        // Get orders for each cohort
        for (const [acqMonth, customerNames] of acquisitionCohorts.entries()) {
          if (customerNames.length === 0) continue;

          const cohortOrders = await prisma.order.findMany({
            where: {
              customerName: { in: customerNames },
              createdAt: { gte: sixMonthsAgo },
            },
            select: {
              createdAt: true,
              totalAmount: true,
            },
          });

          const monthMap = new Map<string, { orders: number; revenue: number }>();
          for (const order of cohortOrders) {
            const month = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, "0")}`;
            const current = monthMap.get(month) || { orders: 0, revenue: 0 };
            current.orders++;
            current.revenue += Number(order.totalAmount || 0);
            monthMap.set(month, current);
          }

          const data = months.map((month) => ({
            month,
            orders: monthMap.get(month)?.orders || 0,
            revenue: monthMap.get(month)?.revenue || 0,
          }));

          cohortData.push({
            cohort: `Acquired ${acqMonth}`,
            data,
            totals: {
              orders: data.reduce((sum, d) => sum + d.orders, 0),
              revenue: data.reduce((sum, d) => sum + d.revenue, 0),
            },
          });
        }
        break;
      }

      case "sku": {
        // Top SKUs cohort analysis
        const topSkus = await prisma.orderItem.groupBy({
          by: ["skuId"],
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 10,
        });

        for (const sku of topSkus) {
          if (!sku.skuId) continue;

          // Get SKU details for the code
          const skuDetails = await prisma.sKU.findUnique({
            where: { id: sku.skuId },
            select: { code: true },
          });

          const skuOrders = await prisma.orderItem.findMany({
            where: {
              skuId: sku.skuId,
              Order: { createdAt: { gte: sixMonthsAgo } },
            },
            include: {
              Order: {
                select: { createdAt: true },
              },
            },
          });

          const monthMap = new Map<string, { orders: number; revenue: number }>();
          for (const item of skuOrders) {
            const month = `${item.Order.createdAt.getFullYear()}-${String(item.Order.createdAt.getMonth() + 1).padStart(2, "0")}`;
            const current = monthMap.get(month) || { orders: 0, revenue: 0 };
            current.orders += item.quantity;
            current.revenue += Number(item.unitPrice) * item.quantity;
            monthMap.set(month, current);
          }

          const data = months.map((month) => ({
            month,
            orders: monthMap.get(month)?.orders || 0,
            revenue: monthMap.get(month)?.revenue || 0,
          }));

          cohortData.push({
            cohort: skuDetails?.code || sku.skuId,
            data,
            totals: {
              orders: data.reduce((sum, d) => sum + d.orders, 0),
              revenue: data.reduce((sum, d) => sum + d.revenue, 0),
            },
          });
        }
        break;
      }
    }

    // Sort by total orders
    cohortData.sort((a, b) => b.totals.orders - a.totals.orders);

    // Calculate heatmap data for visualization
    const heatmapData = cohortData.map((cohort) => ({
      cohort: cohort.cohort,
      values: cohort.data.map((d) => ({
        x: d.month,
        y: cohort.cohort,
        value: d.orders,
      })),
    }));

    return NextResponse.json({
      type: cohortType,
      months,
      cohorts: cohortData,
      heatmap: heatmapData.flatMap((h) => h.values),
      summary: {
        totalCohorts: cohortData.length,
        totalOrders: cohortData.reduce((sum, c) => sum + c.totals.orders, 0),
        totalRevenue: cohortData.reduce((sum, c) => sum + c.totals.revenue, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching cohort data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cohort data" },
      { status: 500 }
    );
  }
}
