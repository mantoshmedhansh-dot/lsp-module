import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

/**
 * Consignment Management API
 *
 * A consignment groups multiple shipments traveling on the same route/trip
 * This enables efficient handling at hubs - scan consignment instead of individual shipments
 */

// Generate consignment number: CN + YYYYMMDD + Hub Code + Seq
function generateConsignmentNumber(hubCode: string): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CN${date}${hubCode}${random}`;
}

// GET /api/consignments - List consignments with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const originHubId = searchParams.get("originHubId");
    const destinationHubId = searchParams.get("destinationHubId");
    const tripId = searchParams.get("tripId");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) where.status = status;
    if (originHubId) where.originHubId = originHubId;
    if (destinationHubId) where.destinationHubId = destinationHubId;
    if (tripId) where.tripId = tripId;
    if (search) {
      where.consignmentNumber = { contains: search };
    }

    const [consignments, total] = await Promise.all([
      prisma.consignment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { shipments: true, bags: true } },
        },
      }),
      prisma.consignment.count({ where }),
    ]);

    // Enrich with hub details
    const hubIds = [
      ...new Set([
        ...consignments.map((c) => c.originHubId),
        ...consignments.map((c) => c.destinationHubId),
      ]),
    ];
    const hubs = await prisma.hub.findMany({
      where: { id: { in: hubIds } },
      select: { id: true, code: true, name: true, city: true },
    });
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    const enrichedConsignments = consignments.map((c) => ({
      ...c,
      originHub: hubMap.get(c.originHubId),
      destinationHub: hubMap.get(c.destinationHubId),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedConsignments,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching consignments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch consignments" },
      { status: 500 }
    );
  }
}

// POST /api/consignments - Create a new consignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { originHubId, destinationHubId, routeId, notes } = body;

    // Validate hubs
    const [originHub, destHub] = await Promise.all([
      prisma.hub.findUnique({ where: { id: originHubId } }),
      prisma.hub.findUnique({ where: { id: destinationHubId } }),
    ]);

    if (!originHub) {
      return NextResponse.json(
        { success: false, error: "Origin hub not found" },
        { status: 404 }
      );
    }

    if (!destHub) {
      return NextResponse.json(
        { success: false, error: "Destination hub not found" },
        { status: 404 }
      );
    }

    // Generate consignment number
    const consignmentNumber = generateConsignmentNumber(originHub.code);

    // Create consignment
    const consignment = await prisma.consignment.create({
      data: {
        consignmentNumber,
        originHubId,
        destinationHubId,
        routeId,
        shipmentCount: 0,
        totalWeightKg: 0,
        totalVolumeCBM: 0,
        status: "OPEN",
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...consignment,
        originHub: { code: originHub.code, name: originHub.name },
        destinationHub: { code: destHub.code, name: destHub.name },
      },
    });
  } catch (error) {
    console.error("Error creating consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create consignment" },
      { status: 500 }
    );
  }
}
