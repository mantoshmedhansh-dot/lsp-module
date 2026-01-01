import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { createVehicleSchema } from "@/lib/validations";

// GET /api/vehicles - List vehicles with filtering
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const hubId = searchParams.get("hubId");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (hubId) {
      where.currentHubId = hubId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { registrationNo: { contains: search } },
        { make: { contains: search } },
        { model: { contains: search } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          _count: {
            select: {
              maintenanceLogs: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vehicle.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: vehicles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch vehicles" } },
      { status: 500 }
    );
  }
}

// POST /api/vehicles - Register new vehicle
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const validated = createVehicleSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0].message,
            details: validated.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Check if registration number already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { registrationNo: data.registrationNo.toUpperCase() },
    });

    if (existingVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_REGISTRATION",
            message: `Vehicle with registration ${data.registrationNo} already exists`,
          },
        },
        { status: 400 }
      );
    }

    // Create the vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNo: data.registrationNo.toUpperCase(),
        type: data.type,
        capacityTonnage: data.capacityTonnage,
        capacityVolumeCBM: data.capacityVolumeCBM,
        lengthFt: data.lengthFt || null,
        widthFt: data.widthFt || null,
        heightFt: data.heightFt || null,
        make: data.make || null,
        model: data.model || null,
        year: data.year || null,
        fuelType: data.fuelType,
        rcExpiryDate: data.rcExpiryDate || null,
        insuranceExpiry: data.insuranceExpiry || null,
        fitnessExpiry: data.fitnessExpiry || null,
        permitExpiry: data.permitExpiry || null,
        pollutionExpiry: data.pollutionExpiry || null,
        currentHubId: data.currentHubId || null,
        ownershipType: data.ownershipType,
        ownerName: data.ownerName || null,
        ownerPhone: data.ownerPhone || null,
        gpsDeviceId: data.gpsDeviceId || null,
      },
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_ERROR", message: "Failed to register vehicle" } },
      { status: 500 }
    );
  }
}
