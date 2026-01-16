import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/dashboard - Get dashboard statistics for client portal
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

    // Fetch all orders in the date range
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: startDate },
        ...(companyId ? { Location: { companyId } } : {}),
      },
      include: {
        OrderItem: true,
        Delivery: true,
      },
    });

    // Calculate sales statistics
    const totalOrders = orders.length;
    const totalOrderLines = orders.reduce((sum, o) => sum + o.OrderItem.length, 0);
    const totalOrderQuantity = orders.reduce(
      (sum, o) => sum + o.OrderItem.reduce((isum, i) => isum + i.quantity, 0),
      0
    );

    // Distinct SKUs sold
    const skuIds = new Set<string>();
    orders.forEach((o) => o.OrderItem.forEach((i) => skuIds.add(i.skuId)));
    const distinctSkuSold = skuIds.size;

    const avgLinesPerOrder = totalOrders > 0 ? totalOrderLines / totalOrders : 0;

    const totalOrderAmount = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0
    );
    const avgOrderAmount = totalOrders > 0 ? totalOrderAmount / totalOrders : 0;

    const codOrders = orders.filter((o) => o.paymentMode === "COD").length;
    const codOrdersPercent = totalOrders > 0 ? (codOrders / totalOrders) * 100 : 0;

    const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount), 0);

    // Pending orders (not yet shipped)
    const pendingStatuses = [
      "CREATED",
      "CONFIRMED",
      "ALLOCATED",
      "PARTIALLY_ALLOCATED",
      "PICKLIST_GENERATED",
      "PICKING",
      "PICKED",
      "PACKING",
      "PACKED",
    ];
    const pendingOrders = orders.filter((o) => pendingStatuses.includes(o.status));
    const totalPendingOrders = pendingOrders.length;

    // Unfulfillable orders (those with insufficient inventory)
    const unfulfillableOrders = orders.filter(
      (o) => o.status === "PARTIALLY_ALLOCATED" || o.status === "ON_HOLD"
    );
    const totalUnfulfillable = unfulfillableOrders.length;
    const unfulfillableLineLevel = unfulfillableOrders.reduce(
      (sum, o) => sum + o.OrderItem.filter((i) => i.allocatedQty < i.quantity).length,
      0
    );

    // SLA breached orders
    const slaBreachedOrders = orders.filter(
      (o) =>
        o.promisedDate &&
        new Date(o.promisedDate) < now &&
        !["DELIVERED", "CANCELLED"].includes(o.status)
    ).length;

    // Failed/cancelled orders
    const totalFailedOrders = orders.filter((o) => o.status === "CANCELLED").length;

    // Fulfillment statistics
    const pendingPicklist = orders.filter(
      (o) => o.status === "ALLOCATED" || o.status === "CONFIRMED"
    ).length;
    const picklistedPendingPick = orders.filter(
      (o) => o.status === "PICKLIST_GENERATED"
    ).length;
    const pickedPendingPack = orders.filter(
      (o) => o.status === "PICKED" || o.status === "PICKING"
    ).length;
    const packedPendingManifest = orders.filter((o) => o.status === "PACKED").length;
    const manifestedPendingShip = orders.filter(
      (o) => o.status === "MANIFESTED"
    ).length;

    // Inventory statistics
    const inventoryData = await prisma.inventory.aggregate({
      _sum: {
        quantity: true,
        reservedQty: true,
      },
      where: companyId ? { Location: { companyId } } : {},
    });

    const totalSaleableQty = (inventoryData._sum.quantity || 0) - (inventoryData._sum.reservedQty || 0);
    const totalInprocessQty = inventoryData._sum.reservedQty || 0;

    // Get damaged inventory from damaged zone
    const damagedInventory = await prisma.inventory.aggregate({
      _sum: { quantity: true },
      where: {
        Bin: { Zone: { type: "DAMAGED" } },
        ...(companyId ? { Location: { companyId } } : {}),
      },
    });
    const totalDamagedQty = damagedInventory._sum.quantity || 0;

    // Distinct SKUs in stock
    const skusInStock = await prisma.inventory.groupBy({
      by: ["skuId"],
      where: {
        quantity: { gt: 0 },
        ...(companyId ? { Location: { companyId } } : {}),
      },
    });
    const distinctSkuInStock = skusInStock.length;

    // Total SKUs
    const totalSkus = await prisma.sKU.count({
      where: companyId ? { companyId } : {},
    });
    const skuInStockPercent = totalSkus > 0 ? (distinctSkuInStock / totalSkus) * 100 : 0;

    // Returns statistics
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

    // Average return days (from order date to return initiation)
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
        ? returnDays.reduce((sum, d) => sum + d, 0) / returnDays.length
        : 0;

    // Build response
    const response = {
      sales: {
        totalOrders,
        totalOrderLines,
        totalOrderQuantity,
        distinctSkuSold,
        avgLinesPerOrder,
        totalOrderAmount,
        avgOrderAmount,
        codOrdersPercent,
        totalDiscount,
        orderQtyPendingStock: totalInprocessQty,
        totalPendingOrders,
        unfulfillableLineLevel,
        totalUnfulfillable,
        slaBreachedOrders,
        totalFailedOrders,
      },
      fulfillment: {
        pendingPicklist,
        picklistedPendingPick,
        pickedPendingPack,
        packedPendingManifest,
        manifestedPendingShip,
      },
      inventory: {
        totalSaleableQty,
        totalDamagedQty,
        totalInprocessQty,
        distinctSkuInStock,
        skuInStockPercent,
      },
      returns: {
        totalReturns,
        rtoPercent,
        returnQty,
        returnAmount,
        avgReturnDays: Math.round(avgReturnDays),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching client dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
