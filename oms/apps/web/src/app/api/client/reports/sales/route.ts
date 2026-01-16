import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/reports/sales - Get sales report data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";
    const groupBy = searchParams.get("groupBy") || "day";

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get orders for the period
    const orders = await prisma.order.findMany({
      where: {
        Location: { companyId: user.companyId },
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" },
      },
      include: {
        OrderItem: {
          include: {
            SKU: { select: { category: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by time period
    const salesByPeriod: Record<string, { date: string; orders: number; revenue: number; units: number }> = {};

    orders.forEach((order) => {
      let key: string;
      const date = new Date(order.createdAt);

      if (groupBy === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (groupBy === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!salesByPeriod[key]) {
        salesByPeriod[key] = { date: key, orders: 0, revenue: 0, units: 0 };
      }

      salesByPeriod[key].orders += 1;
      salesByPeriod[key].revenue += Number(order.totalAmount);
      salesByPeriod[key].units += order.OrderItem.reduce((sum, i) => sum + i.quantity, 0);
    });

    // Get sales by channel
    const salesByChannel = await prisma.order.groupBy({
      by: ["channel"],
      where: {
        Location: { companyId: user.companyId },
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    // Get sales by category
    const categoryMap: Record<string, { orders: number; revenue: number; units: number }> = {};
    orders.forEach((order) => {
      order.OrderItem.forEach((item) => {
        const category = item.SKU?.category || "Uncategorized";
        if (!categoryMap[category]) {
          categoryMap[category] = { orders: 0, revenue: 0, units: 0 };
        }
        categoryMap[category].orders += 1;
        categoryMap[category].revenue += Number(item.totalPrice);
        categoryMap[category].units += item.quantity;
      });
    });

    // Calculate summary
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalOrders = orders.length;
    const totalUnits = orders.reduce(
      (sum, o) => sum + o.OrderItem.reduce((s, i) => s + i.quantity, 0),
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalOrders,
        totalUnits,
        avgOrderValue: Math.round(avgOrderValue),
      },
      salesByPeriod: Object.values(salesByPeriod),
      salesByChannel: salesByChannel.map((c) => ({
        channel: c.channel || "Direct",
        orders: c._count._all,
        revenue: Number(c._sum.totalAmount || 0),
      })),
      salesByCategory: Object.entries(categoryMap).map(([category, data]) => ({
        category,
        ...data,
      })),
      period,
      groupBy,
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales report" },
      { status: 500 }
    );
  }
}
