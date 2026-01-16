import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/catalog - Get B2B product catalog
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
      include: {
        PriceList: {
          include: {
            PriceListItem: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ products: [], total: 0 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      companyId: customer.companyId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [skus, total] = await Promise.all([
      prisma.sKU.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          category: true,
          brand: true,
          mrp: true,
          sellingPrice: true,
          taxRate: true,
          images: true,
          Inventory: {
            select: {
              quantity: true,
              reservedQty: true,
            },
          },
        },
      }),
      prisma.sKU.count({ where }),
    ]);

    // Get price list items for quick lookup
    const priceListItems = customer.PriceList?.PriceListItem || [];
    const priceMap = new Map(
      priceListItems.map((item: { skuId: string; fixedPrice: { toString: () => string } | null }) => [item.skuId, item.fixedPrice ? Number(item.fixedPrice) : null])
    );

    return NextResponse.json({
      products: skus.map((sku) => {
        // Calculate available stock
        const availableStock = sku.Inventory.reduce(
          (sum: number, inv: { quantity: number; reservedQty: number }) => sum + (inv.quantity - inv.reservedQty),
          0
        );

        // Get customer-specific price or default
        const customerPrice = priceMap.get(sku.id) || Number(sku.sellingPrice);

        return {
          id: sku.id,
          code: sku.code,
          name: sku.name,
          description: sku.description,
          category: sku.category,
          brand: sku.brand,
          mrp: Number(sku.mrp || sku.sellingPrice),
          price: customerPrice,
          taxPercent: Number(sku.taxRate || 18),
          imageUrl: sku.images?.[0] || null,
          availableStock,
          inStock: availableStock > 0,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching B2B catalog:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}
