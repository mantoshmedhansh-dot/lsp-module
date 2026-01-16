import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/purchase-orders/[id] - Get PO details
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

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        Vendor: true,
        POItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true, barcodes: true },
            },
          },
        },
        Inbound: {
          include: {
            User: {
              select: { id: true, name: true },
            },
            _count: {
              select: { InboundItem: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

// PATCH /api/purchase-orders/[id] - Update PO / Actions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { POItem: true },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Handle actions
    switch (action) {
      case "approve": {
        if (purchaseOrder.status !== "DRAFT") {
          return NextResponse.json(
            { error: "Only draft POs can be approved" },
            { status: 400 }
          );
        }

        const updated = await prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: session.user.id,
          },
          include: { Vendor: true, POItem: true },
        });

        return NextResponse.json(updated);
      }

      case "cancel": {
        if (!["DRAFT", "APPROVED"].includes(purchaseOrder.status)) {
          return NextResponse.json(
            { error: "Cannot cancel this PO" },
            { status: 400 }
          );
        }

        const updated = await prisma.purchaseOrder.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: { Vendor: true, POItem: true },
        });

        return NextResponse.json(updated);
      }

      case "update-items": {
        if (purchaseOrder.status !== "DRAFT") {
          return NextResponse.json(
            { error: "Only draft POs can be updated" },
            { status: 400 }
          );
        }

        const { items } = data;
        if (!items || items.length === 0) {
          return NextResponse.json(
            { error: "Items are required" },
            { status: 400 }
          );
        }

        // Delete existing items and recreate
        await prisma.pOItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        // Calculate new totals
        let subtotal = 0;
        let taxAmount = 0;

        const processedItems = items.map((item: {
          skuId: string;
          orderedQty: number;
          unitPrice: number;
          taxRate?: number;
        }) => {
          const itemTotal = item.orderedQty * item.unitPrice;
          const itemTax = itemTotal * ((item.taxRate || 0) / 100);
          subtotal += itemTotal;
          taxAmount += itemTax;

          return {
            purchaseOrderId: id,
            skuId: item.skuId,
            orderedQty: item.orderedQty,
            unitPrice: item.unitPrice,
            taxAmount: itemTax,
            totalPrice: itemTotal + itemTax,
          };
        });

        await prisma.pOItem.createMany({
          data: processedItems,
        });

        const updated = await prisma.purchaseOrder.update({
          where: { id },
          data: {
            subtotal,
            taxAmount,
            totalAmount: subtotal + taxAmount,
          },
          include: {
            Vendor: true,
            POItem: {
              include: {
                SKU: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });

        return NextResponse.json(updated);
      }

      default: {
        // Regular update
        if (purchaseOrder.status !== "DRAFT") {
          return NextResponse.json(
            { error: "Only draft POs can be updated" },
            { status: 400 }
          );
        }

        const { expectedDate, remarks } = data;

        const updated = await prisma.purchaseOrder.update({
          where: { id },
          data: {
            expectedDate: expectedDate ? new Date(expectedDate) : undefined,
            remarks,
          },
          include: { Vendor: true, POItem: true },
        });

        return NextResponse.json(updated);
      }
    }
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id] - Delete PO
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

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        _count: { select: { Inbound: true } },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    if (purchaseOrder._count.Inbound > 0) {
      return NextResponse.json(
        { error: "Cannot delete PO with inbounds" },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
