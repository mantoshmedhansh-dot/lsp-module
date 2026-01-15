import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/sku-performance - Get SKU performance metrics for client
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sortBy") || "revenue";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ skus: [], total: 0 });
    }

    // Build where clause for SKUs
    const skuWhere: Record<string, unknown> = {
      companyId: user.companyId,
      isActive: true,
    };

    if (search) {
      skuWhere.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      skuWhere.category = category;
    }

    // Get SKUs with aggregated order data
    const skus = await prisma.sKU.findMany({
      where: skuWhere,
      include: {
        orderItems: {
          select: {
            quantity: true,
            totalPrice: true,
            order: {
              select: { status: true, createdAt: true },
            },
          },
        },
        returnItems: {
          select: { quantity: true },
        },
      },
      skip,
      take: limit,
    });

    const total = await prisma.sKU.count({ where: skuWhere });

    // Calculate metrics for each SKU
    const skuPerformance = skus.map((sku) => {
      const completedOrders = sku.orderItems.filter(
        (item) => item.order.status === "DELIVERED"
      );

      const totalOrders = completedOrders.length;
      const totalUnits = completedOrders.reduce((sum, item) => sum + item.quantity, 0);
      const revenue = completedOrders.reduce((sum, item) => sum + Number(item.totalPrice), 0);
      const returnedUnits = sku.returnItems.reduce((sum, item) => sum + item.quantity, 0);
      const returnRate = totalUnits > 0 ? (returnedUnits / totalUnits) * 100 : 0;
      const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

      // Calculate trend (compare last 30 days vs previous 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const recentRevenue = completedOrders
        .filter((item) => item.order.createdAt >= thirtyDaysAgo)
        .reduce((sum, item) => sum + Number(item.totalPrice), 0);

      const previousRevenue = completedOrders
        .filter(
          (item) =>
            item.order.createdAt >= sixtyDaysAgo && item.order.createdAt < thirtyDaysAgo
        )
        .reduce((sum, item) => sum + Number(item.totalPrice), 0);

      const trendPercent =
        previousRevenue > 0
          ? ((recentRevenue - previousRevenue) / previousRevenue) * 100
          : recentRevenue > 0
          ? 100
          : 0;

      const trend = trendPercent > 1 ? "up" : trendPercent < -1 ? "down" : "stable";

      return {
        id: sku.id,
        code: sku.code,
        name: sku.name,
        category: sku.category || "Uncategorized",
        totalOrders,
        totalUnits,
        revenue,
        avgOrderValue: Math.round(avgOrderValue),
        returnRate: Math.round(returnRate * 10) / 10,
        trend,
        trendPercent: Math.round(trendPercent * 10) / 10,
      };
    });

    // Sort results
    const sortedSkus = skuPerformance.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number;
      const bVal = b[sortBy as keyof typeof b] as number;
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    // Get categories for filter
    const categories = await prisma.sKU.groupBy({
      by: ["category"],
      where: { companyId: user.companyId, isActive: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      skus: sortedSkus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: categories
        .filter((c) => c.category)
        .map((c) => ({ name: c.category, count: c._count._all })),
    });
  } catch (error) {
    console.error("Error fetching SKU performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch SKU performance" },
      { status: 500 }
    );
  }
}
