import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/picklists/[id] - Get picklist details
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

    const picklist = await prisma.picklist.findUnique({
      where: { id },
      include: {
        Order: {
          include: {
            Location: true,
            OrderItem: {
              include: {
                SKU: true,
              },
            },
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        PicklistItem: {
          include: {
            SKU: {
              select: {
                id: true,
                code: true,
                name: true,
                barcodes: true,
                weight: true,
                isSerialised: true,
              },
            },
            Bin: {
              include: {
                Zone: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { Bin: { Zone: { code: "asc" } } },
            { Bin: { code: "asc" } },
          ],
        },
      },
    });

    if (!picklist) {
      return NextResponse.json({ error: "Picklist not found" }, { status: 404 });
    }

    return NextResponse.json(picklist);
  } catch (error) {
    console.error("Error fetching picklist:", error);
    return NextResponse.json(
      { error: "Failed to fetch picklist" },
      { status: 500 }
    );
  }
}

// PATCH /api/picklists/[id] - Update picklist (assign, start, complete)
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
    const { action, assignedToId } = body;

    const picklist = await prisma.picklist.findUnique({
      where: { id },
      include: {
        PicklistItem: true,
        Order: true,
      },
    });

    if (!picklist) {
      return NextResponse.json({ error: "Picklist not found" }, { status: 404 });
    }

    switch (action) {
      case "assign": {
        if (!assignedToId) {
          return NextResponse.json(
            { error: "User ID required for assignment" },
            { status: 400 }
          );
        }

        const updated = await prisma.picklist.update({
          where: { id },
          data: { assignedToId },
        });

        return NextResponse.json(updated);
      }

      case "start": {
        if (picklist.status !== "PENDING") {
          return NextResponse.json(
            { error: "Picklist is not in PENDING status" },
            { status: 400 }
          );
        }

        const updated = await prisma.picklist.update({
          where: { id },
          data: {
            status: "PROCESSING",
            startedAt: new Date(),
            assignedToId: picklist.assignedToId || session.user.id,
          },
        });

        // Update order status
        await prisma.order.update({
          where: { id: picklist.orderId },
          data: { status: "PICKING" },
        });

        return NextResponse.json(updated);
      }

      case "complete": {
        // Check if all items are picked
        const allPicked = picklist.PicklistItem.every(
          (item) => item.pickedQty >= item.requiredQty
        );

        if (!allPicked) {
          return NextResponse.json(
            { error: "Not all items have been picked" },
            { status: 400 }
          );
        }

        const updated = await prisma.picklist.update({
          where: { id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

        // Update order status and item statuses
        await prisma.order.update({
          where: { id: picklist.orderId },
          data: { status: "PICKED" },
        });

        // Update order items pickedQty
        for (const plItem of picklist.PicklistItem) {
          await prisma.orderItem.updateMany({
            where: {
              orderId: picklist.orderId,
              skuId: plItem.skuId,
            },
            data: {
              pickedQty: { increment: plItem.pickedQty },
              status: "PICKED",
            },
          });
        }

        return NextResponse.json(updated);
      }

      case "cancel": {
        if (picklist.status === "COMPLETED") {
          return NextResponse.json(
            { error: "Cannot cancel completed picklist" },
            { status: 400 }
          );
        }

        const updated = await prisma.picklist.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        // Revert order status
        await prisma.order.update({
          where: { id: picklist.orderId },
          data: { status: "ALLOCATED" },
        });

        return NextResponse.json(updated);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating picklist:", error);
    return NextResponse.json(
      { error: "Failed to update picklist" },
      { status: 500 }
    );
  }
}
