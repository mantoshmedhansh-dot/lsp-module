import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { createHubSchema } from "@/lib/validations";

// GET /api/hubs - List hubs with filtering
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const city = searchParams.get("city");
    const state = searchParams.get("state");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    const hubId = searchParams.get("hubId");
    const where: any = {};

    // If specific hubId is provided, filter to that hub
    if (hubId) {
      where.id = hubId;
    }

    if (type) {
      where.type = type;
    }

    if (city) {
      where.city = { contains: city };
    }

    if (state) {
      where.state = { contains: state };
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [hubs, total] = await Promise.all([
      prisma.hub.findMany({
        where,
        include: {
          _count: {
            select: {
              staff: true,
              servicedPincodes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.hub.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: hubs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching hubs:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch hubs" } },
      { status: 500 }
    );
  }
}

// POST /api/hubs - Create new hub
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const validated = createHubSchema.safeParse(body);

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

    // Check if hub code already exists
    const existingHub = await prisma.hub.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existingHub) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DUPLICATE_CODE",
            message: `Hub with code ${data.code} already exists`,
          },
        },
        { status: 400 }
      );
    }

    // Create the hub
    const hub = await prisma.hub.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        type: data.type,
        address: data.address,
        pincode: data.pincode,
        city: data.city,
        state: data.state,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        totalBays: data.totalBays,
        loadingBays: data.loadingBays,
        unloadingBays: data.unloadingBays,
        sortingCapacity: data.sortingCapacity,
        operatingHoursStart: data.operatingHoursStart,
        operatingHoursEnd: data.operatingHoursEnd,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail || null,
      },
    });

    return NextResponse.json({ success: true, data: hub }, { status: 201 });
  } catch (error) {
    console.error("Error creating hub:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_ERROR", message: "Failed to create hub" } },
      { status: 500 }
    );
  }
}
