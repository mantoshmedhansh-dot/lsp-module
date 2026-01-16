import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/inventory - Get inventory analytics for client portal
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

    // Inventory summary
    const inventoryData = await prisma.inventory.aggregate({
      _sum: {
        quantity: true,
        reservedQty: true,
      },
      where: companyId ? { Location: { companyId } } : {},
    });

    const totalSaleableQty =
      (inventoryData._sum.quantity || 0) - (inventoryData._sum.reservedQty || 0);
    const totalInprocessQty = inventoryData._sum.reservedQty || 0;

    // Damaged inventory
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

    // Inbound by date
    const inbounds = await prisma.inbound.findMany({
      where: {
        createdAt: { gte: startDate },
        status: "COMPLETED",
        ...(companyId ? { Location: { companyId } } : {}),
      },
      include: {
        InboundItem: true,
      },
    });

    const inboundByDateMap = new Map<
      string,
      { quantity: number; skuSet: Set<string> }
    >();

    inbounds.forEach((inbound) => {
      const dateKey = new Date(inbound.createdAt).toISOString().split("T")[0];
      const existing = inboundByDateMap.get(dateKey) || {
        quantity: 0,
        skuSet: new Set<string>(),
      };

      inbound.InboundItem.forEach((item) => {
        existing.quantity += item.receivedQty;
        existing.skuSet.add(item.skuId);
      });

      inboundByDateMap.set(dateKey, existing);
    });

    const inboundByDate = Array.from(inboundByDateMap.entries())
      .map(([date, data]) => ({
        date,
        quantity: data.quantity,
        skuCount: data.skuSet.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Low stock SKUs
    const skusWithInventory = await prisma.sKU.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        reorderLevel: { not: null },
      },
      include: {
        Inventory: {
          select: { quantity: true, reservedQty: true },
        },
      },
    });

    const lowStockSkus = skusWithInventory
      .map((sku) => {
        const totalQty = sku.Inventory.reduce(
          (sum, inv) => sum + inv.quantity - inv.reservedQty,
          0
        );
        return {
          skuCode: sku.code,
          skuName: sku.name,
          quantity: totalQty,
          reorderLevel: sku.reorderLevel || 0,
        };
      })
      .filter((sku) => sku.quantity <= sku.reorderLevel)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10);

    // Inventory by location
    const locationInventory = await prisma.inventory.groupBy({
      by: ["locationId"],
      _sum: { quantity: true },
      _count: { skuId: true },
      where: {
        quantity: { gt: 0 },
        ...(companyId ? { Location: { companyId } } : {}),
      },
    });

    const locations = await prisma.location.findMany({
      where: {
        id: { in: locationInventory.map((l) => l.locationId) },
      },
      select: { id: true, name: true },
    });

    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    const inventoryByLocation = locationInventory.map((loc) => ({
      location: locationMap.get(loc.locationId) || "Unknown",
      quantity: loc._sum.quantity || 0,
      skuCount: loc._count.skuId,
    }));

    return NextResponse.json({
      summary: {
        totalSaleableQty,
        totalDamagedQty,
        totalInprocessQty,
        distinctSkuInStock,
        skuInStockPercent,
      },
      inboundByDate,
      lowStockSkus,
      inventoryByLocation,
    });
  } catch (error) {
    console.error("Error fetching inventory data:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory data" },
      { status: 500 }
    );
  }
}
