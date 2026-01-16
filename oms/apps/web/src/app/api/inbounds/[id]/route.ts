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

// GET /api/inbounds/[id] - Get inbound details
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

    const inbound = await prisma.inbound.findUnique({
      where: { id },
      include: {
        Location: true,
        User: { select: { id: true, name: true } },
        PurchaseOrder: {
          include: {
            Vendor: true,
            POItem: {
              include: {
                SKU: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
        InboundItem: {
          include: {
            SKU: {
              select: {
                id: true,
                code: true,
                name: true,
                barcodes: true,
                isSerialised: true,
                isBatchTracked: true,
              },
            },
          },
        },
      },
    });

    if (!inbound) {
      return NextResponse.json({ error: "Inbound not found" }, { status: 404 });
    }

    return NextResponse.json(inbound);
  } catch (error) {
    console.error("Error fetching inbound:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbound" },
      { status: 500 }
    );
  }
}

// PATCH /api/inbounds/[id] - Update inbound / Actions
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

    const inbound = await prisma.inbound.findUnique({
      where: { id },
      include: {
        InboundItem: true,
        PurchaseOrder: {
          include: { POItem: true },
        },
        Location: true,
      },
    });

    if (!inbound) {
      return NextResponse.json({ error: "Inbound not found" }, { status: 404 });
    }

    switch (action) {
      case "receive-items": {
        // Update received quantities for items
        const { items } = data;
        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        for (const item of items) {
          await prisma.inboundItem.update({
            where: { id: item.id },
            data: {
              receivedQty: item.receivedQty,
              batchNo: item.batchNo,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
              mfgDate: item.mfgDate ? new Date(item.mfgDate) : undefined,
              mrp: item.mrp,
              serialNumbers: item.serialNumbers || [],
              binId: item.binId,
            },
          });
        }

        // Update status to IN_PROGRESS
        await prisma.inbound.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });

        const updated = await prisma.inbound.findUnique({
          where: { id },
          include: {
            InboundItem: {
              include: {
                SKU: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        return NextResponse.json(updated);
      }

      case "qc": {
        // QC items
        const { items } = data;
        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        for (const item of items) {
          await prisma.inboundItem.update({
            where: { id: item.id },
            data: {
              acceptedQty: item.acceptedQty,
              rejectedQty: item.rejectedQty,
              qcStatus: item.qcStatus,
              qcRemarks: item.qcRemarks,
            },
          });
        }

        // Update status
        await prisma.inbound.update({
          where: { id },
          data: { status: "QC_PENDING" },
        });

        const updated = await prisma.inbound.findUnique({
          where: { id },
          include: {
            InboundItem: {
              include: {
                SKU: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        return NextResponse.json(updated);
      }

      case "complete": {
        // Complete inbound - add to inventory
        const result = await prisma.$transaction(async (tx) => {
          const inboundItems = await tx.inboundItem.findMany({
            where: { inboundId: id },
            include: { SKU: true },
          });

          // Add items to inventory and create movements
          for (const item of inboundItems) {
            const qtyToAdd = item.acceptedQty > 0 ? item.acceptedQty : item.receivedQty;

            if (qtyToAdd <= 0 || !item.binId) continue;

            // Get bin to find location
            const bin = await tx.bin.findUnique({
              where: { id: item.binId },
              include: { Zone: true },
            });

            if (!bin) continue;

            // Update or create inventory record
            const existingInventory = await tx.inventory.findFirst({
              where: {
                skuId: item.skuId,
                binId: item.binId,
                batchNo: item.batchNo || null,
              },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantity: { increment: qtyToAdd },
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  skuId: item.skuId,
                  binId: item.binId,
                  locationId: inbound.locationId,
                  quantity: qtyToAdd,
                  batchNo: item.batchNo,
                  expiryDate: item.expiryDate,
                  mfgDate: item.mfgDate,
                  mrp: item.mrp,
                  serialNumbers: item.serialNumbers || [],
                },
              });
            }

            // Create inventory movement
            const movementNo = await generateMovementNumber();
            await tx.inventoryMovement.create({
              data: {
                movementNo,
                type: "IN",
                skuId: item.skuId,
                toBinId: item.binId,
                quantity: qtyToAdd,
                batchNo: item.batchNo,
                serialNumbers: item.serialNumbers || [],
                referenceType: "INBOUND",
                referenceId: inbound.id,
                reason: `Inbound ${inbound.inboundNo}`,
                performedBy: session.user!.id!,
              },
            });
          }

          // Update PO received quantities if linked
          if (inbound.purchaseOrderId && inbound.PurchaseOrder) {
            for (const item of inboundItems) {
              const qtyReceived = item.acceptedQty > 0 ? item.acceptedQty : item.receivedQty;

              const poItem = inbound.PurchaseOrder.POItem.find(
                (pi) => pi.skuId === item.skuId
              );

              if (poItem) {
                await tx.pOItem.update({
                  where: { id: poItem.id },
                  data: {
                    receivedQty: { increment: qtyReceived },
                  },
                });
              }
            }

            // Check if PO is fully received
            const updatedPOItems = await tx.pOItem.findMany({
              where: { purchaseOrderId: inbound.purchaseOrderId },
            });

            const allReceived = updatedPOItems.every(
              (item) => item.receivedQty >= item.orderedQty
            );
            const someReceived = updatedPOItems.some(
              (item) => item.receivedQty > 0
            );

            await tx.purchaseOrder.update({
              where: { id: inbound.purchaseOrderId },
              data: {
                status: allReceived
                  ? "RECEIVED"
                  : someReceived
                  ? "PARTIALLY_RECEIVED"
                  : undefined,
              },
            });
          }

          // Complete inbound
          return await tx.inbound.update({
            where: { id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
            include: {
              InboundItem: {
                include: {
                  SKU: { select: { id: true, code: true, name: true } },
                },
              },
            },
          });
        });

        return NextResponse.json(result);
      }

      case "cancel": {
        if (inbound.status === "COMPLETED") {
          return NextResponse.json(
            { error: "Cannot cancel completed inbound" },
            { status: 400 }
          );
        }

        const updated = await prisma.inbound.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        return NextResponse.json(updated);
      }

      default: {
        // Regular update
        const { remarks } = data;

        const updated = await prisma.inbound.update({
          where: { id },
          data: { remarks },
          include: {
            InboundItem: {
              include: {
                SKU: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        return NextResponse.json(updated);
      }
    }
  } catch (error) {
    console.error("Error updating inbound:", error);
    return NextResponse.json(
      { error: "Failed to update inbound" },
      { status: 500 }
    );
  }
}

// DELETE /api/inbounds/[id] - Delete inbound
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

    const inbound = await prisma.inbound.findUnique({
      where: { id },
    });

    if (!inbound) {
      return NextResponse.json({ error: "Inbound not found" }, { status: 404 });
    }

    if (inbound.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete completed inbound" },
        { status: 400 }
      );
    }

    await prisma.inbound.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting inbound:", error);
    return NextResponse.json(
      { error: "Failed to delete inbound" },
      { status: 500 }
    );
  }
}
