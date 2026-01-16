import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/zones - List zones with bins
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId") || "";
    const type = searchParams.get("type") || "";
    const includeBins = searchParams.get("includeBins") !== "false";

    // Build where clause
    const where: Record<string, unknown> = {
      isActive: true,
    };

    // Filter by location access
    if (locationId) {
      where.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    if (type) {
      where.type = type;
    }

    const zones = await prisma.zone.findMany({
      where,
      include: {
        Location: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        Bin: includeBins
          ? {
              where: { isActive: true },
              select: {
                id: true,
                code: true,
                name: true,
                capacity: true,
                _count: {
                  select: {
                    Inventory: true,
                  },
                },
              },
              orderBy: { code: "asc" },
            }
          : false,
        _count: {
          select: {
            Bin: true,
          },
        },
      },
      orderBy: [{ Location: { code: "asc" } }, { code: "asc" }],
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error("Error fetching zones:", error);
    return NextResponse.json(
      { error: "Failed to fetch zones" },
      { status: 500 }
    );
  }
}

// POST /api/zones - Create zone
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
    const { locationId, code, name, type, description } = body;

    if (!locationId || !code || !name || !type) {
      return NextResponse.json(
        { error: "Location, code, name, and type are required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.zone.findFirst({
      where: { locationId, code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Zone with this code already exists in this location" },
        { status: 400 }
      );
    }

    const zone = await prisma.zone.create({
      data: {
        locationId,
        code,
        name,
        type,
        description,
      },
      include: {
        Location: true,
      },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error("Error creating zone:", error);
    return NextResponse.json(
      { error: "Failed to create zone" },
      { status: 500 }
    );
  }
}
