import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/reports/returns - Get returns report data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";

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

    // Get returns for the period
    const returns = await prisma.return.findMany({
      where: {
        Order_Return_orderIdToOrder: { Location: { companyId: user.companyId } },
        createdAt: { gte: startDate },
      },
      include: {
        Order_Return_orderIdToOrder: {
          select: { id: true, orderNo: true, totalAmount: true, channel: true },
        },
        ReturnItem: true,
      },
    });

    // Fetch SKU data for all return items
    const skuIds = [...new Set(returns.flatMap((r) => r.ReturnItem.map((i) => i.skuId)))];
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, code: true, name: true, category: true },
    });
    const skuMap = new Map(skus.map((s) => [s.id, s]));

    // Get total orders for return rate calculation
    const totalOrders = await prisma.order.count({
      where: {
        Location: { companyId: user.companyId },
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" },
      },
    });

    // Calculate return metrics
    const totalReturns = returns.length;
    const returnRate = totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0;

    const totalReturnValue = returns.reduce((sum, r) => sum + Number(r.refundAmount || 0), 0);
    const avgReturnValue = totalReturns > 0 ? totalReturnValue / totalReturns : 0;

    // Returns by status
    const statusCounts = returns.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Returns by reason
    const reasonCounts = returns.reduce(
      (acc, r) => {
        const reason = r.reason || "Not Specified";
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Returns by channel
    const channelReturns = returns.reduce(
      (acc, r) => {
        const channel = r.Order_Return_orderIdToOrder?.channel || "Direct";
        if (!acc[channel]) {
          acc[channel] = { count: 0, value: 0 };
        }
        acc[channel].count += 1;
        acc[channel].value += Number(r.refundAmount || 0);
        return acc;
      },
      {} as Record<string, { count: number; value: number }>
    );

    // Top returned SKUs
    const skuReturnMap: Record<string, { code: string; name: string; count: number; units: number }> = {};
    returns.forEach((r) => {
      r.ReturnItem.forEach((item) => {
        const skuId = item.skuId;
        const sku = skuMap.get(skuId);
        if (!skuReturnMap[skuId]) {
          skuReturnMap[skuId] = {
            code: sku?.code || skuId,
            name: sku?.name || "Unknown",
            count: 0,
            units: 0,
          };
        }
        skuReturnMap[skuId].count += 1;
        skuReturnMap[skuId].units += item.quantity;
      });
    });

    const topReturnedSKUs = Object.entries(skuReturnMap)
      .map(([id, data]) => ({ skuId: id, ...data }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10);

    // Returns by category
    const categoryReturns: Record<string, { count: number; units: number }> = {};
    returns.forEach((r) => {
      r.ReturnItem.forEach((item) => {
        const sku = skuMap.get(item.skuId);
        const category = sku?.category || "Uncategorized";
        if (!categoryReturns[category]) {
          categoryReturns[category] = { count: 0, units: 0 };
        }
        categoryReturns[category].count += 1;
        categoryReturns[category].units += item.quantity;
      });
    });

    // Processing time
    const processedReturns = returns.filter((r) =>
      ["RESTOCKED", "DISPOSED", "REFUNDED"].includes(r.status)
    );
    const processingTimes = processedReturns
      .filter((r) => r.processedAt)
      .map((r) => {
        const created = new Date(r.createdAt);
        const completed = new Date(r.processedAt!);
        return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      });
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    return NextResponse.json({
      summary: {
        totalReturns,
        totalReturnValue,
        avgReturnValue: Math.round(avgReturnValue),
        returnRate: Math.round(returnRate * 10) / 10,
        avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
        pendingReturns: (statusCounts["INITIATED"] || 0) + (statusCounts["IN_TRANSIT"] || 0) + (statusCounts["RECEIVED"] || 0),
        completedReturns: processedReturns.length,
      },
      byStatus: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / totalReturns) * 1000) / 10,
      })),
      byReason: Object.entries(reasonCounts)
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: Math.round((count / totalReturns) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count),
      byChannel: Object.entries(channelReturns).map(([channel, data]) => ({
        channel,
        ...data,
      })),
      byCategory: Object.entries(categoryReturns).map(([category, data]) => ({
        category,
        ...data,
      })),
      topReturnedSKUs,
      period,
    });
  } catch (error) {
    console.error("Error fetching returns report:", error);
    return NextResponse.json(
      { error: "Failed to fetch returns report" },
      { status: 500 }
    );
  }
}
