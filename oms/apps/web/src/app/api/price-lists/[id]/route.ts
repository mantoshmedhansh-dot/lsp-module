import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/price-lists/[id] - Get price list detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const priceList = await prisma.priceList.findUnique({
      where: { id },
      include: {
        Company: {
          select: { id: true, name: true },
        },
        PriceListItem: {
          include: {
            PricingTier: {
              orderBy: { minQty: "asc" },
            },
          },
        },
        Customer: {
          select: { id: true, name: true, code: true },
        },
        CustomerGroup: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!priceList) {
      return NextResponse.json({ error: "Price list not found" }, { status: 404 });
    }

    // Get SKU details for items
    const skuIds = priceList.PriceListItem.map((item) => item.skuId);
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, code: true, name: true, mrp: true, sellingPrice: true },
    });

    const skuMap = new Map(skus.map((s) => [s.id, s]));

    // Enrich items with SKU details
    const enrichedItems = priceList.PriceListItem.map((item) => ({
      ...item,
      sku: skuMap.get(item.skuId) || null,
    }));

    // Add status
    const now = new Date();
    const status = !priceList.isActive
      ? "INACTIVE"
      : priceList.effectiveTo && new Date(priceList.effectiveTo) < now
      ? "EXPIRED"
      : new Date(priceList.effectiveFrom) > now
      ? "SCHEDULED"
      : "ACTIVE";

    return NextResponse.json({
      ...priceList,
      items: enrichedItems,
      status,
    });
  } catch (error) {
    console.error("Error fetching price list:", error);
    return NextResponse.json(
      { error: "Failed to fetch price list" },
      { status: 500 }
    );
  }
}

// PATCH /api/price-lists/[id] - Update price list
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.priceList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Price list not found" }, { status: 404 });
    }

    const {
      name,
      description,
      effectiveFrom,
      effectiveTo,
      basedOnMRP,
      roundingMethod,
      isActive,
      items,
    } = body;

    // Update in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update price list
      const priceList = await tx.priceList.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(effectiveFrom !== undefined && {
            effectiveFrom: new Date(effectiveFrom),
          }),
          ...(effectiveTo !== undefined && {
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          }),
          ...(basedOnMRP !== undefined && { basedOnMRP }),
          ...(roundingMethod !== undefined && { roundingMethod }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Update items if provided
      if (items !== undefined) {
        // Delete existing items and tiers
        const existingItems = await tx.priceListItem.findMany({
          where: { priceListId: id },
        });
        for (const item of existingItems) {
          await tx.pricingTier.deleteMany({
            where: { priceListItemId: item.id },
          });
        }
        await tx.priceListItem.deleteMany({ where: { priceListId: id } });

        // Create new items
        for (const item of items) {
          const priceListItem = await tx.priceListItem.create({
            data: {
              priceListId: id,
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

          // Create pricing tiers
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

      return priceList;
    });

    // Fetch complete price list
    const completePriceList = await prisma.priceList.findUnique({
      where: { id },
      include: {
        PriceListItem: {
          include: {
            PricingTier: true,
          },
        },
      },
    });

    return NextResponse.json(completePriceList);
  } catch (error) {
    console.error("Error updating price list:", error);
    return NextResponse.json(
      { error: "Failed to update price list" },
      { status: 500 }
    );
  }
}

// DELETE /api/price-lists/[id] - Delete price list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.priceList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Price list not found" }, { status: 404 });
    }

    // Check if price list is assigned to customers
    const assignedCustomers = await prisma.customer.count({
      where: { priceListId: id },
    });
    if (assignedCustomers > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete price list assigned to ${assignedCustomers} customer(s)`,
        },
        { status: 400 }
      );
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete pricing tiers
      const items = await tx.priceListItem.findMany({
        where: { priceListId: id },
      });
      for (const item of items) {
        await tx.pricingTier.deleteMany({
          where: { priceListItemId: item.id },
        });
      }

      // Delete items
      await tx.priceListItem.deleteMany({ where: { priceListId: id } });

      // Delete price list
      await tx.priceList.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting price list:", error);
    return NextResponse.json(
      { error: "Failed to delete price list" },
      { status: 500 }
    );
  }
}
