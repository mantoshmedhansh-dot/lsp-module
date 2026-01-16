import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/skus/[id] - Get a specific SKU
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

    const sku = await prisma.sKU.findUnique({
      where: { id },
      include: {
        Inventory: {
          include: {
            Bin: {
              include: {
                Zone: {
                  include: {
                    Location: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            OrderItem: true,
            Inventory: true,
          },
        },
      },
    });

    if (!sku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    // Check company access
    if (session.user.companyId && sku.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(sku);
  } catch (error) {
    console.error("Error fetching SKU:", error);
    return NextResponse.json(
      { error: "Failed to fetch SKU" },
      { status: 500 }
    );
  }
}

// PATCH /api/skus/[id] - Update a SKU
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN, ADMIN, MANAGER can update SKUs
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if SKU exists and user has access
    const existingSku = await prisma.sKU.findUnique({
      where: { id },
    });

    if (!existingSku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    if (session.user.companyId && existingSku.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      brand,
      hsn,
      weight,
      length,
      width,
      height,
      mrp,
      costPrice,
      sellingPrice,
      taxRate,
      isSerialised,
      isBatchTracked,
      barcodes,
      images,
      isActive,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (brand !== undefined) updateData.brand = brand;
    if (hsn !== undefined) updateData.hsn = hsn;
    if (weight !== undefined)
      updateData.weight = weight ? parseFloat(weight) : null;
    if (length !== undefined)
      updateData.length = length ? parseFloat(length) : null;
    if (width !== undefined)
      updateData.width = width ? parseFloat(width) : null;
    if (height !== undefined)
      updateData.height = height ? parseFloat(height) : null;
    if (mrp !== undefined) updateData.mrp = mrp ? parseFloat(mrp) : null;
    if (costPrice !== undefined)
      updateData.costPrice = costPrice ? parseFloat(costPrice) : null;
    if (sellingPrice !== undefined)
      updateData.sellingPrice = sellingPrice ? parseFloat(sellingPrice) : null;
    if (taxRate !== undefined)
      updateData.taxRate = taxRate ? parseFloat(taxRate) : null;
    if (isSerialised !== undefined) updateData.isSerialised = isSerialised;
    if (isBatchTracked !== undefined) updateData.isBatchTracked = isBatchTracked;
    if (barcodes !== undefined) updateData.barcodes = barcodes;
    if (images !== undefined) updateData.images = images;
    if (isActive !== undefined) updateData.isActive = isActive;

    const sku = await prisma.sKU.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(sku);
  } catch (error) {
    console.error("Error updating SKU:", error);
    return NextResponse.json(
      { error: "Failed to update SKU" },
      { status: 500 }
    );
  }
}

// DELETE /api/skus/[id] - Delete a SKU
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete SKUs
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Check if SKU has inventory or orders
    const sku = await prisma.sKU.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Inventory: true,
            OrderItem: true,
          },
        },
      },
    });

    if (!sku) {
      return NextResponse.json({ error: "SKU not found" }, { status: 404 });
    }

    if (sku._count.Inventory > 0 || sku._count.OrderItem > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete SKU with existing inventory or orders. Deactivate it instead.",
        },
        { status: 400 }
      );
    }

    await prisma.sKU.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SKU:", error);
    return NextResponse.json(
      { error: "Failed to delete SKU" },
      { status: 500 }
    );
  }
}
