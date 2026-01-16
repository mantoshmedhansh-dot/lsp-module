import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/price-lists - List price lists
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const [priceLists, total] = await Promise.all([
      prisma.priceList.findMany({
        where,
        include: {
          Company: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              PriceListItem: true,
              Customer: true,
              CustomerGroup: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.priceList.count({ where }),
    ]);

    // Add computed status
    const now = new Date();
    const enriched = priceLists.map((pl) => ({
      ...pl,
      status: !pl.isActive
        ? "INACTIVE"
        : pl.effectiveTo && new Date(pl.effectiveTo) < now
        ? "EXPIRED"
        : new Date(pl.effectiveFrom) > now
        ? "SCHEDULED"
        : "ACTIVE",
    }));

    return NextResponse.json({
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching price lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch price lists" },
      { status: 500 }
    );
  }
}

// POST /api/price-lists - Create price list
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
      companyId,
      code,
      name,
      description,
      effectiveFrom,
      effectiveTo,
      basedOnMRP,
      roundingMethod,
      items,
    } = body;

    if (!companyId || !code || !name || !effectiveFrom) {
      return NextResponse.json(
        { error: "companyId, code, name, and effectiveFrom are required" },
        { status: 400 }
      );
    }

    // Check if code exists
    const existing = await prisma.priceList.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Price list with this code already exists" },
        { status: 400 }
      );
    }

    // Create price list with items in transaction
    const priceList = await prisma.$transaction(async (tx) => {
      const newPriceList = await tx.priceList.create({
        data: {
          companyId,
          code: code.toUpperCase(),
          name,
          description,
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          basedOnMRP: basedOnMRP || false,
          roundingMethod: roundingMethod || null,
        },
      });

      // Create items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const priceListItem = await tx.priceListItem.create({
            data: {
              priceListId: newPriceList.id,
              skuId: item.skuId,
              fixedPrice: item.fixedPrice ? parseFloat(item.fixedPrice) : null,
              discountPercent: item.discountPercent
                ? parseFloat(item.discountPercent)
                : null,
              markup: item.markup ? parseFloat(item.markup) : null,
              minOrderQty: item.minOrderQty || null,
              maxOrderQty: item.maxOrderQty || null,
            },
          });

          // Create pricing tiers if provided
          if (item.tiers && item.tiers.length > 0) {
            await tx.pricingTier.createMany({
              data: item.tiers.map(
                (tier: { minQty: number; maxQty?: number; price: number }) => ({
                  priceListItemId: priceListItem.id,
                  minQty: tier.minQty,
                  maxQty: tier.maxQty || null,
                  price: tier.price,
                })
              ),
            });
          }
        }
      }

      return newPriceList;
    });

    // Fetch complete price list
    const completePriceList = await prisma.priceList.findUnique({
      where: { id: priceList.id },
      include: {
        PriceListItem: {
          include: {
            PricingTier: true,
          },
        },
      },
    });

    return NextResponse.json(completePriceList, { status: 201 });
  } catch (error) {
    console.error("Error creating price list:", error);
    return NextResponse.json(
      { error: "Failed to create price list" },
      { status: 500 }
    );
  }
}
