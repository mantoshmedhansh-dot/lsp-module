import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/waves/[id]/pick - Record a pick for a wave item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: waveId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { waveItemId, pickedQuantity, orderId } = body;

    if (!waveItemId || pickedQuantity === undefined) {
      return NextResponse.json(
        { error: "Wave item ID and picked quantity are required" },
        { status: 400 }
      );
    }

    // Validate wave exists and is in progress
    const wave = await prisma.wave.findUnique({
      where: { id: waveId },
    });

    if (!wave) {
      return NextResponse.json({ error: "Wave not found" }, { status: 404 });
    }

    if (wave.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Wave must be in progress to record picks" },
        { status: 400 }
      );
    }

    // Validate wave item
    const waveItem = await prisma.waveItem.findFirst({
      where: {
        id: waveItemId,
        waveId,
      },
      include: {
        SKU: true,
        Bin: true,
      },
    });

    if (!waveItem) {
      return NextResponse.json({ error: "Wave item not found" }, { status: 404 });
    }

    const newPickedQty = waveItem.pickedQty + pickedQuantity;

    if (newPickedQty > waveItem.totalQty) {
      return NextResponse.json(
        { error: `Cannot pick more than required. Max: ${waveItem.totalQty - waveItem.pickedQty}` },
        { status: 400 }
      );
    }

    // Update wave item
    const updatedWaveItem = await prisma.waveItem.update({
      where: { id: waveItemId },
      data: {
        pickedQty: newPickedQty,
        pickedAt: new Date(),
        pickedById: session.user.id,
      },
      include: {
        SKU: true,
        Bin: true,
      },
    });

    // If orderId is provided, create/update distribution
    if (orderId) {
      // Get first order item to link distribution
      const orderItem = await prisma.orderItem.findFirst({
        where: { orderId },
      });

      if (orderItem) {
        // Check if distribution exists
        const existingDist = await prisma.waveItemDistribution.findFirst({
          where: {
            waveItemId,
            orderId,
          },
        });

        if (existingDist) {
          await prisma.waveItemDistribution.update({
            where: { id: existingDist.id },
            data: {
              quantity: existingDist.quantity + pickedQuantity,
            },
          });
        } else {
          await prisma.waveItemDistribution.create({
            data: {
              waveItemId,
              orderId,
              orderItemId: orderItem.id,
              quantity: pickedQuantity,
            },
          });
        }
      }
    }

    // Update inventory if bin is specified
    if (waveItem.binId && waveItem.skuId) {
      await prisma.inventory.updateMany({
        where: {
          skuId: waveItem.skuId,
          binId: waveItem.binId,
          locationId: wave.locationId,
        },
        data: {
          quantity: { decrement: pickedQuantity },
        },
      });

      // Create inventory movement
      const movementNo = `MOV-${Date.now()}`;
      await prisma.inventoryMovement.create({
        data: {
          movementNo,
          skuId: waveItem.skuId,
          fromBinId: waveItem.binId,
          type: "PICK",
          quantity: pickedQuantity,
          reason: `Wave picking: ${wave.waveNo}`,
          referenceType: "WAVE",
          referenceId: waveId,
          performedBy: session.user.id,
        },
      });
    }

    // Update wave picked units count
    await prisma.wave.update({
      where: { id: waveId },
      data: {
        pickedUnits: { increment: pickedQuantity },
      },
    });

    // Check if all items are picked - get all wave items and filter
    const allWaveItems = await prisma.waveItem.findMany({
      where: { waveId },
      select: { pickedQty: true, totalQty: true },
    });
    const pendingItems = allWaveItems.filter(item => item.pickedQty < item.totalQty).length;

    const allPicked = pendingItems === 0;

    return NextResponse.json({
      waveItem: updatedWaveItem,
      allPicked,
      remainingItems: pendingItems,
    });
  } catch (error) {
    console.error("Error recording pick:", error);
    return NextResponse.json(
      { error: "Failed to record pick" },
      { status: 500 }
    );
  }
}

// GET /api/waves/[id]/pick - Get picking progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: waveId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wave = await prisma.wave.findUnique({
      where: { id: waveId },
      include: {
        Location: true,
        WaveItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true, barcodes: true },
            },
            Bin: {
              select: {
                id: true,
                code: true,
              },
            },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!wave) {
      return NextResponse.json({ error: "Wave not found" }, { status: 404 });
    }

    // Calculate progress
    const totalItems = wave.WaveItem.length;
    const completedItems = wave.WaveItem.filter(
      (item) => item.pickedQty >= item.totalQty
    ).length;
    const totalUnits = wave.WaveItem.reduce((sum, item) => sum + item.totalQty, 0);
    const pickedUnits = wave.WaveItem.reduce((sum, item) => sum + item.pickedQty, 0);

    // Get current item (first unpicked or partially picked)
    const currentItem = wave.WaveItem.find(
      (item) => item.pickedQty < item.totalQty
    );

    // Get next items
    const upcomingItems = wave.WaveItem
      .filter((item) => item.pickedQty < item.totalQty && item.id !== currentItem?.id)
      .slice(0, 5);

    return NextResponse.json({
      wave: {
        id: wave.id,
        waveNo: wave.waveNo,
        status: wave.status,
        location: wave.Location,
      },
      progress: {
        totalItems,
        completedItems,
        totalUnits,
        pickedUnits,
        percentComplete: totalUnits > 0 ? Math.round((pickedUnits / totalUnits) * 100) : 0,
      },
      currentItem,
      upcomingItems,
      allItems: wave.WaveItem,
    });
  } catch (error) {
    console.error("Error fetching pick progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick progress" },
      { status: 500 }
    );
  }
}
