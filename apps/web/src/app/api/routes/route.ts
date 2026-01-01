import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { createRouteSchema } from "@/lib/validations";

// GET /api/routes - List all routes with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const originHubId = searchParams.get("originHubId");
    const destinationHubId = searchParams.get("destinationHubId");
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (originHubId) {
      where.originHubId = originHubId;
    }

    if (destinationHubId) {
      where.destinationHubId = destinationHubId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.route.count({ where }),
    ]);

    // Fetch hub names for display
    const hubIds = new Set<string>();
    routes.forEach((route) => {
      if (route.originHubId) hubIds.add(route.originHubId);
      if (route.destinationHubId) hubIds.add(route.destinationHubId);
    });

    const hubs = await prisma.hub.findMany({
      where: { id: { in: Array.from(hubIds) } },
      select: { id: true, name: true, code: true },
    });

    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    const routesWithHubs = routes.map((route) => ({
      ...route,
      originHub: route.originHubId ? hubMap.get(route.originHubId) : null,
      destinationHub: route.destinationHubId ? hubMap.get(route.destinationHubId) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: routesWithHubs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}

// POST /api/routes - Create a new route
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createRouteSchema.parse(body);

    // Generate route code if not provided
    const code = validatedData.code || `RT-${Date.now().toString(36).toUpperCase()}`;

    // Check for duplicate code
    const existingRoute = await prisma.route.findUnique({
      where: { code },
    });

    if (existingRoute) {
      return NextResponse.json(
        { success: false, error: "Route code already exists" },
        { status: 400 }
      );
    }

    // Validate hub IDs if provided
    if (validatedData.originHubId) {
      const originHub = await prisma.hub.findUnique({
        where: { id: validatedData.originHubId },
      });
      if (!originHub) {
        return NextResponse.json(
          { success: false, error: "Origin hub not found" },
          { status: 400 }
        );
      }
    }

    if (validatedData.destinationHubId) {
      const destHub = await prisma.hub.findUnique({
        where: { id: validatedData.destinationHubId },
      });
      if (!destHub) {
        return NextResponse.json(
          { success: false, error: "Destination hub not found" },
          { status: 400 }
        );
      }
    }

    const route = await prisma.route.create({
      data: {
        ...validatedData,
        code,
      },
    });

    return NextResponse.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    console.error("Error creating route:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create route" },
      { status: 500 }
    );
  }
}
