import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate movement number
async function generateMovementNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "inventory_movement" },
    update: { currentValue: { increment: 1 } },
    create: { name: "inventory_movement", prefix: "MOV", currentValue: 1, paddingLength: 8 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "MOV"}${paddedNumber}`;
}

// GET /api/returns/[id] - Get return details
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

    const returnRecord = await prisma.return.findUnique({
      where: { id },
      include: {
        Order_Return_orderIdToOrder: {
          include: {
            OrderItem: {
              include: {
                SKU: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        ReturnItem: {
          select: {
            id: true,
            skuId: true,
            quantity: true,
            receivedQty: true,
            qcStatus: true,
            qcGrade: true,
            qcRemarks: true,
            action: true,
            restockedQty: true,
            disposedQty: true,
          },
        },
      },
    });

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    // Get SKU details for items
    const skuIds = returnRecord.ReturnItem.map((item) => item.skuId);
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, code: true, name: true, barcodes: true },
    });

    const skuMap = new Map(skus.map((sku) => [sku.id, sku]));
    const itemsWithSku = returnRecord.ReturnItem.map((item) => ({
      ...item,
      sku: skuMap.get(item.skuId),
    }));

    return NextResponse.json({
      ...returnRecord,
      items: itemsWithSku,
    });
  } catch (error) {
    console.error("Error fetching return:", error);
    return NextResponse.json(
      { error: "Failed to fetch return" },
      { status: 500 }
    );
  }
}

// PATCH /api/returns/[id] - Update return / Actions
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
    const { action, ...data } = body;

    const returnRecord = await prisma.return.findUnique({
      where: { id },
      include: { ReturnItem: true },
    });

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    switch (action) {
      case "mark-in-transit": {
        const { awbNo } = data;

        const updated = await prisma.return.update({
          where: { id },
          data: {
            status: "IN_TRANSIT",
            awbNo,
          },
        });

        return NextResponse.json(updated);
      }

      case "receive": {
        // Receive return items
        const { items } = data;

        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        for (const item of items) {
          await prisma.returnItem.update({
            where: { id: item.id },
            data: {
              receivedQty: item.receivedQty,
            },
          });
        }

        const updated = await prisma.return.update({
          where: { id },
          data: {
            status: "RECEIVED",
            receivedAt: new Date(),
          },
          include: { ReturnItem: true },
        });

        return NextResponse.json(updated);
      }

      case "qc": {
        // QC return items
        const { items } = data;

        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        for (const item of items) {
          await prisma.returnItem.update({
            where: { id: item.id },
            data: {
              qcStatus: item.qcStatus, // PASSED, FAILED
              qcGrade: item.qcGrade, // A, B, C, D
              qcRemarks: item.qcRemarks,
            },
          });
        }

        // Check overall QC status
        const updatedItems = await prisma.returnItem.findMany({
          where: { returnId: id },
        });

        const allPassed = updatedItems.every((item) => item.qcStatus === "PASSED");
        const allQCed = updatedItems.every((item) => item.qcStatus);

        let newStatus = returnRecord.status;
        if (allQCed) {
          newStatus = allPassed ? "QC_PASSED" : "QC_FAILED";
        } else {
          newStatus = "QC_PENDING";
        }

        const updated = await prisma.return.update({
          where: { id },
          data: { status: newStatus },
          include: { ReturnItem: true },
        });

        return NextResponse.json(updated);
      }

      case "process": {
        // Process return items (restock, dispose)
        const { items, binId, locationId } = data;

        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        const result = await prisma.$transaction(async (tx) => {
          for (const item of items) {
            const returnItem = returnRecord.ReturnItem.find((ri) => ri.id === item.id);
            if (!returnItem) continue;

            // Update return item action
            await tx.returnItem.update({
              where: { id: item.id },
              data: {
                action: item.action, // RESTOCK, DISPOSE, REPAIR
                restockedQty: item.action === "RESTOCK" ? item.quantity : 0,
                disposedQty: item.action === "DISPOSE" ? item.quantity : 0,
              },
            });

            // If restocking, add to inventory
            if (item.action === "RESTOCK" && item.quantity > 0 && binId) {
              // Find or create inventory record
              const existingInventory = await tx.inventory.findFirst({
                where: {
                  skuId: returnItem.skuId,
                  binId,
                  batchNo: null,
                },
              });

              if (existingInventory) {
                await tx.inventory.update({
                  where: { id: existingInventory.id },
                  data: {
                    quantity: { increment: item.quantity },
                  },
                });
              } else {
                await tx.inventory.create({
                  data: {
                    skuId: returnItem.skuId,
                    binId,
                    locationId,
                    quantity: item.quantity,
                  },
                });
              }

              // Create inventory movement
              const movementNo = await generateMovementNumber();
              await tx.inventoryMovement.create({
                data: {
                  movementNo,
                  type: "IN",
                  skuId: returnItem.skuId,
                  toBinId: binId,
                  quantity: item.quantity,
                  referenceType: "RETURN",
                  referenceId: id,
                  reason: `Return ${returnRecord.returnNo} - Restocked`,
                  performedBy: session.user!.id!,
                },
              });
            }
          }

          // Update return status
          return await tx.return.update({
            where: { id },
            data: {
              status: "RESTOCKED",
              processedAt: new Date(),
            },
            include: { ReturnItem: true },
          });
        });

        return NextResponse.json(result);
      }

      case "refund": {
        const { refundAmount, refundStatus } = data;

        const updated = await prisma.return.update({
          where: { id },
          data: {
            status: "REFUNDED",
            refundAmount,
            refundStatus,
          },
        });

        return NextResponse.json(updated);
      }

      case "cancel": {
        if (["RESTOCKED", "REFUNDED"].includes(returnRecord.status)) {
          return NextResponse.json(
            { error: "Cannot cancel processed return" },
            { status: 400 }
          );
        }

        const updated = await prisma.return.update({
          where: { id },
          data: { status: "DISPOSED" },
        });

        return NextResponse.json(updated);
      }

      default: {
        // Regular update
        const { reason, remarks } = data;

        const updated = await prisma.return.update({
          where: { id },
          data: { reason, remarks },
          include: { ReturnItem: true },
        });

        return NextResponse.json(updated);
      }
    }
  } catch (error) {
    console.error("Error updating return:", error);
    return NextResponse.json(
      { error: "Failed to update return" },
      { status: 500 }
    );
  }
}

// DELETE /api/returns/[id] - Delete return
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const returnRecord = await prisma.return.findUnique({
      where: { id },
    });

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    if (["RESTOCKED", "REFUNDED"].includes(returnRecord.status)) {
      return NextResponse.json(
        { error: "Cannot delete processed return" },
        { status: 400 }
      );
    }

    await prisma.return.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting return:", error);
    return NextResponse.json(
      { error: "Failed to delete return" },
      { status: 500 }
    );
  }
}
