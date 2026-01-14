import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/catalog - Get product catalog for B2B customer
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Get the B2B customer for pricing
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { userId: session.user.id },
        ],
      },
      include: {
        priceList: { include: { items: true } },
      },
    });

    // Build filter
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (category && category !== "all") {
      where.category = category;
    }
    if (brand && brand !== "all") {
      where.brand = brand;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total, categories, brands] = await Promise.all([
      prisma.sKU.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          brand: true,
          sellingPrice: true,
          mrp: true,
          minOrderQty: true,
          inventory: {
            select: { quantity: true },
          },
        },
      }),
      prisma.sKU.count({ where }),
      prisma.sKU.findMany({
        where: { isActive: true },
        distinct: ["category"],
        select: { category: true },
      }),
      prisma.sKU.findMany({
        where: { isActive: true },
        distinct: ["brand"],
        select: { brand: true },
      }),
    ]);

    // Map prices based on customer's price list
    const priceMap = new Map<string, number>();
    if (customer?.priceList) {
      customer.priceList.items.forEach((item) => {
        priceMap.set(item.skuId, Number(item.price));
      });
    }

    return NextResponse.json({
      products: products.map((product) => {
        const totalStock = product.inventory.reduce(
          (sum, inv) => sum + inv.quantity,
          0
        );
        const customerPrice = priceMap.get(product.id);

        return {
          id: product.id,
          code: product.code,
          name: product.name,
          category: product.category || "Uncategorized",
          brand: product.brand || "Unbranded",
          price: customerPrice || Number(product.sellingPrice),
          mrp: Number(product.mrp),
          minOrderQty: product.minOrderQty || 1,
          stock: totalStock,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: {
        categories: categories.map((c) => c.category).filter(Boolean),
        brands: brands.map((b) => b.brand).filter(Boolean),
      },
    });
  } catch (error) {
    console.error("Error fetching B2B catalog:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}
