import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/returns - Get returns analytics for client portal
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

    // Fetch returns
    const returns = await prisma.return.findMany({
      where: {
        initiatedAt: { gte: startDate },
        ...(companyId ? { Order_Return_orderIdToOrder: { Location: { companyId } } } : {}),
      },
      include: {
        ReturnItem: true,
        Order_Return_orderIdToOrder: true,
      },
    });

    // Fetch SKU data for all return items
    const skuIds = [...new Set(returns.flatMap((r) => r.ReturnItem.map((i) => i.skuId)))];
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, code: true, name: true },
    });
    const skuMap = new Map(skus.map((s) => [s.id, s]));

    // Summary
    const totalReturns = returns.length;
    const rtoReturns = returns.filter((r) => r.type === "RTO").length;
    const rtoPercent = totalReturns > 0 ? (rtoReturns / totalReturns) * 100 : 0;
    const returnQty = returns.reduce(
      (sum, r) => sum + r.ReturnItem.reduce((isum, i) => isum + i.quantity, 0),
      0
    );
    const returnAmount = returns.reduce(
      (sum, r) => sum + Number(r.refundAmount || 0),
      0
    );

    // Average return days
    const returnDays = returns
      .filter((r) => r.Order_Return_orderIdToOrder)
      .map((r) => {
        const orderDate = new Date(r.Order_Return_orderIdToOrder!.orderDate);
        const returnDate = new Date(r.initiatedAt);
        return Math.ceil(
          (returnDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      });
    const avgReturnDays =
      returnDays.length > 0
        ? Math.round(returnDays.reduce((sum, d) => sum + d, 0) / returnDays.length)
        : 0;

    // Returns by date
    const returnsByDateMap = new Map<
      string,
      { count: number; quantity: number }
    >();
    returns.forEach((r) => {
      const dateKey = new Date(r.initiatedAt).toISOString().split("T")[0];
      const existing = returnsByDateMap.get(dateKey) || { count: 0, quantity: 0 };
      const itemQty = r.ReturnItem.reduce((sum, i) => sum + i.quantity, 0);
      returnsByDateMap.set(dateKey, {
        count: existing.count + 1,
        quantity: existing.quantity + itemQty,
      });
    });
    const returnsByDate = Array.from(returnsByDateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Returns by reason
    const returnsByReasonMap = new Map<string, number>();
    returns.forEach((r) => {
      const reason = r.reason || "Not Specified";
      returnsByReasonMap.set(reason, (returnsByReasonMap.get(reason) || 0) + 1);
    });
    const returnsByReason = Array.from(returnsByReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Returns by type
    const returnsByTypeMap = new Map<
      string,
      { count: number; amount: number }
    >();
    returns.forEach((r) => {
      const existing = returnsByTypeMap.get(r.type) || { count: 0, amount: 0 };
      returnsByTypeMap.set(r.type, {
        count: existing.count + 1,
        amount: existing.amount + Number(r.refundAmount || 0),
      });
    });
    const returnsByType = Array.from(returnsByTypeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);

    // Top returned SKUs
    const skuReturnMap = new Map<
      string,
      { skuCode: string; skuName: string; quantity: number }
    >();
    returns.forEach((r) => {
      r.ReturnItem.forEach((item) => {
        const key = item.skuId;
        const sku = skuMap.get(item.skuId);
        const existing = skuReturnMap.get(key) || {
          skuCode: sku?.code || item.skuId,
          skuName: sku?.name || "Unknown",
          quantity: 0,
        };
        skuReturnMap.set(key, {
          ...existing,
          quantity: existing.quantity + item.quantity,
        });
      });
    });
    const topReturnedSkus = Array.from(skuReturnMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalReturns,
        rtoPercent,
        returnQty,
        returnAmount,
        avgReturnDays,
      },
      returnsByDate,
      returnsByReason,
      returnsByType,
      topReturnedSkus,
    });
  } catch (error) {
    console.error("Error fetching returns data:", error);
    return NextResponse.json(
      { error: "Failed to fetch returns data" },
      { status: 500 }
    );
  }
}
