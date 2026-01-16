import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/skus/[id]/variants - Get variants for a parent SKU
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: parentSkuId } = await params;

    // Check if SKU exists and is a variant parent
    const parentSku = await prisma.sKU.findUnique({
      where: { id: parentSkuId },
      select: { id: true, code: true, name: true, isVariantParent: true },
    });

    if (!parentSku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    // Get all variants
    const variants = await prisma.sKUVariant.findMany({
      where: { parentSkuId },
      include: {
        SKU_SKUVariant_variantSkuIdToSKU: {
          select: {
            id: true,
            code: true,
            name: true,
            mrp: true,
            sellingPrice: true,
            isActive: true,
          },
        },
        SKUVariantValue: {
          include: {
            VariantAttributeValue: {
              include: {
                VariantAttribute: {
                  select: { id: true, code: true, name: true, type: true },
                },
              },
            },
          },
        },
      },
    });

    // Transform data for easier consumption
    const transformedVariants = variants.map((v) => ({
      id: v.id,
      variantSku: v.SKU_SKUVariant_variantSkuIdToSKU,
      attributes: v.SKUVariantValue.map((av) => ({
        attributeId: av.VariantAttributeValue.VariantAttribute.id,
        attributeCode: av.VariantAttributeValue.VariantAttribute.code,
        attributeName: av.VariantAttributeValue.VariantAttribute.name,
        attributeType: av.VariantAttributeValue.VariantAttribute.type,
        valueId: av.VariantAttributeValue.id,
        value: av.VariantAttributeValue.value,
        displayName: av.VariantAttributeValue.displayName,
      })),
    }));

    return NextResponse.json({
      parentSku,
      variants: transformedVariants,
      total: variants.length,
    });
  } catch (error) {
    console.error("Error fetching SKU variants:", error);
    return NextResponse.json(
      { error: "Failed to fetch SKU variants" },
      { status: 500 }
    );
  }
}

// POST /api/skus/[id]/variants - Create a variant for a parent SKU
export async function POST(
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

    const { id: parentSkuId } = await params;
    const body = await request.json();
    const { variantSkuId, attributeValueIds } = body;

    // Validate inputs
    if (!variantSkuId || !attributeValueIds || attributeValueIds.length === 0) {
      return NextResponse.json(
        { error: "variantSkuId and attributeValueIds are required" },
        { status: 400 }
      );
    }

    // Check parent SKU
    const parentSku = await prisma.sKU.findUnique({
      where: { id: parentSkuId },
    });
    if (!parentSku) {
      return NextResponse.json({ error: "Parent SKU not found" }, { status: 404 });
    }

    // Check variant SKU
    const variantSku = await prisma.sKU.findUnique({
      where: { id: variantSkuId },
    });
    if (!variantSku) {
      return NextResponse.json({ error: "Variant SKU not found" }, { status: 404 });
    }

    // Check if variant already exists
    const existing = await prisma.sKUVariant.findFirst({
      where: { parentSkuId, variantSkuId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Variant already exists for this SKU combination" },
        { status: 400 }
      );
    }

    // Create variant in transaction
    const variant = await prisma.$transaction(async (tx) => {
      // Mark parent as variant parent
      await tx.sKU.update({
        where: { id: parentSkuId },
        data: { isVariantParent: true },
      });

      // Mark variant SKU as variant
      await tx.sKU.update({
        where: { id: variantSkuId },
        data: { isVariant: true },
      });

      // Create variant
      const newVariant = await tx.sKUVariant.create({
        data: {
          parentSkuId,
          variantSkuId,
        },
      });

      // Create attribute value associations
      await tx.sKUVariantValue.createMany({
        data: attributeValueIds.map((valueId: string) => ({
          skuVariantId: newVariant.id,
          attributeValueId: valueId,
        })),
      });

      return newVariant;
    });

    // Fetch complete variant
    const completeVariant = await prisma.sKUVariant.findUnique({
      where: { id: variant.id },
      include: {
        SKU_SKUVariant_variantSkuIdToSKU: {
          select: { id: true, code: true, name: true },
        },
        SKUVariantValue: {
          include: {
            VariantAttributeValue: {
              include: {
                VariantAttribute: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(completeVariant, { status: 201 });
  } catch (error) {
    console.error("Error creating SKU variant:", error);
    return NextResponse.json(
      { error: "Failed to create SKU variant" },
      { status: 500 }
    );
  }
}

// DELETE /api/skus/[id]/variants - Delete a variant
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

    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      return NextResponse.json(
        { error: "variantId is required" },
        { status: 400 }
      );
    }

    const variant = await prisma.sKUVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete attribute value associations
      await tx.sKUVariantValue.deleteMany({
        where: { skuVariantId: variantId },
      });

      // Delete variant
      await tx.sKUVariant.delete({
        where: { id: variantId },
      });

      // Update variant SKU flag
      await tx.sKU.update({
        where: { id: variant.variantSkuId },
        data: { isVariant: false },
      });

      // Check if parent still has variants
      const remainingVariants = await tx.sKUVariant.count({
        where: { parentSkuId: variant.parentSkuId },
      });

      if (remainingVariants === 0) {
        await tx.sKU.update({
          where: { id: variant.parentSkuId },
          data: { isVariantParent: false },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SKU variant:", error);
    return NextResponse.json(
      { error: "Failed to delete SKU variant" },
      { status: 500 }
    );
  }
}
