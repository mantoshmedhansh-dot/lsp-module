import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/brands - List all brands/clients
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can access brands
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const companyId = searchParams.get("companyId") || "";
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        include: {
          Company: {
            select: { id: true, name: true },
          },
          _count: {
            select: { SKUBrand: true, BrandUser: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.brand.count({ where }),
    ]);

    return NextResponse.json({
      data: brands,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

// POST /api/brands - Create a new brand
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can create brands
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, companyId, description, logo, website, contactEmail, contactPhone, isActive } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: "Name and company are required" },
        { status: 400 }
      );
    }

    // Generate code if not provided
    const brandCode = code || name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

    // Check if code already exists
    const existingBrand = await prisma.brand.findUnique({
      where: { code: brandCode },
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: "Brand code already exists" },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        code: brandCode,
        companyId,
        description: description || null,
        logo: logo || null,
        website: website || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        isActive: isActive !== false,
      },
      include: {
        Company: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error) {
    console.error("Error creating brand:", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
