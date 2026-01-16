import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate manifest number
function generateManifestNo(): string {
  const prefix = "MAN";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/manifests - List manifests
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const transporterId = searchParams.get("transporterId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { manifestNo: { contains: search, mode: "insensitive" } },
        { vehicleNo: { contains: search, mode: "insensitive" } },
        { driverName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (transporterId) {
      where.transporterId = transporterId;
    }

    const [manifests, total] = await Promise.all([
      prisma.manifest.findMany({
        where,
        include: {
          Delivery: {
            select: {
              id: true,
              deliveryNo: true,
              awbNo: true,
              status: true,
              Order: {
                select: {
                  orderNo: true,
                  customerName: true,
                  paymentMode: true,
                  totalAmount: true,
                },
              },
            },
          },
          _count: {
            select: {
              Delivery: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.manifest.count({ where }),
    ]);

    // Get transporter details for each manifest
    const transporterIds = [...new Set(manifests.map((m) => m.transporterId))];
    const transporters = await prisma.transporter.findMany({
      where: { id: { in: transporterIds } },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    const transporterMap = transporters.reduce(
      (acc, t) => {
        acc[t.id] = t;
        return acc;
      },
      {} as Record<string, typeof transporters[0]>
    );

    const manifestsWithTransporter = manifests.map((m) => ({
      ...m,
      transporter: transporterMap[m.transporterId] || null,
    }));

    // Get status counts
    const statusCounts = await prisma.manifest.groupBy({
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
      manifests: manifestsWithTransporter,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching manifests:", error);
    return NextResponse.json(
      { error: "Failed to fetch manifests" },
      { status: 500 }
    );
  }
}

// POST /api/manifests - Create a new manifest
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transporterId, deliveryIds, vehicleNo, driverName, driverPhone } = body;

    if (!transporterId) {
      return NextResponse.json(
        { error: "Transporter is required" },
        { status: 400 }
      );
    }

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return NextResponse.json(
        { error: "At least one delivery is required" },
        { status: 400 }
      );
    }

    // Verify all deliveries exist and are ready for manifest
    const deliveries = await prisma.delivery.findMany({
      where: {
        id: { in: deliveryIds },
        manifestId: null,
        awbNo: { not: null },
        status: "PACKED",
      },
    });

    if (deliveries.length !== deliveryIds.length) {
      return NextResponse.json(
        {
          error: "Some deliveries are not eligible for manifest. They must be PACKED with AWB assigned and not already in a manifest.",
        },
        { status: 400 }
      );
    }

    // Create manifest
    const manifest = await prisma.manifest.create({
      data: {
        manifestNo: generateManifestNo(),
        transporterId,
        status: "OPEN",
        vehicleNo,
        driverName,
        driverPhone,
        Delivery: {
          connect: deliveryIds.map((id: string) => ({ id })),
        },
      },
      include: {
        Delivery: {
          include: {
            Order: {
              select: {
                orderNo: true,
                customerName: true,
              },
            },
          },
        },
        _count: {
          select: {
            Delivery: true,
          },
        },
      },
    });

    // Update delivery statuses
    await prisma.delivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: { status: "MANIFESTED" },
    });

    // Update order statuses
    const orderIds = deliveries.map((d) => d.orderId);
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: "MANIFESTED" },
    });

    // Get transporter details
    const transporter = await prisma.transporter.findUnique({
      where: { id: transporterId },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      manifest: { ...manifest, transporter },
      message: `Manifest created with ${deliveryIds.length} deliveries`,
    });
  } catch (error) {
    console.error("Error creating manifest:", error);
    return NextResponse.json(
      { error: "Failed to create manifest" },
      { status: 500 }
    );
  }
}
