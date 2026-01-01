import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Common failure reasons
const FAILURE_REASONS = {
  PICKUP: [
    "SHIPPER_NOT_AVAILABLE",
    "WRONG_ADDRESS",
    "PACKAGE_NOT_READY",
    "SHIPPER_REFUSED",
    "VEHICLE_BREAKDOWN",
    "WEATHER_CONDITIONS",
    "OTHER",
  ],
  DELIVERY: [
    "CONSIGNEE_NOT_AVAILABLE",
    "WRONG_ADDRESS",
    "REFUSED_BY_CONSIGNEE",
    "INCOMPLETE_ADDRESS",
    "CONSIGNEE_OUT_OF_TOWN",
    "COD_NOT_READY",
    "RESCHEDULE_REQUESTED",
    "VEHICLE_BREAKDOWN",
    "WEATHER_CONDITIONS",
    "OTHER",
  ],
};

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

    if (!body.reason) {
      return NextResponse.json(
        { success: false, error: "Failure reason is required" },
        { status: 400 }
      );
    }

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

    const newAttemptNumber = task.attemptNumber + 1;
    const hasMoreAttempts = newAttemptNumber < task.maxAttempts;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failedReason: body.reason,
        attemptNumber: newAttemptNumber,
        notes: body.notes
          ? `${task.notes || ""}\n[Attempt ${newAttemptNumber}] ${body.reason}: ${body.notes}`.trim()
          : task.notes,
      },
    });

    // If linked to a shipment, update status and create events
    if (task.shipmentId) {
      const newStatus = task.type === "PICKUP" ? "PICKUP_FAILED" : "DELIVERY_FAILED";

      await prisma.shipment.update({
        where: { id: task.shipmentId },
        data: {
          status: newStatus,
          deliveryAttempts: newAttemptNumber,
        },
      });

      // Create shipment event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: task.shipmentId,
          eventType: task.type === "PICKUP" ? "PICKUP_FAILED" : "DELIVERY_FAILED",
          status: newStatus,
          statusText: `${task.type} attempt ${newAttemptNumber} failed: ${body.reason}`,
          location: task.city || task.address,
          source: "MOBILE_APP",
          remarks: body.notes,
          eventTime: new Date(),
        },
      });

      // For delivery failures, create NDR case if not exists
      if (task.type === "DELIVERY") {
        const existingNdr = await prisma.ndrCase.findUnique({
          where: { orderId: task.shipmentId },
        });

        if (!existingNdr) {
          // Note: This uses orderId but shipmentId - adjust based on your schema
          // For now, we'll skip NDR creation if the relation doesn't exist
        }
      }
    }

    // If more attempts available and reschedule requested, create new task for tomorrow
    if (hasMoreAttempts && body.reason === "RESCHEDULE_REQUESTED") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const dateStr = tomorrow.toISOString().slice(0, 10).replace(/-/g, "");
      const count = await prisma.task.count({
        where: {
          taskNumber: {
            startsWith: `TSK${dateStr}`,
          },
        },
      });
      const newTaskNumber = `TSK${dateStr}${String(count + 1).padStart(4, "0")}`;

      await prisma.task.create({
        data: {
          taskNumber: newTaskNumber,
          assignedToId: task.assignedToId,
          hubId: task.hubId,
          type: task.type,
          priority: task.priority,
          sequence: 0,
          shipmentId: task.shipmentId,
          awbNumber: task.awbNumber,
          tripId: null,
          consignmentId: null,
          address: task.address,
          pincode: task.pincode,
          city: task.city,
          latitude: task.latitude,
          longitude: task.longitude,
          contactName: task.contactName,
          contactPhone: task.contactPhone,
          isCod: task.isCod,
          codAmount: task.codAmount,
          scheduledDate: tomorrow,
          timeSlotStart: task.timeSlotStart,
          timeSlotEnd: task.timeSlotEnd,
          attemptNumber: newAttemptNumber,
          maxAttempts: task.maxAttempts,
          notes: `Rescheduled from ${task.taskNumber}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedTask,
      hasMoreAttempts,
      message: hasMoreAttempts
        ? `Task failed. ${task.maxAttempts - newAttemptNumber} attempts remaining.`
        : "Task failed. Maximum attempts reached.",
    });
  } catch (error) {
    console.error("Error failing task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// GET to retrieve failure reasons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "DELIVERY";

  const reasons = FAILURE_REASONS[type as keyof typeof FAILURE_REASONS] || FAILURE_REASONS.DELIVERY;

  return NextResponse.json({
    success: true,
    data: reasons.map(reason => ({
      code: reason,
      label: reason.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    })),
  });
}
