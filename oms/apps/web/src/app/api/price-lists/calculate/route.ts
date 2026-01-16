import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

interface PriceResult {
  skuId: string;
  skuCode: string;
  skuName: string;
  baseMRP: number | null;
  baseSellingPrice: number | null;
  calculatedPrice: number;
  quantity: number;
  totalPrice: number;
  appliedDiscount: number | null;
  appliedMarkup: number | null;
  tierApplied: {
    minQty: number;
    maxQty: number | null;
    tierPrice: number;
  } | null;
  priceSource: "FIXED" | "DISCOUNT" | "MARKUP" | "TIER" | "BASE";
}

// POST /api/price-lists/calculate - Calculate prices for SKUs
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { priceListId, customerId, items } = body;

    // items: Array<{ skuId: string, quantity: number }>

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    // Determine price list to use
    let effectivePriceListId = priceListId;

    // If customer specified, get their price list
    if (customerId && !priceListId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { priceListId: true },
      });
      effectivePriceListId = customer?.priceListId || null;
    }

    // Get SKU base prices
    const skuIds = items.map((i: { skuId: string }) => i.skuId);
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      select: { id: true, code: true, name: true, mrp: true, sellingPrice: true },
    });

    const skuMap = new Map(skus.map((s) => [s.id, s]));

    // Get price list items if price list specified
    let priceListItems: Array<{
      skuId: string;
      fixedPrice: number | null;
      discountPercent: number | null;
      markup: number | null;
      pricingTiers: Array<{
        minQty: number;
        maxQty: number | null;
        price: number;
      }>;
    }> = [];

    let priceList: {
      basedOnMRP: boolean;
      roundingMethod: string | null;
    } | null = null;

    if (effectivePriceListId) {
      const pl = await prisma.priceList.findUnique({
        where: { id: effectivePriceListId },
        select: {
          basedOnMRP: true,
          roundingMethod: true,
          effectiveFrom: true,
          effectiveTo: true,
          isActive: true,
        },
      });

      // Verify price list is active and effective
      if (pl && pl.isActive) {
        const now = new Date();
        if (
          new Date(pl.effectiveFrom) <= now &&
          (!pl.effectiveTo || new Date(pl.effectiveTo) >= now)
        ) {
          priceList = pl;

          const pliRaw = await prisma.priceListItem.findMany({
            where: {
              priceListId: effectivePriceListId,
              skuId: { in: skuIds },
            },
            include: {
              PricingTier: {
                orderBy: { minQty: "asc" },
              },
            },
          });

          priceListItems = pliRaw.map((item) => ({
            skuId: item.skuId,
            fixedPrice: item.fixedPrice ? Number(item.fixedPrice) : null,
            discountPercent: item.discountPercent
              ? Number(item.discountPercent)
              : null,
            markup: item.markup ? Number(item.markup) : null,
            pricingTiers: item.PricingTier.map((tier) => ({
              minQty: tier.minQty,
              maxQty: tier.maxQty,
              price: Number(tier.price),
            })),
          }));
        }
      }
    }

    const priceItemMap = new Map(
      priceListItems.map((p) => [p.skuId, p])
    );

    // Calculate prices
    const results: PriceResult[] = [];
    let subtotal = 0;

    for (const item of items as Array<{ skuId: string; quantity: number }>) {
      const sku = skuMap.get(item.skuId);
      if (!sku) continue;

      const priceItem = priceItemMap.get(item.skuId);
      const quantity = item.quantity || 1;

      // Determine base price
      const basePrice = priceList?.basedOnMRP
        ? Number(sku.mrp || 0)
        : Number(sku.sellingPrice || sku.mrp || 0);

      let calculatedPrice = basePrice;
      let priceSource: PriceResult["priceSource"] = "BASE";
      let appliedDiscount: number | null = null;
      let appliedMarkup: number | null = null;
      let tierApplied: PriceResult["tierApplied"] = null;

      if (priceItem) {
        // Check for quantity tier pricing first
        const applicableTier = priceItem.pricingTiers.find(
          (tier) =>
            quantity >= tier.minQty &&
            (tier.maxQty === null || quantity <= tier.maxQty)
        );

        if (applicableTier) {
          calculatedPrice = applicableTier.price;
          priceSource = "TIER";
          tierApplied = {
            minQty: applicableTier.minQty,
            maxQty: applicableTier.maxQty,
            tierPrice: applicableTier.price,
          };
        } else if (priceItem.fixedPrice !== null) {
          // Fixed price
          calculatedPrice = priceItem.fixedPrice;
          priceSource = "FIXED";
        } else if (priceItem.discountPercent !== null) {
          // Discount from base
          appliedDiscount = priceItem.discountPercent;
          calculatedPrice = basePrice * (1 - priceItem.discountPercent / 100);
          priceSource = "DISCOUNT";
        } else if (priceItem.markup !== null) {
          // Markup on base
          appliedMarkup = priceItem.markup;
          calculatedPrice = basePrice * (1 + priceItem.markup / 100);
          priceSource = "MARKUP";
        }
      }

      // Apply rounding
      if (priceList?.roundingMethod) {
        switch (priceList.roundingMethod) {
          case "ROUND_UP":
            calculatedPrice = Math.ceil(calculatedPrice);
            break;
          case "ROUND_DOWN":
            calculatedPrice = Math.floor(calculatedPrice);
            break;
          case "ROUND_NEAREST":
            calculatedPrice = Math.round(calculatedPrice);
            break;
          case "ROUND_99":
            calculatedPrice = Math.floor(calculatedPrice) - 0.01 + 1;
            break;
        }
      }

      const totalPrice = calculatedPrice * quantity;
      subtotal += totalPrice;

      results.push({
        skuId: sku.id,
        skuCode: sku.code,
        skuName: sku.name,
        baseMRP: sku.mrp ? Number(sku.mrp) : null,
        baseSellingPrice: sku.sellingPrice ? Number(sku.sellingPrice) : null,
        calculatedPrice: Math.round(calculatedPrice * 100) / 100,
        quantity,
        totalPrice: Math.round(totalPrice * 100) / 100,
        appliedDiscount,
        appliedMarkup,
        tierApplied,
        priceSource,
      });
    }

    return NextResponse.json({
      priceListId: effectivePriceListId,
      customerId,
      results,
      summary: {
        itemCount: results.length,
        totalQuantity: results.reduce((sum, r) => sum + r.quantity, 0),
        subtotal: Math.round(subtotal * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error calculating prices:", error);
    return NextResponse.json(
      { error: "Failed to calculate prices" },
      { status: 500 }
    );
  }
}
