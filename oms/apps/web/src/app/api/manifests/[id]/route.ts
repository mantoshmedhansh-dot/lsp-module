import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/manifests/[id] - Get manifest details
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

    const manifest = await prisma.manifest.findUnique({
      where: { id },
      include: {
        Delivery: {
          include: {
            Order: {
              select: {
                id: true,
                orderNo: true,
                externalOrderNo: true,
                customerName: true,
                customerPhone: true,
                shippingAddress: true,
                paymentMode: true,
                totalAmount: true,
                Location: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            Delivery: true,
          },
        },
      },
    });

    if (!manifest) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    // Get transporter details
    const transporter = await prisma.transporter.findUnique({
      where: { id: manifest.transporterId },
      select: {
        id: true,
        code: true,
        name: true,
        trackingUrlTemplate: true,
      },
    });

    return NextResponse.json({ ...manifest, transporter });
  } catch (error) {
    console.error("Error fetching manifest:", error);
    return NextResponse.json(
      { error: "Failed to fetch manifest" },
      { status: 500 }
    );
  }
}

// PATCH /api/manifests/[id] - Update manifest (confirm, close, add/remove deliveries)
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
    const { action, deliveryIds, vehicleNo, driverName, driverPhone, handoverImage } = body;

    const manifest = await prisma.manifest.findUnique({
      where: { id },
      include: {
        Delivery: true,
      },
    });

    if (!manifest) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    switch (action) {
      case "add-deliveries": {
        if (manifest.status !== "OPEN") {
          return NextResponse.json(
            { error: "Cannot add deliveries to a confirmed manifest" },
            { status: 400 }
          );
        }

        if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
          return NextResponse.json(
            { error: "Delivery IDs are required" },
            { status: 400 }
          );
        }

        // Verify deliveries are eligible
        const deliveries = await prisma.delivery.findMany({
          where: {
            id: { in: deliveryIds },
            manifestId: null,
            awbNo: { not: null },
            status: "PACKED",
          },
        });

        if (deliveries.length !== deliveryIds.length) {
          return NextResponse.json(
            { error: "Some deliveries are not eligible" },
            { status: 400 }
          );
        }

        // Add deliveries to manifest
        await prisma.delivery.updateMany({
          where: { id: { in: deliveryIds } },
          data: {
            manifestId: id,
            status: "MANIFESTED",
          },
        });

        // Update order statuses
        const orderIds = deliveries.map((d) => d.orderId);
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "MANIFESTED" },
        });

        const updated = await prisma.manifest.findUnique({
          where: { id },
          include: {
            Delivery: true,
            _count: { select: { Delivery: true } },
          },
        });

        return NextResponse.json({
          success: true,
          manifest: updated,
          message: `Added ${deliveryIds.length} deliveries to manifest`,
        });
      }

      case "remove-deliveries": {
        if (manifest.status !== "OPEN") {
          return NextResponse.json(
            { error: "Cannot remove deliveries from a confirmed manifest" },
            { status: 400 }
          );
        }

        if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
          return NextResponse.json(
            { error: "Delivery IDs are required" },
            { status: 400 }
          );
        }

        // Get deliveries being removed
        const deliveries = await prisma.delivery.findMany({
          where: {
            id: { in: deliveryIds },
            manifestId: id,
          },
        });

        // Remove from manifest
        await prisma.delivery.updateMany({
          where: { id: { in: deliveryIds }, manifestId: id },
          data: {
            manifestId: null,
            status: "PACKED",
          },
        });

        // Update order statuses back to PACKED
        const orderIds = deliveries.map((d) => d.orderId);
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "PACKED" },
        });

        const updated = await prisma.manifest.findUnique({
          where: { id },
          include: {
            Delivery: true,
            _count: { select: { Delivery: true } },
          },
        });

        return NextResponse.json({
          success: true,
          manifest: updated,
          message: `Removed ${deliveryIds.length} deliveries from manifest`,
        });
      }

      case "update": {
        if (manifest.status === "CLOSED") {
          return NextResponse.json(
            { error: "Cannot update a closed manifest" },
            { status: 400 }
          );
        }

        const updated = await prisma.manifest.update({
          where: { id },
          data: {
            vehicleNo: vehicleNo !== undefined ? vehicleNo : undefined,
            driverName: driverName !== undefined ? driverName : undefined,
            driverPhone: driverPhone !== undefined ? driverPhone : undefined,
          },
          include: {
            Delivery: true,
            _count: { select: { Delivery: true } },
          },
        });

        return NextResponse.json({
          success: true,
          manifest: updated,
          message: "Manifest updated",
        });
      }

      case "confirm": {
        // Confirm manifest - ready for pickup
        if (manifest.status !== "OPEN") {
          return NextResponse.json(
            { error: "Manifest is already confirmed or closed" },
            { status: 400 }
          );
        }

        if (manifest.Delivery.length === 0) {
          return NextResponse.json(
            { error: "Cannot confirm empty manifest" },
            { status: 400 }
          );
        }

        const updated = await prisma.manifest.update({
          where: { id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedBy: session.user.id,
          },
          include: {
            Delivery: true,
            _count: { select: { Delivery: true } },
          },
        });

        return NextResponse.json({
          success: true,
          manifest: updated,
          message: "Manifest confirmed and ready for pickup",
        });
      }

      case "close": {
        // Close manifest - courier has picked up
        if (!["OPEN", "CONFIRMED"].includes(manifest.status)) {
          return NextResponse.json(
            { error: "Manifest is already closed" },
            { status: 400 }
          );
        }

        const updated = await prisma.manifest.update({
          where: { id },
          data: {
            status: "CLOSED",
            handoverImage: handoverImage || manifest.handoverImage,
            confirmedAt: manifest.confirmedAt || new Date(),
            confirmedBy: manifest.confirmedBy || session.user.id,
          },
          include: {
            Delivery: true,
            _count: { select: { Delivery: true } },
          },
        });

        // Update all deliveries to SHIPPED
        const deliveryIds = manifest.Delivery.map((d) => d.id);
        await prisma.delivery.updateMany({
          where: { id: { in: deliveryIds } },
          data: {
            status: "SHIPPED",
            shipDate: new Date(),
          },
        });

        // Update all orders to SHIPPED
        const orderIds = manifest.Delivery.map((d) => d.orderId);
        await prisma.order.updateMany({
          where: { id: { in: orderIds } },
          data: { status: "SHIPPED" },
        });

        await prisma.orderItem.updateMany({
          where: { orderId: { in: orderIds } },
          data: { status: "SHIPPED" },
        });

        return NextResponse.json({
          success: true,
          manifest: updated,
          message: `Manifest closed. ${deliveryIds.length} shipments marked as shipped.`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating manifest:", error);
    return NextResponse.json(
      { error: "Failed to update manifest" },
      { status: 500 }
    );
  }
}

// DELETE /api/manifests/[id] - Delete an open manifest
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const manifest = await prisma.manifest.findUnique({
      where: { id },
      include: {
        Delivery: true,
      },
    });

    if (!manifest) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    if (manifest.status !== "OPEN") {
      return NextResponse.json(
        { error: "Can only delete open manifests" },
        { status: 400 }
      );
    }

    // Remove deliveries from manifest
    const deliveryIds = manifest.Delivery.map((d) => d.id);
    await prisma.delivery.updateMany({
      where: { id: { in: deliveryIds } },
      data: {
        manifestId: null,
        status: "PACKED",
      },
    });

    // Update order statuses
    const orderIds = manifest.Delivery.map((d) => d.orderId);
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: "PACKED" },
    });

    // Delete manifest
    await prisma.manifest.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Manifest deleted",
    });
  } catch (error) {
    console.error("Error deleting manifest:", error);
    return NextResponse.json(
      { error: "Failed to delete manifest" },
      { status: 500 }
    );
  }
}
