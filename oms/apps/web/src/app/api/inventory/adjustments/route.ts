import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate adjustment number
function generateAdjustmentNo(): string {
  const prefix = "ADJ";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/inventory/adjustments - List stock adjustments
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const locationId = searchParams.get("locationId") || "";
    const reason = searchParams.get("reason") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by location access
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (reason) {
      where.reason = reason;
    }

    if (search) {
      where.OR = [
        { adjustmentNo: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }

    const [adjustments, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        include: {
          Location: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          StockAdjustmentItem: true,
          _count: {
            select: {
              StockAdjustmentItem: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockAdjustment.count({ where }),
    ]);

    // Get SKU details for items
    const adjustmentsWithSku = await Promise.all(
      adjustments.map(async (adj) => {
        const itemsWithSku = await Promise.all(
          adj.StockAdjustmentItem.map(async (item) => {
            const sku = await prisma.sKU.findUnique({
              where: { id: item.skuId },
              select: { id: true, code: true, name: true },
            });
            const bin = await prisma.bin.findUnique({
              where: { id: item.binId },
              select: { id: true, code: true },
            });
            return { ...item, sku, bin };
          })
        );
        return { ...adj, items: itemsWithSku, location: adj.Location, adjustedBy: adj.User };
      })
    );

    return NextResponse.json({
      adjustments: adjustmentsWithSku,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching adjustments:", error);
    return NextResponse.json(
      { error: "Failed to fetch adjustments" },
      { status: 500 }
    );
  }
}

// POST /api/inventory/adjustments - Create stock adjustment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { locationId, reason, remarks, items } = body;

    if (!locationId || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Location, reason, and items are required" },
        { status: 400 }
      );
    }

    // Validate items and get current quantities
    const validatedItems = await Promise.all(
      items.map(async (item: { skuId: string; binId: string; adjustedQty: number; batchNo?: string }) => {
        // Get current inventory
        const inventory = await prisma.inventory.findFirst({
          where: {
            skuId: item.skuId,
            binId: item.binId,
            batchNo: item.batchNo || null,
          },
        });

        const previousQty = inventory?.quantity || 0;
        const newQty = previousQty + item.adjustedQty;

        if (newQty < 0) {
          throw new Error(
            `Cannot adjust. New quantity would be negative for SKU in bin ${item.binId}`
          );
        }

        return {
          skuId: item.skuId,
          binId: item.binId,
          batchNo: item.batchNo || null,
          previousQty,
          adjustedQty: item.adjustedQty,
          newQty,
          inventoryId: inventory?.id,
        };
      })
    );

    // Use transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create adjustment record
      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNo: generateAdjustmentNo(),
          reason,
          remarks,
          locationId,
          adjustedById: session.user.id!,
          StockAdjustmentItem: {
            create: validatedItems.map((item) => ({
              skuId: item.skuId,
              binId: item.binId,
              batchNo: item.batchNo,
              previousQty: item.previousQty,
              adjustedQty: item.adjustedQty,
              newQty: item.newQty,
            })),
          },
        },
        include: {
          StockAdjustmentItem: true,
          Location: true,
          User: {
            select: { name: true },
          },
        },
      });

      // Update inventory for each item
      for (const item of validatedItems) {
        if (item.inventoryId) {
          // Update existing inventory
          await tx.inventory.update({
            where: { id: item.inventoryId },
            data: { quantity: item.newQty },
          });
        } else if (item.newQty > 0) {
          // Create new inventory record if quantity is positive
          const bin = await tx.bin.findUnique({
            where: { id: item.binId },
            include: { Zone: true },
          });

          if (bin) {
            await tx.inventory.create({
              data: {
                skuId: item.skuId,
                binId: item.binId,
                locationId: bin.Zone.locationId,
                quantity: item.newQty,
                batchNo: item.batchNo,
              },
            });
          }
        }

        // Create movement record
        await tx.inventoryMovement.create({
          data: {
            movementNo: `MOV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 4)}`,
            type: item.adjustedQty > 0 ? "IN" : "OUT",
            reason: reason,
            quantity: Math.abs(item.adjustedQty),
            skuId: item.skuId,
            fromBinId: item.adjustedQty < 0 ? item.binId : null,
            toBinId: item.adjustedQty > 0 ? item.binId : null,
            batchNo: item.batchNo,
            referenceType: "ADJUSTMENT",
            referenceId: adjustment.id,
            performedBy: session.user.id || "system",
          },
        });
      }

      return adjustment;
    });

    return NextResponse.json({
      success: true,
      adjustment: result,
      message: `Stock adjustment ${result.adjustmentNo} created with ${validatedItems.length} items`,
    });
  } catch (error) {
    console.error("Error creating adjustment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create adjustment" },
      { status: 500 }
    );
  }
}
