import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/inventory/stock - Get inventory stock levels for client
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const locationId = searchParams.get("locationId") || "";
    const stockStatus = searchParams.get("stockStatus") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      SKU: { companyId: user.companyId },
    };

    if (locationId) {
      where.locationId = locationId;
    }

    if (search) {
      where.SKU = {
        ...((where.SKU as object) || {}),
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Get inventory items
    const [inventoryItems, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          SKU: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              mrp: true,
              sellingPrice: true,
              reorderLevel: true,
            },
          },
          Location: {
            select: { id: true, name: true, code: true },
          },
          Bin: {
            select: { id: true, code: true, Zone: true },
          },
        },
        skip,
        take: limit,
        orderBy: { SKU: { code: "asc" } },
      }),
      prisma.inventory.count({ where }),
    ]);

    // Filter by stock status if needed
    let filteredItems = inventoryItems;
    if (stockStatus === "low") {
      filteredItems = inventoryItems.filter(
        (i) => (i.quantity - i.reservedQty) <= (i.SKU.reorderLevel || 10) && (i.quantity - i.reservedQty) > 0
      );
    } else if (stockStatus === "out") {
      filteredItems = inventoryItems.filter((i) => (i.quantity - i.reservedQty) === 0);
    } else if (stockStatus === "healthy") {
      filteredItems = inventoryItems.filter(
        (i) => (i.quantity - i.reservedQty) > (i.SKU.reorderLevel || 10)
      );
    }

    // Get locations for filter
    const locations = await prisma.location.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    // Calculate summary
    const allInventory = await prisma.inventory.findMany({
      where: { SKU: { companyId: user.companyId } },
      include: { SKU: { select: { reorderLevel: true, sellingPrice: true } } },
    });

    const summary = {
      totalSKUs: new Set(allInventory.map((i) => i.skuId)).size,
      totalStock: allInventory.reduce((sum, i) => sum + (i.quantity - i.reservedQty), 0),
      lowStock: allInventory.filter(
        (i) => (i.quantity - i.reservedQty) <= (i.SKU.reorderLevel || 10) && (i.quantity - i.reservedQty) > 0
      ).length,
      outOfStock: allInventory.filter((i) => (i.quantity - i.reservedQty) === 0).length,
      stockValue: allInventory.reduce(
        (sum, i) => sum + (i.quantity - i.reservedQty) * Number(i.SKU.sellingPrice || 0),
        0
      ),
    };

    return NextResponse.json({
      items: filteredItems.map((item) => {
        const available = item.quantity - item.reservedQty;
        return {
          id: item.id,
          sku: {
            id: item.SKU.id,
            code: item.SKU.code,
            name: item.SKU.name,
            category: item.SKU.category,
          },
          location: item.Location,
          bin: item.Bin,
          available: available,
          reserved: item.reservedQty,
          onHand: item.quantity,
          inTransit: 0,
          reorderLevel: item.SKU.reorderLevel || 10,
          stockValue: available * Number(item.SKU.sellingPrice || 0),
          stockStatus:
            available === 0
              ? "out"
              : available <= (item.SKU.reorderLevel || 10)
              ? "low"
              : "healthy",
        };
      }),
      total: stockStatus ? filteredItems.length : total,
      page,
      limit,
      totalPages: Math.ceil((stockStatus ? filteredItems.length : total) / limit),
      locations,
      summary,
    });
  } catch (error) {
    console.error("Error fetching inventory stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory stock" },
      { status: 500 }
    );
  }
}
