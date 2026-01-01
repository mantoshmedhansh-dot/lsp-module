import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { createDriverSchema } from "@/lib/validations";

// GET /api/drivers - List drivers with filtering
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const hubId = searchParams.get("hubId");
    const licenseType = searchParams.get("licenseType");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (hubId) {
      where.currentHubId = hubId;
    }

    if (licenseType) {
      where.licenseType = licenseType;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeCode: { contains: search } },
        { phone: { contains: search } },
        { licenseNumber: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: {
          _count: {
            select: {
              leaves: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.driver.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: drivers,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch drivers" } },
      { status: 500 }
    );
  }
}

// POST /api/drivers - Create new driver
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const validated = createDriverSchema.safeParse(body);

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

    // Check for duplicate employee code
    const existingByCode = await prisma.driver.findUnique({
      where: { employeeCode: data.employeeCode },
    });

    if (existingByCode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_CODE",
            message: `Driver with employee code ${data.employeeCode} already exists`,
          },
        },
        { status: 400 }
      );
    }

    // Check for duplicate license number
    const existingByLicense = await prisma.driver.findUnique({
      where: { licenseNumber: data.licenseNumber },
    });

    if (existingByLicense) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_LICENSE",
            message: `Driver with license number ${data.licenseNumber} already exists`,
          },
        },
        { status: 400 }
      );
    }

    // Create the driver
    const driver = await prisma.driver.create({
      data: {
        employeeCode: data.employeeCode,
        name: data.name,
        phone: data.phone,
        altPhone: data.altPhone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        licenseNumber: data.licenseNumber,
        licenseType: data.licenseType,
        licenseExpiry: data.licenseExpiry,
        licenseState: data.licenseState || null,
        aadharNumber: data.aadharNumber || null,
        panNumber: data.panNumber || null,
        currentHubId: data.currentHubId || null,
        joiningDate: data.joiningDate,
        yearsExperience: data.yearsExperience || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
      },
    });

    return NextResponse.json({ success: true, data: driver }, { status: 201 });
  } catch (error) {
    console.error("Error creating driver:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_ERROR", message: "Failed to create driver" } },
      { status: 500 }
    );
  }
}
