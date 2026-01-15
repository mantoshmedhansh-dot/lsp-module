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
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      sku: { companyId: user.companyId },
    };

    if (locationId) {
      where.locationId = locationId;
    }

    // Get all inventory
    const inventory = await prisma.inventory.findMany({
      where,
      include: {
        sku: {
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
        location: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Calculate stock by category
    const categoryStockMap: Record<string, { units: number; value: number; skuCount: number }> = {};
    inventory.forEach((item) => {
      const category = item.sku.category || "Uncategorized";
      if (!categoryStockMap[category]) {
        categoryStockMap[category] = { units: 0, value: 0, skuCount: 0 };
      }
      categoryStockMap[category].units += item.available;
      categoryStockMap[category].value += item.available * Number(item.sku.sellingPrice || 0);
      categoryStockMap[category].skuCount += 1;
    });

    // Calculate stock by location
    const locationStockMap: Record<string, { units: number; value: number; name: string }> = {};
    inventory.forEach((item) => {
      const locId = item.locationId;
      if (!locationStockMap[locId]) {
        locationStockMap[locId] = { units: 0, value: 0, name: item.location.name };
      }
      locationStockMap[locId].units += item.available;
      locationStockMap[locId].value += item.available * Number(item.sku.sellingPrice || 0);
    });

    // Identify low stock items
    const lowStockItems = inventory
      .filter((item) => item.available <= (item.sku.reorderLevel || 10) && item.available > 0)
      .map((item) => ({
        sku: { code: item.sku.code, name: item.sku.name },
        location: item.location.name,
        available: item.available,
        reorderLevel: item.sku.reorderLevel || 10,
        shortfall: (item.sku.reorderLevel || 10) - item.available,
      }))
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);

    // Identify out of stock items
    const outOfStockItems = inventory
      .filter((item) => item.available === 0)
      .map((item) => ({
        sku: { code: item.sku.code, name: item.sku.name },
        location: item.location.name,
        lastStockDate: item.updatedAt?.toISOString().split("T")[0],
      }))
      .slice(0, 10);

    // Calculate summary
    const totalUnits = inventory.reduce((sum, i) => sum + i.available, 0);
    const totalValue = inventory.reduce(
      (sum, i) => sum + i.available * Number(i.sku.sellingPrice || 0),
      0
    );
    const totalCost = inventory.reduce(
      (sum, i) => sum + i.available * Number(i.sku.costPrice || 0),
      0
    );
    const uniqueSKUs = new Set(inventory.map((i) => i.skuId)).size;
    const lowStockCount = inventory.filter(
      (i) => i.available <= (i.sku.reorderLevel || 10) && i.available > 0
    ).length;
    const outOfStockCount = inventory.filter((i) => i.available === 0).length;

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
