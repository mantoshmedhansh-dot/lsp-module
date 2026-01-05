import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";

/**
 * Pincode-to-Pincode SLA API
 *
 * Manages lane-level SLA definitions for origin-destination pincode pairs
 */

// GET /api/pincodes/sla - List SLA entries with filters
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const originPincode = searchParams.get("originPincode");
    const destinationPincode = searchParams.get("destinationPincode");
    const serviceType = searchParams.get("serviceType");
    const routeType = searchParams.get("routeType");
    const search = searchParams.get("search");

    const where: any = { isActive: true };

    if (originPincode) where.originPincode = originPincode;
    if (destinationPincode) where.destinationPincode = destinationPincode;
    if (serviceType) where.serviceType = serviceType;
    if (routeType) where.routeType = routeType;

    if (search) {
      where.OR = [
        { originPincode: { contains: search } },
        { destinationPincode: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.pincodeToSla.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ originPincode: "asc" }, { destinationPincode: "asc" }],
      }),
      prisma.pincodeToSla.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.pincodeToSla.groupBy({
      by: ["serviceType"],
      where: { isActive: true },
      _count: true,
    });

    const uniqueOrigins = await prisma.pincodeToSla.findMany({
      where: { isActive: true },
      select: { originPincode: true },
      distinct: ["originPincode"],
    });

    const uniqueDestinations = await prisma.pincodeToSla.findMany({
      where: { isActive: true },
      select: { destinationPincode: true },
      distinct: ["destinationPincode"],
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        stats: {
          totalLanes: total,
          uniqueOrigins: uniqueOrigins.length,
          uniqueDestinations: uniqueDestinations.length,
          byServiceType: stats.reduce((acc, s) => {
            acc[s.serviceType] = s._count;
            return acc;
          }, {} as Record<string, number>),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching SLA data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch SLA data" },
      { status: 500 }
    );
  }
}

// POST /api/pincodes/sla - Create or update SLA entry
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();

    const {
      originPincode,
      destinationPincode,
      serviceType = "STANDARD",
      tatDays,
      minDays = 1,
      maxDays,
      routeType,
      originZone,
      destinationZone,
      baseRate,
      ratePerKg,
      codAvailable = true,
      reverseAvailable = true,
      slaPercentage = 95,
    } = body;

    // Validate required fields
    if (!originPincode || !/^\d{6}$/.test(originPincode)) {
      return NextResponse.json(
        { success: false, error: "Invalid origin pincode" },
        { status: 400 }
      );
    }

    if (!destinationPincode || !/^\d{6}$/.test(destinationPincode)) {
      return NextResponse.json(
        { success: false, error: "Invalid destination pincode" },
        { status: 400 }
      );
    }

    if (!tatDays || tatDays < 1) {
      return NextResponse.json(
        { success: false, error: "TAT days must be at least 1" },
        { status: 400 }
      );
    }

    // Upsert the SLA entry
    const sla = await prisma.pincodeToSla.upsert({
      where: {
        originPincode_destinationPincode_serviceType: {
          originPincode,
          destinationPincode,
          serviceType,
        },
      },
      update: {
        tatDays,
        minDays,
        maxDays: maxDays || tatDays + 1,
        routeType,
        originZone,
        destinationZone,
        baseRate,
        ratePerKg,
        codAvailable,
        reverseAvailable,
        slaPercentage,
        isActive: true,
      },
      create: {
        originPincode,
        destinationPincode,
        serviceType,
        tatDays,
        minDays,
        maxDays: maxDays || tatDays + 1,
        routeType,
        originZone,
        destinationZone,
        baseRate,
        ratePerKg,
        codAvailable,
        reverseAvailable,
        slaPercentage,
      },
    });

    return NextResponse.json({
      success: true,
      data: sla,
    });
  } catch (error) {
    console.error("Error creating SLA:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create SLA entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/pincodes/sla - Delete SLA entry
export async function DELETE(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 }
      );
    }

    await prisma.pincodeToSla.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SLA:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete SLA entry" },
      { status: 500 }
    );
  }
}
