import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate Wave number
async function generateWaveNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "wave" },
    update: { currentValue: { increment: 1 } },
    create: { name: "wave", prefix: "WAVE", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "WAVE"}${paddedNumber}`;
}

// GET /api/waves - List waves
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const locationId = searchParams.get("locationId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (search) {
      where.OR = [
        { waveNo: { contains: search, mode: "insensitive" } },
      ];
    }

    const [wavesRaw, total] = await Promise.all([
      prisma.wave.findMany({
        where,
        include: {
          Location: {
            select: { id: true, code: true, name: true },
          },
          User: {
            select: { id: true, name: true },
          },
          WaveItem: {
            select: { pickedQty: true, totalQty: true },
          },
          _count: {
            select: { WaveOrder: true, WaveItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.wave.count({ where }),
    ]);

    // Transform waves to match frontend expected format
    const waves = wavesRaw.map((wave) => {
      const totalItems = wave.WaveItem.reduce((sum, item) => sum + item.totalQty, 0);
      const pickedItems = wave.WaveItem.reduce((sum, item) => sum + item.pickedQty, 0);
      const completionPercentage = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;

      return {
        ...wave,
        waveType: wave.type, // Map type to waveType for frontend
        location: wave.Location, // Map Location to location for frontend
        assignedToUser: wave.User, // Map User to assignedToUser
        _count: {
          orders: wave._count.WaveOrder,
          items: wave._count.WaveItem,
        },
        stats: {
          totalOrders: wave.totalOrders,
          totalItems,
          pickedItems,
          completionPercentage,
        },
        WaveItem: undefined, // Remove raw WaveItem from response
      };
    });

    // Get status counts
    const statusCounts = await prisma.wave.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      waves,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching waves:", error);
    return NextResponse.json(
      { error: "Failed to fetch waves" },
      { status: 500 }
    );
  }
}

// POST /api/waves - Create wave
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "WAREHOUSE_STAFF"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      locationId,
      type = "BATCH_PICK",
      priority = 50,
      assignedToId,
      orderIds,
      autoOptimize = true,
    } = body;

    if (!locationId || !orderIds || orderIds.length === 0) {
      return NextResponse.json(
        { error: "Location and orders are required" },
        { status: 400 }
      );
    }

    // Validate location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Validate orders exist and are in correct status
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ["CONFIRMED", "PROCESSING"] },
      },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "No valid orders found for wave picking" },
        { status: 400 }
      );
    }

    const waveNo = await generateWaveNumber();

    // Create wave with orders
    const wave = await prisma.$transaction(async (tx) => {
      // Create the wave
      const newWave = await tx.wave.create({
        data: {
          waveNo,
          type,
          status: "DRAFT",
          locationId,
          totalOrders: orders.length,
          totalItems: orders.reduce((sum, o) => sum + o.OrderItem.length, 0),
          totalUnits: orders.reduce(
            (sum, o) => sum + o.OrderItem.reduce((s, i) => s + i.quantity, 0),
            0
          ),
          createdById: session.user.id,
          assignedToId: assignedToId || null,
        },
      });

      // Create wave orders
      for (const order of orders) {
        await tx.waveOrder.create({
          data: {
            waveId: newWave.id,
            orderId: order.id,
            sequence: 0, // Will be optimized later
          },
        });
      }

      // Aggregate items by SKU for wave items
      const skuItemMap = new Map<string, { skuId: string; totalQty: number; pickedQty: number }>();

      for (const order of orders) {
        for (const item of order.OrderItem) {
          const existing = skuItemMap.get(item.skuId);
          if (existing) {
            existing.totalQty += item.quantity;
          } else {
            skuItemMap.set(item.skuId, {
              skuId: item.skuId,
              totalQty: item.quantity,
              pickedQty: 0,
            });
          }
        }
      }

      // Find bin locations for SKUs
      for (const [skuId, itemData] of skuItemMap) {
        // Find inventory bin for this SKU at this location
        const inventory = await tx.inventory.findFirst({
          where: {
            skuId,
            locationId,
          },
          include: {
            Bin: true,
          },
        });

        if (inventory?.binId) {
          await tx.waveItem.create({
            data: {
              waveId: newWave.id,
              skuId,
              binId: inventory.binId,
              totalQty: itemData.totalQty,
              pickedQty: 0,
              sequence: 0, // Will be optimized
            },
          });
        }
      }

      return newWave;
    });

    // Fetch the complete wave with relations
    const completeWave = await prisma.wave.findUnique({
      where: { id: wave.id },
      include: {
        Location: true,
        WaveOrder: {
          include: {
            Order: {
              select: { id: true, orderNo: true, status: true },
            },
          },
        },
        WaveItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true },
            },
            Bin: {
              select: { id: true, code: true },
            },
          },
        },
        _count: {
          select: { WaveOrder: true, WaveItem: true },
        },
      },
    });

    // Auto-optimize if requested
    if (autoOptimize) {
      // Simple zone-based optimization
      await optimizeWaveSequence(wave.id);
    }

    return NextResponse.json(completeWave, { status: 201 });
  } catch (error) {
    console.error("Error creating wave:", error);
    return NextResponse.json(
      { error: "Failed to create wave" },
      { status: 500 }
    );
  }
}

// Helper function to optimize wave picking sequence
async function optimizeWaveSequence(waveId: string): Promise<void> {
  try {
    // Get wave items with bin locations
    const waveItems = await prisma.waveItem.findMany({
      where: { waveId },
      include: {
        Bin: true,
      },
    });

    // Sort by zone code -> aisle -> rack -> level for optimal picking path
    const sortedItems = [...waveItems].sort((a, b) => {
      // Sort by zone code first (stored in WaveItem)
      const zoneCompare = (a.zoneCode || "").localeCompare(b.zoneCode || "");
      if (zoneCompare !== 0) return zoneCompare;

      // Then by aisle (stored in WaveItem)
      const aisleCompare = (a.aisle || "").localeCompare(b.aisle || "");
      if (aisleCompare !== 0) return aisleCompare;

      // Then by rack (stored in WaveItem)
      const rackCompare = (a.rack || "").localeCompare(b.rack || "");
      if (rackCompare !== 0) return rackCompare;

      // Finally by level (stored in WaveItem)
      return (a.level || "").localeCompare(b.level || "");
    });

    // Update sequences
    await prisma.$transaction(
      sortedItems.map((item, index) =>
        prisma.waveItem.update({
          where: { id: item.id },
          data: { sequence: index + 1 },
        })
      )
    );
  } catch (error) {
    console.error("Error optimizing wave sequence:", error);
  }
}
