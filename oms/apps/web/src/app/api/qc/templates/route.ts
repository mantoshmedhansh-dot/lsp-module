import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/qc/templates - List QC templates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [templatesRaw, total] = await Promise.all([
      prisma.qCTemplate.findMany({
        where,
        include: {
          parameters: {
            orderBy: { sequence: "asc" },
          },
          _count: {
            select: { executions: true, parameters: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.qCTemplate.count({ where }),
    ]);

    // Transform to match frontend expected format
    const templates = templatesRaw.map((template) => ({
      ...template,
      qcType: template.type, // Map type to qcType for frontend
    }));

    // Get type counts
    const typeCounts = await prisma.qCTemplate.groupBy({
      by: ["type"],
      _count: { _all: true },
    });

    const typeCountMap = typeCounts.reduce(
      (acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      templates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      typeCounts: typeCountMap,
    });
  } catch (error) {
    console.error("Error fetching QC templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch QC templates" },
      { status: 500 }
    );
  }
}

// POST /api/qc/templates - Create QC template
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
      name,
      description,
      type,
      parameters,
      isActive = true,
    } = body;

    if (!name || !type || !parameters || parameters.length === 0) {
      return NextResponse.json(
        { error: "Name, type, and at least one parameter are required" },
        { status: 400 }
      );
    }

    const template = await prisma.qCTemplate.create({
      data: {
        name,
        description,
        type,
        isActive,
        parameters: {
          create: parameters.map((param: {
            name: string;
            type: string;
            isMandatory?: boolean;
            acceptableValues?: string;
            minValue?: number;
            maxValue?: number;
            unitOfMeasure?: string;
            requiresPhoto?: boolean;
            sequence: number;
          }, index: number) => ({
            name: param.name,
            type: param.type,
            isMandatory: param.isMandatory ?? true,
            acceptableValues: param.acceptableValues,
            minValue: param.minValue,
            maxValue: param.maxValue,
            unitOfMeasure: param.unitOfMeasure,
            requiresPhoto: param.requiresPhoto ?? false,
            sequence: param.sequence ?? index + 1,
          })),
        },
      },
      include: {
        parameters: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating QC template:", error);
    return NextResponse.json(
      { error: "Failed to create QC template" },
      { status: 500 }
    );
  }
}
