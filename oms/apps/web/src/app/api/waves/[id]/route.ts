import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/waves/[id] - Get wave details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wave = await prisma.wave.findUnique({
      where: { id },
      include: {
        Location: true,
        User: {
          select: { id: true, name: true, email: true },
        },
        WaveOrder: {
          include: {
            Order: {
              include: {
                OrderItem: {
                  include: {
                    SKU: {
                      select: { id: true, code: true, name: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { sequence: "asc" },
        },
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
            WaveItemDistribution: true,
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!wave) {
      return NextResponse.json({ error: "Wave not found" }, { status: 404 });
    }

    // Calculate stats
    const totalItems = wave.WaveItem.reduce((sum, item) => sum + item.totalQty, 0);
    const pickedItems = wave.WaveItem.reduce((sum, item) => sum + item.pickedQty, 0);
    const completionPercentage = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;

    // Transform to match frontend expected format
    const transformedWave = {
      ...wave,
      waveType: wave.type,
      location: wave.Location,
      assignedToUser: wave.User,
      waveOrders: wave.WaveOrder,
      waveItems: wave.WaveItem,
      stats: {
        totalOrders: wave.totalOrders,
        totalItems,
        pickedItems,
        completionPercentage,
      },
    };

    return NextResponse.json(transformedWave);
  } catch (error) {
    console.error("Error fetching wave:", error);
    return NextResponse.json(
      { error: "Failed to fetch wave" },
      { status: 500 }
    );
  }
}

// PATCH /api/waves/[id] - Update wave
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const wave = await prisma.wave.findUnique({ where: { id } });

    if (!wave) {
      return NextResponse.json({ error: "Wave not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, assignedTo, priority, action } = body;

    // Handle status transitions
    if (action) {
      switch (action) {
        case "release":
          if (wave.status !== "DRAFT" && wave.status !== "PLANNED") {
            return NextResponse.json(
              { error: "Wave can only be released from DRAFT or PLANNED status" },
              { status: 400 }
            );
          }

          const releasedWave = await prisma.wave.update({
            where: { id },
            data: {
              status: "RELEASED",
              releasedAt: new Date(),
            },
            include: {
              Location: true,
              _count: { select: { WaveOrder: true, WaveItem: true } },
            },
          });
          return NextResponse.json(releasedWave);

        case "start":
          if (wave.status !== "RELEASED") {
            return NextResponse.json(
              { error: "Wave can only be started from RELEASED status" },
              { status: 400 }
            );
          }

          const startedWave = await prisma.wave.update({
            where: { id },
            data: {
              status: "IN_PROGRESS",
              startedAt: new Date(),
            },
            include: {
              Location: true,
              _count: { select: { WaveOrder: true, WaveItem: true } },
            },
          });
          return NextResponse.json(startedWave);

        case "complete":
          if (wave.status !== "IN_PROGRESS") {
            return NextResponse.json(
              { error: "Wave can only be completed from IN_PROGRESS status" },
              { status: 400 }
            );
          }

          // Check if all items are picked - get all wave items and filter
          const allWaveItems = await prisma.waveItem.findMany({
            where: { waveId: id },
            select: { pickedQty: true, totalQty: true },
          });
          const unpickedItems = allWaveItems.filter(item => item.pickedQty < item.totalQty).length;

          if (unpickedItems > 0) {
            return NextResponse.json(
              { error: `Cannot complete wave: ${unpickedItems} items not fully picked` },
              { status: 400 }
            );
          }

          const completedWave = await prisma.wave.update({
            where: { id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
            include: {
              Location: true,
              _count: { select: { WaveOrder: true, WaveItem: true } },
            },
          });
          return NextResponse.json(completedWave);

        case "cancel":
          if (wave.status === "COMPLETED") {
            return NextResponse.json(
              { error: "Cannot cancel a completed wave" },
              { status: 400 }
            );
          }

          const cancelledWave = await prisma.wave.update({
            where: { id },
            data: {
              status: "CANCELLED",
            },
            include: {
              Location: true,
              _count: { select: { WaveOrder: true, WaveItem: true } },
            },
          });
          return NextResponse.json(cancelledWave);

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    }

    // Regular update
    const updateData: Record<string, unknown> = {};

    if (status) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedToId = assignedTo;

    const updatedWave = await prisma.wave.update({
      where: { id },
      data: updateData,
      include: {
        Location: true,
        User: {
          select: { id: true, name: true },
        },
        _count: {
          select: { WaveOrder: true, WaveItem: true },
        },
      },
    });

    return NextResponse.json(updatedWave);
  } catch (error) {
    console.error("Error updating wave:", error);
    return NextResponse.json(
      { error: "Failed to update wave" },
      { status: 500 }
    );
  }
}

// DELETE /api/waves/[id] - Delete wave
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const wave = await prisma.wave.findUnique({ where: { id } });

    if (!wave) {
      return NextResponse.json({ error: "Wave not found" }, { status: 404 });
    }

    if (wave.status === "IN_PROGRESS" || wave.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete a wave that is in progress or completed" },
        { status: 400 }
      );
    }

    // Delete in transaction (cascade will handle related records)
    await prisma.$transaction(async (tx) => {
      // Delete wave item distributions
      await tx.waveItemDistribution.deleteMany({
        where: { WaveItem: { waveId: id } },
      });

      // Delete wave items
      await tx.waveItem.deleteMany({ where: { waveId: id } });

      // Delete wave orders
      await tx.waveOrder.deleteMany({ where: { waveId: id } });

      // Delete the wave
      await tx.wave.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting wave:", error);
    return NextResponse.json(
      { error: "Failed to delete wave" },
      { status: 500 }
    );
  }
}
