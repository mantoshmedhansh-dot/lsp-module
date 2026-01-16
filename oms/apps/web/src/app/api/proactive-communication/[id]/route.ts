import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";
import { getCommunicationService } from "@/lib/services/communication";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/proactive-communication/[id] - Get single communication
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const communication = await prisma.proactiveCommunication.findUnique({
      where: { id },
      include: {
        Order: {
          select: {
            id: true,
            orderNo: true,
            customerName: true,
            customerPhone: true,
            status: true,
            OrderItem: {
              include: {
                SKU: {
                  select: {
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!communication) {
      return NextResponse.json({ error: "Communication not found" }, { status: 404 });
    }

    return NextResponse.json(communication);
  } catch (error) {
    console.error("Error fetching communication:", error);
    return NextResponse.json(
      { error: "Failed to fetch communication" },
      { status: 500 }
    );
  }
}

// PATCH /api/proactive-communication/[id] - Update communication
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      status,
      scheduledFor,
      content,
      priority,
    } = body;

    const existingComm = await prisma.proactiveCommunication.findUnique({
      where: { id },
    });

    if (!existingComm) {
      return NextResponse.json({ error: "Communication not found" }, { status: 404 });
    }

    // Only allow updates for scheduled communications
    if (existingComm.status === "SENT" || existingComm.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot update sent/delivered communications" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) updateData.status = status;
    if (scheduledFor) updateData.scheduledFor = new Date(scheduledFor);
    if (content) updateData.content = content;
    if (priority !== undefined) updateData.priority = priority;

    const communication = await prisma.proactiveCommunication.update({
      where: { id },
      data: updateData,
      include: {
        Order: {
          select: {
            id: true,
            orderNo: true,
          },
        },
      },
    });

    return NextResponse.json(communication);
  } catch (error) {
    console.error("Error updating communication:", error);
    return NextResponse.json(
      { error: "Failed to update communication" },
      { status: 500 }
    );
  }
}

// DELETE /api/proactive-communication/[id] - Cancel/delete communication
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existingComm = await prisma.proactiveCommunication.findUnique({
      where: { id },
    });

    if (!existingComm) {
      return NextResponse.json({ error: "Communication not found" }, { status: 404 });
    }

    // Only allow cancellation of scheduled communications
    if (existingComm.status === "SENT" || existingComm.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot delete sent/delivered communications" },
        { status: 400 }
      );
    }

    await prisma.proactiveCommunication.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ message: "Communication cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling communication:", error);
    return NextResponse.json(
      { error: "Failed to cancel communication" },
      { status: 500 }
    );
  }
}
