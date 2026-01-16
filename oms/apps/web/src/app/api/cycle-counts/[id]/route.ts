import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/cycle-counts/[id] - Get cycle count details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const cycleCount = await prisma.cycleCount.findUnique({
      where: { id },
      include: {
        CycleCountItem: {
          include: {
            // We'll need to manually join SKU and Bin info
          },
        },
      },
    });

    if (!cycleCount) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    // Get SKU and Bin details for items
    const skuIds = [...new Set(cycleCount.CycleCountItem.map((i) => i.skuId))];
    const binIds = [...new Set(cycleCount.CycleCountItem.map((i) => i.binId))];

    const [skus, bins] = await Promise.all([
      prisma.sKU.findMany({
        where: { id: { in: skuIds } },
        select: { id: true, code: true, name: true },
      }),
      prisma.bin.findMany({
        where: { id: { in: binIds } },
        select: { id: true, code: true, Zone: { select: { code: true, name: true } } },
      }),
    ]);

    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const binMap = new Map(bins.map((b) => [b.id, b]));

    const itemsWithDetails = cycleCount.CycleCountItem.map((item) => ({
      ...item,
      sku: skuMap.get(item.skuId),
      bin: binMap.get(item.binId),
    }));

    return NextResponse.json({
      ...cycleCount,
      CycleCountItem: itemsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching cycle count:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycle count" },
      { status: 500 }
    );
  }
}

// PATCH /api/cycle-counts/[id] - Update cycle count
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, items, remarks } = body;

    const cycleCount = await prisma.cycleCount.findUnique({
      where: { id },
      include: { CycleCountItem: true },
    });

    if (!cycleCount) {
      return NextResponse.json({ error: "Cycle count not found" }, { status: 404 });
    }

    // Handle different actions
    switch (action) {
      case "start": {
        if (cycleCount.status !== "PLANNED") {
          return NextResponse.json(
            { error: "Cycle count must be in PLANNED status to start" },
            { status: 400 }
          );
        }

        const updated = await prisma.cycleCount.update({
          where: { id },
          data: {
            status: "IN_PROGRESS",
            startedAt: new Date(),
          },
        });

        return NextResponse.json(updated);
      }

      case "record_counts": {
        if (cycleCount.status !== "IN_PROGRESS") {
          return NextResponse.json(
            { error: "Cycle count must be IN_PROGRESS to record counts" },
            { status: 400 }
          );
        }

        if (!items || !Array.isArray(items)) {
          return NextResponse.json(
            { error: "Items array is required" },
            { status: 400 }
          );
        }

        // Update each item's counted quantity
        for (const item of items) {
          const { itemId, countedQty } = item;

          const existingItem = cycleCount.CycleCountItem.find((i) => i.id === itemId);
          if (!existingItem) continue;

          const varianceQty = countedQty - existingItem.expectedQty;

          await prisma.cycleCountItem.update({
            where: { id: itemId },
            data: {
              countedQty,
              varianceQty,
              status: "COUNTED",
              countedAt: new Date(),
              countedById: session.user.id,
            },
          });
        }

        return NextResponse.json({ success: true, message: "Counts recorded" });
      }

      case "complete": {
        if (cycleCount.status !== "IN_PROGRESS") {
          return NextResponse.json(
            { error: "Cycle count must be IN_PROGRESS to complete" },
            { status: 400 }
          );
        }

        // Check if all items are counted
        const uncountedItems = cycleCount.CycleCountItem.filter(
          (i) => i.status !== "COUNTED"
        );

        if (uncountedItems.length > 0) {
          return NextResponse.json(
            { error: `${uncountedItems.length} items are not yet counted` },
            { status: 400 }
          );
        }

        // Calculate variance
        const refreshedItems = await prisma.cycleCountItem.findMany({
          where: { cycleCountId: id },
        });

        const totalVariance = refreshedItems.reduce(
          (sum, item) => sum + Math.abs(item.varianceQty),
          0
        );
        const hasVariance = refreshedItems.some((i) => i.varianceQty !== 0);

        const updated = await prisma.cycleCount.update({
          where: { id },
          data: {
            status: hasVariance ? "VARIANCE_FOUND" : "COMPLETED",
            completedAt: new Date(),
            varianceFound: hasVariance,
            varianceValue: totalVariance,
            remarks,
          },
        });

        return NextResponse.json(updated);
      }

      case "verify": {
        if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!["COMPLETED", "VARIANCE_FOUND"].includes(cycleCount.status)) {
          return NextResponse.json(
            { error: "Cycle count must be completed to verify" },
            { status: 400 }
          );
        }

        const updated = await prisma.cycleCount.update({
          where: { id },
          data: {
            status: "VERIFIED",
            verifiedById: session.user.id,
            remarks,
          },
        });

        return NextResponse.json(updated);
      }

      case "apply_adjustments": {
        if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (cycleCount.status !== "VERIFIED") {
          return NextResponse.json(
            { error: "Cycle count must be VERIFIED to apply adjustments" },
            { status: 400 }
          );
        }

        // Get items with variance
        const varianceItems = await prisma.cycleCountItem.findMany({
          where: {
            cycleCountId: id,
            varianceQty: { not: 0 },
          },
        });

        if (varianceItems.length === 0) {
          return NextResponse.json({ success: true, message: "No adjustments needed" });
        }

        // Create stock adjustment
        const adjSequence = await prisma.sequence.upsert({
          where: { name: "stock_adjustment" },
          update: { currentValue: { increment: 1 } },
          create: { name: "stock_adjustment", prefix: "ADJ", currentValue: 1 },
        });

        const adjustmentNo = `ADJ${String(adjSequence.currentValue).padStart(6, "0")}`;

        // Create adjustment with items
        await prisma.stockAdjustment.create({
          data: {
            adjustmentNo,
            reason: "CYCLE_COUNT",
            remarks: `Adjustment from Cycle Count ${cycleCount.cycleCountNo}`,
            locationId: cycleCount.locationId,
            adjustedById: session.user.id!,
            StockAdjustmentItem: {
              create: varianceItems.map((item) => ({
                skuId: item.skuId,
                binId: item.binId,
                batchNo: item.batchNo,
                previousQty: item.expectedQty,
                adjustedQty: item.varianceQty,
                newQty: item.countedQty,
              })),
            },
          },
        });

        // Update inventory quantities
        for (const item of varianceItems) {
          await prisma.inventory.updateMany({
            where: {
              skuId: item.skuId,
              binId: item.binId,
              batchNo: item.batchNo || undefined,
            },
            data: {
              quantity: item.countedQty,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: `${varianceItems.length} adjustments applied`,
        });
      }

      case "cancel": {
        if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (["VERIFIED"].includes(cycleCount.status)) {
          return NextResponse.json(
            { error: "Cannot cancel verified cycle count" },
            { status: 400 }
          );
        }

        const updated = await prisma.cycleCount.update({
          where: { id },
          data: {
            status: "CANCELLED",
            remarks,
          },
        });

        return NextResponse.json(updated);
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating cycle count:", error);
    return NextResponse.json(
      { error: "Failed to update cycle count" },
      { status: 500 }
    );
  }
}
