import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/virtual-inventory - List virtual inventory
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const skuId = searchParams.get("skuId");
    const locationId = searchParams.get("locationId");
    const channel = searchParams.get("channel");

    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (skuId) where.skuId = skuId;
    if (locationId) where.locationId = locationId;
    if (channel) where.channel = channel;

    const [virtualInventory, total] = await Promise.all([
      prisma.virtualInventory.findMany({
        where,
        include: {
          SKU: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          Location: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.virtualInventory.count({ where }),
    ]);

    return NextResponse.json({
      data: virtualInventory,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching virtual inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch virtual inventory" },
      { status: 500 }
    );
  }
}

// POST /api/virtual-inventory - Create virtual inventory
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
    const {
      skuId,
      locationId,
      type,
      channel,
      channelConfigId,
      quantity,
      validFrom,
      validTo,
      referenceType,
      referenceId,
    } = body;

    // Validate required fields
    if (!skuId || !locationId || !type) {
      return NextResponse.json(
        { error: "skuId, locationId, and type are required" },
        { status: 400 }
      );
    }

    // Check if SKU exists
    const sku = await prisma.sKU.findUnique({ where: { id: skuId } });
    if (!sku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    // Check if location exists
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Check for existing virtual inventory of same type
    const existing = await prisma.virtualInventory.findFirst({
      where: {
        skuId,
        locationId,
        type,
        channel: channel || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Virtual inventory already exists for this SKU/Location/Type combination" },
        { status: 400 }
      );
    }

    const virtualInventory = await prisma.virtualInventory.create({
      data: {
        skuId,
        locationId,
        type,
        channel,
        channelConfigId,
        quantity: quantity || 0,
        allocatedQty: 0,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        referenceType,
        referenceId,
        createdById: session.user.id,
      },
      include: {
        SKU: {
          select: { id: true, code: true, name: true },
        },
        Location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json(virtualInventory, { status: 201 });
  } catch (error) {
    console.error("Error creating virtual inventory:", error);
    return NextResponse.json(
      { error: "Failed to create virtual inventory" },
      { status: 500 }
    );
  }
}
