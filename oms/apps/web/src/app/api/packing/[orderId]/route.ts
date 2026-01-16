import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate delivery number
function generateDeliveryNo(): string {
  const prefix = "DEL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Helper to generate invoice number
function generateInvoiceNo(): string {
  const prefix = "INV";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/packing/[orderId] - Get order packing details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Location: true,
        OrderItem: {
          include: {
            SKU: {
              select: {
                id: true,
                code: true,
                name: true,
                weight: true,
                length: true,
                width: true,
                height: true,
                barcodes: true,
              },
            },
          },
        },
        Delivery: {
          include: {
            Transporter: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        Picklist: {
          where: { status: "COMPLETED" },
          include: {
            PicklistItem: {
              include: {
                SKU: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order for packing:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// POST /api/packing/[orderId] - Start or complete packing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    const body = await request.json();
    const { action, boxes, weight, length, width, height, transporterId } = body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: true,
        Delivery: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    switch (action) {
      case "start": {
        // Start packing - update order status
        if (!["PICKED"].includes(order.status)) {
          return NextResponse.json(
            { error: "Order is not in PICKED status" },
            { status: 400 }
          );
        }

        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PACKING" },
        });

        return NextResponse.json({
          success: true,
          order: updated,
          message: "Packing started",
        });
      }

      case "complete": {
        // Complete packing - create delivery and update order
        if (!["PICKED", "PACKING"].includes(order.status)) {
          return NextResponse.json(
            { error: "Order is not ready for packing completion" },
            { status: 400 }
          );
        }

        // Check if all items are picked
        const allPicked = order.OrderItem.every(
          (item) => item.pickedQty >= item.quantity
        );

        if (!allPicked) {
          return NextResponse.json(
            { error: "Not all items have been picked" },
            { status: 400 }
          );
        }

        // Calculate volumetric weight
        const volumetricWeight =
          length && width && height
            ? (Number(length) * Number(width) * Number(height)) / 5000
            : null;

        // Create or update delivery
        let delivery = order.Delivery[0];

        if (delivery) {
          // Update existing delivery
          delivery = await prisma.delivery.update({
            where: { id: delivery.id },
            data: {
              status: "PACKED",
              weight: weight || null,
              length: length || null,
              width: width || null,
              height: height || null,
              volumetricWeight,
              boxes: boxes || 1,
              transporterId: transporterId || delivery.transporterId,
              packDate: new Date(),
            },
          });
        } else {
          // Create new delivery
          delivery = await prisma.delivery.create({
            data: {
              deliveryNo: generateDeliveryNo(),
              orderId: order.id,
              status: "PACKED",
              weight: weight || null,
              length: length || null,
              width: width || null,
              height: height || null,
              volumetricWeight,
              boxes: boxes || 1,
              transporterId: transporterId || null,
              invoiceNo: generateInvoiceNo(),
              invoiceDate: new Date(),
              packDate: new Date(),
            },
          });
        }

        // Update order items packed quantity
        await Promise.all(
          order.OrderItem.map((item) =>
            prisma.orderItem.update({
              where: { id: item.id },
              data: {
                packedQty: item.pickedQty,
                status: "PACKED",
              },
            })
          )
        );

        // Update order status
        const updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: { status: "PACKED" },
          include: {
            OrderItem: true,
            Delivery: {
              include: {
                Transporter: true,
              },
            },
          },
        });

        return NextResponse.json({
          success: true,
          order: updatedOrder,
          delivery,
          message: "Order packed successfully",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error processing packing:", error);
    return NextResponse.json(
      { error: "Failed to process packing" },
      { status: 500 }
    );
  }
}

// PATCH /api/packing/[orderId] - Update packing details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;
    const body = await request.json();
    const { boxes, weight, length, width, height, transporterId, remarks } = body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Delivery: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const delivery = order.Delivery[0];

    if (!delivery) {
      return NextResponse.json(
        { error: "No delivery found for this order" },
        { status: 400 }
      );
    }

    // Calculate volumetric weight
    const volumetricWeight =
      length && width && height
        ? (Number(length) * Number(width) * Number(height)) / 5000
        : delivery.volumetricWeight;

    const updatedDelivery = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        weight: weight !== undefined ? weight : delivery.weight,
        length: length !== undefined ? length : delivery.length,
        width: width !== undefined ? width : delivery.width,
        height: height !== undefined ? height : delivery.height,
        volumetricWeight,
        boxes: boxes !== undefined ? boxes : delivery.boxes,
        transporterId: transporterId !== undefined ? transporterId : delivery.transporterId,
        remarks: remarks !== undefined ? remarks : delivery.remarks,
      },
      include: {
        Transporter: true,
      },
    });

    return NextResponse.json({
      success: true,
      delivery: updatedDelivery,
      message: "Packing details updated",
    });
  } catch (error) {
    console.error("Error updating packing:", error);
    return NextResponse.json(
      { error: "Failed to update packing details" },
      { status: 500 }
    );
  }
}
