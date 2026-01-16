import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/cycle-counts - List cycle counts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const locationId = searchParams.get("locationId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (locationId) {
      where.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    const [cycleCounts, total] = await Promise.all([
      prisma.cycleCount.findMany({
        where,
        include: {
          _count: { select: { CycleCountItem: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.cycleCount.count({ where }),
    ]);

    return NextResponse.json({
      data: cycleCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching cycle counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycle counts" },
      { status: 500 }
    );
  }
}

// POST /api/cycle-counts - Create cycle count
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { locationId, zoneId, scheduledDate, remarks, skuIds, binIds } = body;

    if (!locationId || !scheduledDate) {
      return NextResponse.json(
        { error: "Location and scheduled date are required" },
        { status: 400 }
      );
    }

    // Generate cycle count number
    const sequence = await prisma.sequence.upsert({
      where: { name: "cycle_count" },
      update: { currentValue: { increment: 1 } },
      create: { name: "cycle_count", prefix: "CC", currentValue: 1 },
    });

    const cycleCountNo = `CC${String(sequence.currentValue).padStart(6, "0")}`;

    // Build inventory filter for items
    const inventoryWhere: Record<string, unknown> = {
      locationId,
      quantity: { gt: 0 },
    };

    if (zoneId) {
      inventoryWhere.bin = { zoneId };
    }

    if (skuIds && skuIds.length > 0) {
      inventoryWhere.skuId = { in: skuIds };
    }

    if (binIds && binIds.length > 0) {
      inventoryWhere.binId = { in: binIds };
    }

    // Get inventory items to count
    const inventoryItems = await prisma.inventory.findMany({
      where: inventoryWhere,
      select: {
        skuId: true,
        binId: true,
        batchNo: true,
        quantity: true,
      },
    });

    if (inventoryItems.length === 0) {
      return NextResponse.json(
        { error: "No inventory items found for the specified criteria" },
        { status: 400 }
      );
    }

    // Create cycle count with items
    const cycleCount = await prisma.cycleCount.create({
      data: {
        cycleCountNo,
        locationId,
        zoneId,
        initiatedById: session.user.id!,
        scheduledDate: new Date(scheduledDate),
        remarks,
        CycleCountItem: {
          create: inventoryItems.map((item) => ({
            skuId: item.skuId,
            binId: item.binId,
            batchNo: item.batchNo,
            expectedQty: item.quantity,
            status: "PENDING",
          })),
        },
      },
      include: {
        CycleCountItem: true,
        _count: { select: { CycleCountItem: true } },
      },
    });

    return NextResponse.json(cycleCount, { status: 201 });
  } catch (error) {
    console.error("Error creating cycle count:", error);
    return NextResponse.json(
      { error: "Failed to create cycle count" },
      { status: 500 }
    );
  }
}
