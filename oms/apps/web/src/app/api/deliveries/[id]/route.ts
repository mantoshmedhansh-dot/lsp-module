import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/deliveries/[id] - Get delivery details
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

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        Order: {
          include: {
            Location: true,
            OrderItem: {
              include: {
                SKU: true,
              },
            },
          },
        },
        Transporter: true,
        Manifest: true,
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    return NextResponse.json(delivery);
  } catch (error) {
    console.error("Error fetching delivery:", error);
    return NextResponse.json(
      { error: "Failed to fetch delivery" },
      { status: 500 }
    );
  }
}

// PATCH /api/deliveries/[id] - Update delivery (assign AWB, update status)
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
    const {
      action,
      transporterId,
      awbNo,
      trackingUrl,
      weight,
      length,
      width,
      height,
      boxes,
      remarks,
    } = body;

    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        Order: true,
        Transporter: true,
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    switch (action) {
      case "assign-awb": {
        // Assign AWB number
        if (!awbNo) {
          return NextResponse.json(
            { error: "AWB number is required" },
            { status: 400 }
          );
        }

        // Check if AWB is already used
        const existingAwb = await prisma.delivery.findFirst({
          where: {
            awbNo,
            id: { not: id },
          },
        });

        if (existingAwb) {
          return NextResponse.json(
            { error: "This AWB number is already in use" },
            { status: 400 }
          );
        }

        // Get transporter for tracking URL
        let finalTrackingUrl = trackingUrl;
        if (transporterId && !trackingUrl) {
          const transporter = await prisma.transporter.findUnique({
            where: { id: transporterId },
          });
          if (transporter?.trackingUrlTemplate) {
            finalTrackingUrl = transporter.trackingUrlTemplate.replace("{awb}", awbNo);
          }
        }

        const updated = await prisma.delivery.update({
          where: { id },
          data: {
            transporterId: transporterId || delivery.transporterId,
            awbNo,
            trackingUrl: finalTrackingUrl,
          },
          include: {
            Transporter: true,
          },
        });

        // Mark AWB as used in pool if it exists
        await prisma.aWB.updateMany({
          where: { awbNo },
          data: {
            isUsed: true,
            usedAt: new Date(),
            usedFor: delivery.deliveryNo,
          },
        });

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: "AWB assigned successfully",
        });
      }

      case "ship": {
        // Mark as shipped
        if (!delivery.awbNo) {
          return NextResponse.json(
            { error: "AWB number must be assigned before shipping" },
            { status: 400 }
          );
        }

        if (!["PACKED", "MANIFESTED"].includes(delivery.status)) {
          return NextResponse.json(
            { error: "Delivery must be PACKED or MANIFESTED to ship" },
            { status: 400 }
          );
        }

        const updated = await prisma.delivery.update({
          where: { id },
          data: {
            status: "SHIPPED",
            shipDate: new Date(),
          },
          include: {
            Transporter: true,
            Order: true,
          },
        });

        // Update order status
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "SHIPPED" },
        });

        // Update order items
        await prisma.orderItem.updateMany({
          where: { orderId: delivery.orderId },
          data: {
            shippedQty: { increment: 0 }, // Will be set properly in a loop
            status: "SHIPPED",
          },
        });

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: "Shipment marked as shipped",
        });
      }

      case "update-tracking": {
        // Update tracking status (webhook or manual)
        const { status: newStatus } = body;

        const validStatuses = [
          "IN_TRANSIT",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "RTO_INITIATED",
          "RTO_IN_TRANSIT",
          "RTO_DELIVERED",
        ];

        if (!validStatuses.includes(newStatus)) {
          return NextResponse.json(
            { error: `Invalid status: ${newStatus}` },
            { status: 400 }
          );
        }

        const updateData: Record<string, unknown> = { status: newStatus };

        if (newStatus === "DELIVERED") {
          updateData.deliveryDate = new Date();
        }

        const updated = await prisma.delivery.update({
          where: { id },
          data: updateData,
          include: {
            Transporter: true,
          },
        });

        // Update order status to match
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: newStatus },
        });

        if (newStatus === "DELIVERED") {
          await prisma.orderItem.updateMany({
            where: { orderId: delivery.orderId },
            data: { status: "DELIVERED" },
          });
        }

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: `Status updated to ${newStatus}`,
        });
      }

      case "pod": {
        // Update POD (Proof of Delivery)
        const { podImage, podSignature, podRemarks, receivedBy } = body;

        const updated = await prisma.delivery.update({
          where: { id },
          data: {
            status: "DELIVERED",
            deliveryDate: new Date(),
            podImage,
            podSignature,
            podRemarks,
            receivedBy,
          },
          include: {
            Transporter: true,
          },
        });

        // Update order status
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: "DELIVERED" },
        });

        await prisma.orderItem.updateMany({
          where: { orderId: delivery.orderId },
          data: { status: "DELIVERED" },
        });

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: "POD recorded successfully",
        });
      }

      case "update": {
        // General update
        const volumetricWeight =
          length && width && height
            ? (Number(length) * Number(width) * Number(height)) / 5000
            : undefined;

        const updated = await prisma.delivery.update({
          where: { id },
          data: {
            transporterId: transporterId !== undefined ? transporterId : undefined,
            weight: weight !== undefined ? weight : undefined,
            length: length !== undefined ? length : undefined,
            width: width !== undefined ? width : undefined,
            height: height !== undefined ? height : undefined,
            volumetricWeight,
            boxes: boxes !== undefined ? boxes : undefined,
            remarks: remarks !== undefined ? remarks : undefined,
          },
          include: {
            Transporter: true,
          },
        });

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: "Delivery updated successfully",
        });
      }

      case "cancel": {
        if (["SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(delivery.status)) {
          return NextResponse.json(
            { error: "Cannot cancel a shipped delivery" },
            { status: 400 }
          );
        }

        const updated = await prisma.delivery.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: {
            Transporter: true,
          },
        });

        return NextResponse.json({
          success: true,
          delivery: updated,
          message: "Delivery cancelled",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating delivery:", error);
    return NextResponse.json(
      { error: "Failed to update delivery" },
      { status: 500 }
    );
  }
}
