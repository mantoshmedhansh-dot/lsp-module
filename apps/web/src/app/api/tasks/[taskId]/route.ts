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

export async function GET(
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

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const updateData: any = {};

    // Handle status updates
    if (body.status) {
      updateData.status = body.status;

      if (body.status === "IN_PROGRESS" && task.status === "PENDING") {
        // Starting the task
      } else if (body.status === "COMPLETED") {
        updateData.completedAt = new Date();
        if (body.latitude) updateData.completedLat = body.latitude;
        if (body.longitude) updateData.completedLng = body.longitude;
      } else if (body.status === "FAILED") {
        updateData.failedReason = body.failedReason;
        updateData.attemptNumber = task.attemptNumber + 1;
      }
    }

    // Handle POD updates
    if (body.podReceiverName) updateData.podReceiverName = body.podReceiverName;
    if (body.podRelation) updateData.podRelation = body.podRelation;
    if (body.podSignature) updateData.podSignature = body.podSignature;
    if (body.podPhoto) updateData.podPhoto = body.podPhoto;
    if (body.podOtpVerified !== undefined) updateData.podOtpVerified = body.podOtpVerified;

    // Handle COD collection
    if (body.codCollected !== undefined) updateData.codCollected = body.codCollected;
    if (body.paymentMode) updateData.paymentMode = body.paymentMode;

    // Handle notes
    if (body.notes) updateData.notes = body.notes;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update task" },
      { status: 500 }
    );
  }
}
