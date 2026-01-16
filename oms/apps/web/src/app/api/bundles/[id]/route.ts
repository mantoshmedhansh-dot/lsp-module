import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/bundles/[id] - Get bundle detail
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

    const bundle = await prisma.sKUBundle.findUnique({
      where: { id },
      include: {
        SKU: {
          select: { id: true, code: true, name: true, mrp: true, sellingPrice: true },
        },
        BundleItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true, mrp: true, sellingPrice: true },
            },
          },
        },
      },
    });

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Error fetching bundle:", error);
    return NextResponse.json(
      { error: "Failed to fetch bundle" },
      { status: 500 }
    );
  }
}

// PATCH /api/bundles/[id] - Update bundle
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

    const existing = await prisma.sKUBundle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const {
      name,
      description,
      type,
      pricingType,
      fixedPrice,
      discountPercent,
      validFrom,
      validTo,
      isActive,
      items,
    } = body;

    // Update bundle and items in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update bundle
      const bundle = await tx.sKUBundle.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type }),
          ...(pricingType !== undefined && { pricingType }),
          ...(fixedPrice !== undefined && { fixedPrice: fixedPrice ? parseFloat(fixedPrice) : null }),
          ...(discountPercent !== undefined && { discountPercent: discountPercent ? parseFloat(discountPercent) : null }),
          ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
          ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Update items if provided
      if (items) {
        // Delete existing items
        await tx.bundleItem.deleteMany({ where: { bundleId: id } });

        // Create new items
        await tx.bundleItem.createMany({
          data: items.map((item: { componentSkuId: string; quantity: number; isOptional?: boolean }) => ({
            bundleId: id,
            componentSkuId: item.componentSkuId,
            quantity: item.quantity || 1,
            isOptional: item.isOptional || false,
          })),
        });
      }

      return bundle;
    });

    // Fetch complete bundle
    const completeBundle = await prisma.sKUBundle.findUnique({
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

    return NextResponse.json(completeBundle);
  } catch (error) {
    console.error("Error updating bundle:", error);
    return NextResponse.json(
      { error: "Failed to update bundle" },
      { status: 500 }
    );
  }
}

// DELETE /api/bundles/[id] - Delete bundle
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

    const existing = await prisma.sKUBundle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete items first
      await tx.bundleItem.deleteMany({ where: { bundleId: id } });
      // Delete bundle
      await tx.sKUBundle.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bundle:", error);
    return NextResponse.json(
      { error: "Failed to delete bundle" },
      { status: 500 }
    );
  }
}
