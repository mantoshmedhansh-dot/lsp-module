import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

// GET /api/inventory - List inventory with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const locationId = searchParams.get("locationId") || "";
    const zoneId = searchParams.get("zoneId") || "";
    const binId = searchParams.get("binId") || "";
    const skuId = searchParams.get("skuId") || "";
    const lowStock = searchParams.get("lowStock") === "true";
    const outOfStock = searchParams.get("outOfStock") === "true";
    const groupBy = searchParams.get("groupBy") || "sku"; // sku, bin, location
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by location access
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    // Override with specific location if provided
    if (locationId) {
      where.locationId = locationId;
    }

    if (zoneId) {
      where.bin = { zoneId };
    }

    if (binId) {
      where.binId = binId;
    }

    if (skuId) {
      where.skuId = skuId;
    }

    if (search) {
      where.OR = [
        { sku: { code: { contains: search, mode: "insensitive" } } },
        { sku: { name: { contains: search, mode: "insensitive" } } },
        { bin: { code: { contains: search, mode: "insensitive" } } },
        { batchNo: { contains: search, mode: "insensitive" } },
      ];
    }

    if (outOfStock) {
      where.quantity = 0;
    } else if (lowStock) {
      // Low stock is when quantity <= reorderLevel
      where.quantity = { gt: 0 };
    }

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          SKU: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              brand: true,
              reorderLevel: true,
              images: true,
            },
          },
          Bin: {
            select: {
              id: true,
              code: true,
              name: true,
              Zone: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          Location: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [
          { SKU: { code: "asc" } },
          { Bin: { code: "asc" } },
        ],
        skip,
        take: limit,
      }),
      prisma.inventory.count({ where }),
    ]);

    // Filter low stock items (where quantity <= reorderLevel)
    let filteredInventory = inventory;
    if (lowStock) {
      filteredInventory = inventory.filter(
        (inv) => inv.SKU.reorderLevel && inv.quantity <= inv.SKU.reorderLevel
      );
    }

    // Get summary stats
    const locationFilter = session.user.locationAccess?.length
      ? { locationId: { in: session.user.locationAccess } }
      : {};

    const stats = await prisma.inventory.aggregate({
      where: locationFilter,
      _sum: {
        quantity: true,
        reservedQty: true,
      },
      _count: {
        _all: true,
      },
    });

    // Get unique SKU count
    const uniqueSkus = await prisma.inventory.groupBy({
      by: ["skuId"],
      where: {
        ...locationFilter,
        quantity: { gt: 0 },
      },
    });

    // Get low stock count
    const lowStockItems = await prisma.inventory.findMany({
      where: {
        ...locationFilter,
        quantity: { gt: 0 },
      },
      include: {
        SKU: {
          select: {
            reorderLevel: true,
          },
        },
      },
    });

    const lowStockCount = lowStockItems.filter(
      (inv) => inv.SKU.reorderLevel && inv.quantity <= inv.SKU.reorderLevel
    ).length;

    // Get out of stock count
    const outOfStockCount = await prisma.inventory.count({
      where: {
        ...locationFilter,
        quantity: 0,
      },
    });

    return NextResponse.json({
      inventory: filteredInventory,
      total: lowStock ? filteredInventory.length : total,
      page,
      limit,
      totalPages: Math.ceil((lowStock ? filteredInventory.length : total) / limit),
      stats: {
        totalQuantity: stats._sum.quantity || 0,
        totalReserved: stats._sum.reservedQty || 0,
        availableQuantity: (stats._sum.quantity || 0) - (stats._sum.reservedQty || 0),
        uniqueSkus: uniqueSkus.length,
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

// POST /api/inventory - Add inventory (direct stock addition)
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      skuId,
      binId,
      locationId,
      quantity,
      batchNo,
      lotNo,
      expiryDate,
      mfgDate,
      mrp,
      serialNumbers,
    } = body;

    if (!skuId || !binId || !locationId || quantity === undefined) {
      return NextResponse.json(
        { error: "SKU, bin, location, and quantity are required" },
        { status: 400 }
      );
    }

    // Check if inventory record exists
    const existing = await prisma.inventory.findFirst({
      where: {
        skuId,
        binId,
        batchNo: batchNo || null,
      },
    });

    let inventory;

    if (existing) {
      // Update existing
      inventory = await prisma.inventory.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          serialNumbers: serialNumbers
            ? [...existing.serialNumbers, ...serialNumbers]
            : existing.serialNumbers,
        },
        include: {
          SKU: true,
          Bin: {
            include: { Zone: true },
          },
          Location: true,
        },
      });
    } else {
      // Create new
      inventory = await prisma.inventory.create({
        data: {
          skuId,
          binId,
          locationId,
          quantity,
          batchNo,
          lotNo,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          mfgDate: mfgDate ? new Date(mfgDate) : null,
          mrp,
          serialNumbers: serialNumbers || [],
        },
        include: {
          SKU: true,
          Bin: {
            include: { Zone: true },
          },
          Location: true,
        },
      });
    }

    // Create movement record
    await prisma.inventoryMovement.create({
      data: {
        movementNo: `MOV-${Date.now().toString(36).toUpperCase()}`,
        type: "IN",
        reason: "DIRECT_ADD",
        quantity,
        skuId,
        toBinId: binId,
        batchNo,
        serialNumbers: serialNumbers || [],
        referenceType: "DIRECT",
        performedBy: session.user.id || "system",
      },
    });

    return NextResponse.json({
      success: true,
      inventory,
      message: `Added ${quantity} units to inventory`,
    });
  } catch (error) {
    console.error("Error adding inventory:", error);
    return NextResponse.json(
      { error: "Failed to add inventory" },
      { status: 500 }
    );
  }
}
