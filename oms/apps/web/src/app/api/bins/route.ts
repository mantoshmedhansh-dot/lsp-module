import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/bins - List bins
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const locationId = searchParams.get("locationId") || "";
    const zoneId = searchParams.get("zoneId") || "";
    const zoneType = searchParams.get("zoneType") || "";

    // Build where clause
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (zoneId) {
      where.zoneId = zoneId;
    }

    if (zoneType) {
      where.zone = { type: zoneType };
    }

    // Filter by location
    if (locationId) {
      where.zone = {
        ...(where.zone as object || {}),
        locationId,
      };
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.zone = {
        ...(where.zone as object || {}),
        locationId: { in: session.user.locationAccess },
      };
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const bins = await prisma.bin.findMany({
      where,
      include: {
        Zone: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            Location: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            Inventory: true,
          },
        },
      },
      orderBy: [
        { Zone: { Location: { code: "asc" } } },
        { Zone: { code: "asc" } },
        { code: "asc" },
      ],
    });

    return NextResponse.json(bins);
  } catch (error) {
    console.error("Error fetching bins:", error);
    return NextResponse.json(
      { error: "Failed to fetch bins" },
      { status: 500 }
    );
  }
}

// POST /api/bins - Create bin
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
    const { zoneId, code, name, description, capacity } = body;

    if (!zoneId || !code) {
      return NextResponse.json(
        { error: "Zone and code are required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.bin.findFirst({
      where: { zoneId, code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bin with this code already exists in this zone" },
        { status: 400 }
      );
    }

    const bin = await prisma.bin.create({
      data: {
        zoneId,
        code,
        name,
        description,
        capacity,
      },
      include: {
        Zone: {
          include: {
            Location: true,
          },
        },
      },
    });

    return NextResponse.json(bin, { status: 201 });
  } catch (error) {
    console.error("Error creating bin:", error);
    return NextResponse.json(
      { error: "Failed to create bin" },
      { status: 500 }
    );
  }
}
