import { NextRequest, NextResponse } from "next/server";
import { prisma, GatePassType, GatePassStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/gate-passes - List gate passes
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const locationId = searchParams.get("locationId") || "";
    const date = searchParams.get("date") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type as GatePassType;
    }

    if (status) {
      where.status = status as GatePassStatus;
    }

    if (locationId) {
      where.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.entryTime = { gte: startOfDay, lte: endOfDay };
    }

    const [gatePasses, total] = await Promise.all([
      prisma.gatePass.findMany({
        where,
        include: {
          GatePassItem: true,
          _count: { select: { GatePassItem: true } },
        },
        orderBy: { entryTime: "desc" },
        skip,
        take: limit,
      }),
      prisma.gatePass.count({ where }),
    ]);

    // Get stats for today if no date specified
    const statsWhere = { ...where };
    if (!date) {
      statsWhere.entryTime = { gte: new Date(new Date().setHours(0, 0, 0, 0)) };
    }

    const stats = await prisma.gatePass.groupBy({
      by: ["status"],
      where: statsWhere,
      _count: { _all: true },
    });

    return NextResponse.json({
      data: gatePasses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: stats.reduce((acc, s) => {
        acc[s.status] = s._count && typeof s._count === 'object' ? s._count._all ?? 0 : 0;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error("Error fetching gate passes:", error);
    return NextResponse.json(
      { error: "Failed to fetch gate passes" },
      { status: 500 }
    );
  }
}

// POST /api/gate-passes - Create gate pass
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      locationId,
      visitorName,
      visitorPhone,
      visitorIdType,
      visitorIdNo,
      companyName,
      purpose,
      transporterId,
      awbNo,
      poNo,
      invoiceNo,
      vehicleNumber,
      vehicleType,
      driverName,
      driverPhone,
      sealNumber,
      expectedDuration,
      items,
    } = body;

    if (!type || !locationId) {
      return NextResponse.json(
        { error: "Type and location are required" },
        { status: 400 }
      );
    }

    // Generate gate pass number
    const sequence = await prisma.sequence.upsert({
      where: { name: "gate_pass" },
      update: { currentValue: { increment: 1 } },
      create: { name: "gate_pass", prefix: "GP", currentValue: 1 },
    });

    const gatePassNo = `GP${String(sequence.currentValue).padStart(6, "0")}`;

    const gatePass = await prisma.gatePass.create({
      data: {
        gatePassNo,
        type: type as GatePassType,
        locationId,
        visitorName,
        visitorPhone,
        visitorIdType,
        visitorIdNo,
        companyName,
        purpose,
        transporterId,
        awbNo,
        poNo,
        invoiceNo,
        entryTime: new Date(),
        vehicleNumber,
        vehicleType,
        driverName,
        driverPhone,
        sealNumber,
        expectedDuration,
        GatePassItem: items && items.length > 0 ? {
          create: items.map((item: { skuId?: string; description?: string; quantity: number; unit?: string }) => ({
            skuId: item.skuId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
          })),
        } : undefined,
      },
      include: {
        GatePassItem: true,
      },
    });

    return NextResponse.json(gatePass, { status: 201 });
  } catch (error) {
    console.error("Error creating gate pass:", error);
    return NextResponse.json(
      { error: "Failed to create gate pass" },
      { status: 500 }
    );
  }
}
