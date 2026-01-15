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
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      sku: { companyId: user.companyId },
    };

    if (locationId) {
      where.locationId = locationId;
    }

    if (search) {
      where.sku = {
        ...((where.sku as object) || {}),
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
          sku: {
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
          location: {
            select: { id: true, name: true, code: true },
          },
          bin: {
            select: { id: true, code: true, zone: true },
          },
        },
        skip,
        take: limit,
        orderBy: { sku: { code: "asc" } },
      }),
      prisma.inventory.count({ where }),
    ]);

    // Filter by stock status if needed
    let filteredItems = inventoryItems;
    if (stockStatus === "low") {
      filteredItems = inventoryItems.filter(
        (i) => i.available <= (i.sku.reorderLevel || 10) && i.available > 0
      );
    } else if (stockStatus === "out") {
      filteredItems = inventoryItems.filter((i) => i.available === 0);
    } else if (stockStatus === "healthy") {
      filteredItems = inventoryItems.filter(
        (i) => i.available > (i.sku.reorderLevel || 10)
      );
    }

    // Get locations for filter
    const locations = await prisma.location.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, name: true, code: true },
    });

    // Calculate summary
    const allInventory = await prisma.inventory.findMany({
      where: { sku: { companyId: user.companyId } },
      include: { sku: { select: { reorderLevel: true, sellingPrice: true } } },
    });

    const summary = {
      totalSKUs: new Set(allInventory.map((i) => i.skuId)).size,
      totalStock: allInventory.reduce((sum, i) => sum + i.available, 0),
      lowStock: allInventory.filter(
        (i) => i.available <= (i.sku.reorderLevel || 10) && i.available > 0
      ).length,
      outOfStock: allInventory.filter((i) => i.available === 0).length,
      stockValue: allInventory.reduce(
        (sum, i) => sum + i.available * Number(i.sku.sellingPrice || 0),
        0
      ),
    };

    return NextResponse.json({
      items: filteredItems.map((item) => ({
        id: item.id,
        sku: {
          id: item.sku.id,
          code: item.sku.code,
          name: item.sku.name,
          category: item.sku.category,
        },
        location: item.location,
        bin: item.bin,
        available: item.available,
        reserved: item.reserved,
        onHand: item.onHand,
        inTransit: item.inTransit,
        reorderLevel: item.sku.reorderLevel || 10,
        stockValue: item.available * Number(item.sku.sellingPrice || 0),
        stockStatus:
          item.available === 0
            ? "out"
            : item.available <= (item.sku.reorderLevel || 10)
            ? "low"
            : "healthy",
      })),
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
