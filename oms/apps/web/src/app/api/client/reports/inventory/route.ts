import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/reports/inventory - Get inventory report data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId") || "";

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      SKU: { companyId: user.companyId },
    };

    if (locationId) {
      where.locationId = locationId;
    }

    // Get all inventory
    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        SKU: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            sellingPrice: true,
            costPrice: true,
            reorderLevel: true,
          },
        },
        Location: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Calculate stock by category
    const categoryStockMap: Record<string, { units: number; value: number; skuCount: number }> = {};
    inventory.forEach((item) => {
      const category = item.SKU.category || "Uncategorized";
      const available = item.quantity - item.reservedQty;
      if (!categoryStockMap[category]) {
        categoryStockMap[category] = { units: 0, value: 0, skuCount: 0 };
      }
      categoryStockMap[category].units += available;
      categoryStockMap[category].value += available * Number(item.SKU.sellingPrice || 0);
      categoryStockMap[category].skuCount += 1;
    });

    // Calculate stock by location
    const locationStockMap: Record<string, { units: number; value: number; name: string }> = {};
    inventory.forEach((item) => {
      const locId = item.locationId;
      const available = item.quantity - item.reservedQty;
      if (!locationStockMap[locId]) {
        locationStockMap[locId] = { units: 0, value: 0, name: item.Location.name };
      }
      locationStockMap[locId].units += available;
      locationStockMap[locId].value += available * Number(item.SKU.sellingPrice || 0);
    });

    // Identify low stock items
    const lowStockItems = inventory
      .filter((item) => {
        const available = item.quantity - item.reservedQty;
        return available <= (item.SKU.reorderLevel || 10) && available > 0;
      })
      .map((item) => {
        const available = item.quantity - item.reservedQty;
        return {
          sku: { code: item.SKU.code, name: item.SKU.name },
          location: item.Location.name,
          available: available,
          reorderLevel: item.SKU.reorderLevel || 10,
          shortfall: (item.SKU.reorderLevel || 10) - available,
        };
      })
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);

    // Identify out of stock items
    const outOfStockItems = inventory
      .filter((item) => (item.quantity - item.reservedQty) === 0)
      .map((item) => ({
        sku: { code: item.SKU.code, name: item.SKU.name },
        location: item.Location.name,
        lastStockDate: item.updatedAt?.toISOString().split("T")[0],
      }))
      .slice(0, 10);

    // Calculate summary
    const totalUnits = inventory.reduce((sum, i) => sum + (i.quantity - i.reservedQty), 0);
    const totalValue = inventory.reduce(
      (sum, i) => sum + (i.quantity - i.reservedQty) * Number(i.SKU.sellingPrice || 0),
      0
    );
    const totalCost = inventory.reduce(
      (sum, i) => sum + (i.quantity - i.reservedQty) * Number(i.SKU.costPrice || 0),
      0
    );
    const uniqueSKUs = new Set(inventory.map((i) => i.skuId)).size;
    const lowStockCount = inventory.filter(
      (i) => (i.quantity - i.reservedQty) <= (i.SKU.reorderLevel || 10) && (i.quantity - i.reservedQty) > 0
    ).length;
    const outOfStockCount = inventory.filter((i) => (i.quantity - i.reservedQty) === 0).length;

    // Get locations for filter
    const locations = await prisma.location.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    return NextResponse.json({
      summary: {
        totalUnits,
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        uniqueSKUs,
        lowStockCount,
        outOfStockCount,
        healthyStockCount: uniqueSKUs - lowStockCount - outOfStockCount,
      },
      stockByCategory: Object.entries(categoryStockMap).map(([category, data]) => ({
        category,
        ...data,
      })),
      stockByLocation: Object.entries(locationStockMap).map(([id, data]) => ({
        locationId: id,
        ...data,
      })),
      lowStockItems,
      outOfStockItems,
      locations,
    });
  } catch (error) {
    console.error("Error fetching inventory report:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory report" },
      { status: 500 }
    );
  }
}
