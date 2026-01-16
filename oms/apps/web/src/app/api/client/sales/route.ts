import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/sales - Get sales analytics for client portal
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "last7days";

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "last30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case "last7days":
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get user's company ID for filtering
    const companyId = session.user.companyId;

    // Fetch orders
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: startDate },
        ...(companyId ? { Location: { companyId } } : {}),
      },
      include: {
        OrderItem: {
          include: {
            SKU: { select: { code: true, name: true, category: true } },
          },
        },
      },
    });

    // Calculate summary
    const totalOrders = orders.length;
    const totalOrderLines = orders.reduce((sum, o) => sum + o.OrderItem.length, 0);
    const totalOrderQuantity = orders.reduce(
      (sum, o) => sum + o.OrderItem.reduce((isum, i) => isum + i.quantity, 0),
      0
    );
    const totalOrderAmount = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0
    );
    const avgOrderAmount = totalOrders > 0 ? totalOrderAmount / totalOrders : 0;

    // Distinct SKUs sold
    const skuIds = new Set<string>();
    orders.forEach((o) => o.OrderItem.forEach((i) => skuIds.add(i.skuId)));
    const distinctSkuSold = skuIds.size;

    // Orders by date
    const ordersByDateMap = new Map<string, { count: number; amount: number }>();
    orders.forEach((o) => {
      const dateKey = new Date(o.orderDate).toISOString().split("T")[0];
      const existing = ordersByDateMap.get(dateKey) || { count: 0, amount: 0 };
      ordersByDateMap.set(dateKey, {
        count: existing.count + 1,
        amount: existing.amount + Number(o.totalAmount),
      });
    });
    const ordersByDate = Array.from(ordersByDateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Orders by channel
    const ordersByChannelMap = new Map<string, { count: number; amount: number }>();
    orders.forEach((o) => {
      const existing = ordersByChannelMap.get(o.channel) || { count: 0, amount: 0 };
      ordersByChannelMap.set(o.channel, {
        count: existing.count + 1,
        amount: existing.amount + Number(o.totalAmount),
      });
    });
    const ordersByChannel = Array.from(ordersByChannelMap.entries())
      .map(([channel, data]) => ({ channel, ...data }))
      .sort((a, b) => b.count - a.count);

    // Top selling SKUs
    const skuSalesMap = new Map<
      string,
      { skuCode: string; skuName: string; quantity: number; amount: number }
    >();
    orders.forEach((o) => {
      o.OrderItem.forEach((item) => {
        const key = item.skuId;
        const existing = skuSalesMap.get(key) || {
          skuCode: item.SKU.code,
          skuName: item.SKU.name,
          quantity: 0,
          amount: 0,
        };
        skuSalesMap.set(key, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          amount: existing.amount + Number(item.totalPrice),
        });
      });
    });
    const topSellingSkus = Array.from(skuSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Top categories
    const categorySalesMap = new Map<
      string,
      { category: string; quantity: number; amount: number }
    >();
    orders.forEach((o) => {
      o.OrderItem.forEach((item) => {
        const category = item.SKU.category || "Uncategorized";
        const existing = categorySalesMap.get(category) || {
          category,
          quantity: 0,
          amount: 0,
        };
        categorySalesMap.set(category, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          amount: existing.amount + Number(item.totalPrice),
        });
      });
    });
    const topCategories = Array.from(categorySalesMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalOrders,
        totalOrderLines,
        totalOrderQuantity,
        totalOrderAmount,
        avgOrderAmount,
        distinctSkuSold,
      },
      ordersByDate,
      ordersByChannel,
      topSellingSkus,
      topCategories,
    });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales data" },
      { status: 500 }
    );
  }
}
