import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/inventory/move - Move inventory between bins
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      skuId,
      fromBinId,
      toBinId,
      quantity,
      batchNo,
      serialNumbers,
      reason,
    } = body;

    if (!skuId || !fromBinId || !toBinId || !quantity) {
      return NextResponse.json(
        { error: "SKU, source bin, destination bin, and quantity are required" },
        { status: 400 }
      );
    }

    if (fromBinId === toBinId) {
      return NextResponse.json(
        { error: "Source and destination bins cannot be the same" },
        { status: 400 }
      );
    }

    // Get source inventory
    const sourceInventory = await prisma.inventory.findFirst({
      where: {
        skuId,
        binId: fromBinId,
        batchNo: batchNo || null,
      },
      include: {
        Bin: {
          include: { Zone: true },
        },
      },
    });

    if (!sourceInventory) {
      return NextResponse.json(
        { error: "Source inventory not found" },
        { status: 404 }
      );
    }

    const availableQty = sourceInventory.quantity - sourceInventory.reservedQty;

    if (quantity > availableQty) {
      return NextResponse.json(
        {
          error: `Insufficient available quantity. Available: ${availableQty}, Requested: ${quantity}`,
        },
        { status: 400 }
      );
    }

    // Get destination bin details
    const destBin = await prisma.bin.findUnique({
      where: { id: toBinId },
      include: { Zone: true },
    });

    if (!destBin) {
      return NextResponse.json(
        { error: "Destination bin not found" },
        { status: 404 }
      );
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from source
      const updatedSource = await tx.inventory.update({
        where: { id: sourceInventory.id },
        data: {
          quantity: { decrement: quantity },
          serialNumbers: serialNumbers
            ? sourceInventory.serialNumbers.filter(
                (sn) => !serialNumbers.includes(sn)
              )
            : sourceInventory.serialNumbers,
        },
      });

      // Check for existing destination inventory
      const destInventory = await tx.inventory.findFirst({
        where: {
          skuId,
          binId: toBinId,
          batchNo: batchNo || null,
        },
      });

      let updatedDest;

      if (destInventory) {
        // Update existing destination inventory
        updatedDest = await tx.inventory.update({
          where: { id: destInventory.id },
          data: {
            quantity: { increment: quantity },
            serialNumbers: serialNumbers
              ? [...destInventory.serialNumbers, ...serialNumbers]
              : destInventory.serialNumbers,
          },
        });
      } else {
        // Create new destination inventory
        updatedDest = await tx.inventory.create({
          data: {
            skuId,
            binId: toBinId,
            locationId: destBin.Zone.locationId,
            quantity,
            batchNo: sourceInventory.batchNo,
            lotNo: sourceInventory.lotNo,
            expiryDate: sourceInventory.expiryDate,
            mfgDate: sourceInventory.mfgDate,
            mrp: sourceInventory.mrp,
            serialNumbers: serialNumbers || [],
          },
        });
      }

      // Create movement record
      const movement = await tx.inventoryMovement.create({
        data: {
          movementNo: `MOV-${Date.now().toString(36).toUpperCase()}`,
          type: "TRANSFER",
          reason: reason || "BIN_TRANSFER",
          quantity,
          skuId,
          fromBinId,
          toBinId,
          batchNo,
          serialNumbers: serialNumbers || [],
          referenceType: "TRANSFER",
          performedBy: session.user.id || "system",
        },
      });

      return { updatedSource, updatedDest, movement };
    });

    // Fetch full details for response
    const [fromInventory, toInventory] = await Promise.all([
      prisma.inventory.findUnique({
        where: { id: sourceInventory.id },
        include: {
          SKU: true,
          Bin: { include: { Zone: true } },
        },
      }),
      prisma.inventory.findFirst({
        where: { skuId, binId: toBinId, batchNo: batchNo || null },
        include: {
          SKU: true,
          Bin: { include: { Zone: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      fromInventory,
      toInventory,
      message: `Moved ${quantity} units from ${sourceInventory.Bin.code} to ${destBin.code}`,
    });
  } catch (error) {
    console.error("Error moving inventory:", error);
    return NextResponse.json(
      { error: "Failed to move inventory" },
      { status: 500 }
    );
  }
}
