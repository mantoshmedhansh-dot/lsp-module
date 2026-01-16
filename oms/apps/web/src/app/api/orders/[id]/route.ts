import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/orders/[id] - Get a specific order
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

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        Location: true,
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Delivery: {
          include: {
            Transporter: true,
            Manifest: true,
          },
        },
        Picklist: {
          include: {
            PicklistItem: true,
          },
        },
        Return_Return_orderIdToOrder: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check location access
    if (
      session.user.locationAccess &&
      session.user.locationAccess.length > 0 &&
      !session.user.locationAccess.includes(order.locationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Update an order
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

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check location access
    if (
      session.user.locationAccess &&
      session.user.locationAccess.length > 0 &&
      !session.user.locationAccess.includes(existingOrder.locationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      status,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      billingAddress,
      shipByDate,
      promisedDate,
      priority,
      tags,
      remarks,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status !== undefined) updateData.status = status;
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail;
    if (shippingAddress !== undefined) updateData.shippingAddress = shippingAddress;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (shipByDate !== undefined) updateData.shipByDate = shipByDate ? new Date(shipByDate) : null;
    if (promisedDate !== undefined) updateData.promisedDate = promisedDate ? new Date(promisedDate) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;
    if (remarks !== undefined) updateData.remarks = remarks;

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Location: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - Cancel/Delete an order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only SUPER_ADMIN and ADMIN can delete orders
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        Delivery: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Don't allow deletion of shipped/delivered orders
    const nonDeletableStatuses = [
      "SHIPPED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "RTO_INITIATED",
      "RTO_IN_TRANSIT",
      "RTO_DELIVERED",
    ];

    if (nonDeletableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: "Cannot delete shipped or delivered orders" },
        { status: 400 }
      );
    }

    // Instead of deleting, cancel the order
    await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    // Also cancel all items
    await prisma.orderItem.updateMany({
      where: { orderId: id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true, message: "Order cancelled" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
