import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Helper to verify auth token
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || !session.isActive || new Date() > session.expiresAt) {
    return null;
  }

  return session.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId } = await params;
    const body = await request.json();

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (task.assignedToId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // For delivery tasks, verify POD
    if (task.type === "DELIVERY") {
      if (!body.podReceiverName) {
        return NextResponse.json(
          { success: false, error: "Receiver name is required for delivery" },
          { status: 400 }
        );
      }

      // Verify COD collection if applicable
      if (task.isCod && task.codAmount > 0) {
        if (!body.codCollected || body.codCollected < task.codAmount) {
          return NextResponse.json(
            { success: false, error: "Full COD amount must be collected" },
            { status: 400 }
          );
        }
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedLat: body.latitude,
        completedLng: body.longitude,
        podReceiverName: body.podReceiverName,
        podRelation: body.podRelation,
        podSignature: body.podSignature,
        podPhoto: body.podPhoto,
        podOtpVerified: body.podOtpVerified || false,
        codCollected: body.codCollected || 0,
        paymentMode: body.paymentMode,
        notes: body.notes,
      },
    });

    // If linked to a shipment, update shipment status
    if (task.shipmentId) {
      const newStatus = task.type === "PICKUP" ? "PICKED_UP" : "DELIVERED";
      await prisma.shipment.update({
        where: { id: task.shipmentId },
        data: {
          status: newStatus,
          ...(task.type === "DELIVERY" && {
            deliveredAt: new Date(),
            podCaptured: true,
            podReceiverName: body.podReceiverName,
            podSignature: body.podSignature,
            podPhoto: body.podPhoto,
            podRelation: body.podRelation,
            podLatitude: body.latitude,
            podLongitude: body.longitude,
          }),
          ...(task.type === "PICKUP" && {
            pickedUpAt: new Date(),
          }),
        },
      });

      // Create shipment event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: task.shipmentId,
          eventType: task.type === "PICKUP" ? "PICKUP" : "DELIVERY",
          status: newStatus,
          statusText: task.type === "PICKUP"
            ? "Shipment picked up from shipper"
            : `Delivered to ${body.podReceiverName}`,
          location: task.city || task.address,
          source: "MOBILE_APP",
          eventTime: new Date(),
        },
      });

      // Create scan record
      await prisma.shipmentScan.create({
        data: {
          shipmentId: task.shipmentId,
          scanType: task.type === "PICKUP" ? "PICKUP_SCAN" : "DELIVERY_SCAN",
          scanCode: task.awbNumber || "",
          hubId: task.hubId,
          scannedBy: user.id,
          scannedByName: user.name,
          latitude: body.latitude,
          longitude: body.longitude,
          remarks: body.notes,
          scanTime: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete task" },
      { status: 500 }
    );
  }
}
