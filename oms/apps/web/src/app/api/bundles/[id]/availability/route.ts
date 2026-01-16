import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/bundles/[id]/availability - Check bundle availability
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
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const quantity = parseInt(searchParams.get("quantity") || "1");

    // Get bundle with items
    const bundle = await prisma.sKUBundle.findUnique({
      where: { id },
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

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Get inventory for all component SKUs
    const componentSkuIds = bundle.BundleItem.map((item) => item.componentSkuId);

    const inventoryWhere: Record<string, unknown> = {
      skuId: { in: componentSkuIds },
    };
    if (locationId) {
      inventoryWhere.locationId = locationId;
    }

    const inventory = await prisma.inventory.findMany({
      where: inventoryWhere,
      include: {
        Location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Calculate availability for each component
    const componentAvailability = bundle.BundleItem.map((item) => {
      const componentInventory = inventory.filter((inv) => inv.skuId === item.componentSkuId);

      const totalAvailable = componentInventory.reduce(
        (sum, inv) => sum + (inv.quantity - inv.reservedQty),
        0
      );

      const requiredQty = item.quantity * quantity;
      const canFulfill = totalAvailable >= requiredQty;
      const maxBundles = item.quantity > 0 ? Math.floor(totalAvailable / item.quantity) : 0;

      return {
        componentSkuId: item.componentSkuId,
        componentSku: item.SKU,
        requiredPerBundle: item.quantity,
        requiredTotal: requiredQty,
        availableTotal: totalAvailable,
        isOptional: item.allowSubstitute,
        canFulfill,
        maxBundles,
        locations: componentInventory.map((inv) => ({
          locationId: inv.locationId,
          locationName: inv.Location.name,
          available: inv.quantity - inv.reservedQty,
        })),
      };
    });

    // Calculate overall bundle availability
    const requiredComponents = componentAvailability.filter((c) => !c.isOptional);
    const allRequiredAvailable = requiredComponents.every((c) => c.canFulfill);
    const maxBundlesAvailable = requiredComponents.length > 0
      ? Math.min(...requiredComponents.map((c) => c.maxBundles))
      : 0;

    // Calculate bundle price
    let bundlePrice = 0;
    if (bundle.pricingType === "FIXED" && bundle.fixedPrice) {
      bundlePrice = Number(bundle.fixedPrice);
    } else if (bundle.pricingType === "COMPONENT_SUM") {
      // Sum of component prices - would need to fetch prices
      bundlePrice = componentAvailability.reduce((sum, c) => {
        const componentMrp = bundle.BundleItem.find((i) => i.componentSkuId === c.componentSkuId);
        return sum + (Number(componentMrp?.SKU) || 0) * c.requiredPerBundle;
      }, 0);

      if (bundle.discountPercent) {
        bundlePrice = bundlePrice * (1 - Number(bundle.discountPercent) / 100);
      }
    }

    return NextResponse.json({
      bundle: {
        id: bundle.id,
        name: bundle.name,
        type: bundle.type,
        bundleSku: bundle.SKU,
        price: bundlePrice,
      },
      requestedQuantity: quantity,
      isAvailable: allRequiredAvailable,
      maxAvailable: maxBundlesAvailable,
      components: componentAvailability,
      summary: {
        totalComponents: bundle.BundleItem.length,
        requiredComponents: requiredComponents.length,
        optionalComponents: bundle.BundleItem.length - requiredComponents.length,
        componentsAvailable: componentAvailability.filter((c) => c.canFulfill).length,
      },
    });
  } catch (error) {
    console.error("Error checking bundle availability:", error);
    return NextResponse.json(
      { error: "Failed to check bundle availability" },
      { status: 500 }
    );
  }
}
