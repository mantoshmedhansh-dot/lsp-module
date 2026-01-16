import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/bundles - List bundles
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
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (isActive !== null) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { bundleSku: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [bundles, total] = await Promise.all([
      prisma.sKUBundle.findMany({
        where,
        include: {
          SKU: {
            select: { id: true, code: true, name: true, mrp: true },
          },
          BundleItem: {
            include: {
              SKU: {
                select: { id: true, code: true, name: true, mrp: true },
              },
            },
          },
          _count: {
            select: { BundleItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sKUBundle.count({ where }),
    ]);

    return NextResponse.json({
      data: bundles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return NextResponse.json(
      { error: "Failed to fetch bundles" },
      { status: 500 }
    );
  }
}

// POST /api/bundles - Create bundle
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
      bundleSkuId,
      companyId,
      type,
      name,
      description,
      items,
      pricingType,
      fixedPrice,
      discountPercent,
      validFrom,
      validTo,
    } = body;

    // Validate required fields
    if (!bundleSkuId || !name || !items || items.length === 0) {
      return NextResponse.json(
        { error: "bundleSkuId, name, and items are required" },
        { status: 400 }
      );
    }

    // Check if bundle SKU exists
    const bundleSku = await prisma.sKU.findUnique({ where: { id: bundleSkuId } });
    if (!bundleSku) {
      return NextResponse.json({ error: "Bundle SKU not found" }, { status: 404 });
    }

    // Check if bundle already exists for this SKU
    const existing = await prisma.sKUBundle.findUnique({
      where: { bundleSkuId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bundle already exists for this SKU" },
        { status: 400 }
      );
    }

    // Validate component SKUs exist
    const componentIds = items.map((item: { componentSkuId: string }) => item.componentSkuId);
    const components = await prisma.sKU.findMany({
      where: { id: { in: componentIds } },
    });
    if (components.length !== componentIds.length) {
      return NextResponse.json(
        { error: "One or more component SKUs not found" },
        { status: 400 }
      );
    }

    // Create bundle with items in transaction
    const bundle = await prisma.$transaction(async (tx) => {
      const newBundle = await tx.sKUBundle.create({
        data: {
          bundleSkuId,
          companyId: companyId || bundleSku.companyId,
          type: type || "KIT",
          name,
          description,
          pricingType: pricingType || "FIXED",
          fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null,
          discountPercent: discountPercent ? parseFloat(discountPercent) : null,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
        },
      });

      // Create bundle items
      await tx.bundleItem.createMany({
        data: items.map((item: { componentSkuId: string; quantity: number; isOptional?: boolean }) => ({
          bundleId: newBundle.id,
          componentSkuId: item.componentSkuId,
          quantity: item.quantity || 1,
          isOptional: item.isOptional || false,
        })),
      });

      return newBundle;
    });

    // Fetch complete bundle
    const completeBundle = await prisma.sKUBundle.findUnique({
      where: { id: bundle.id },
      include: {
        SKU: {
          select: { id: true, code: true, name: true },
        },
        BundleItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(completeBundle, { status: 201 });
  } catch (error) {
    console.error("Error creating bundle:", error);
    return NextResponse.json(
      { error: "Failed to create bundle" },
      { status: 500 }
    );
  }
}
