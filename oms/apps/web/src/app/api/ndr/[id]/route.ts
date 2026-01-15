import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ndr/[id] - Get single NDR details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const ndr = await prisma.nDR.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            externalOrderNo: true,
            channel: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            shippingAddress: true,
            billingAddress: true,
            paymentMode: true,
            totalAmount: true,
            items: {
              include: {
                sku: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
        delivery: {
          select: {
            id: true,
            deliveryNo: true,
            awbNo: true,
            status: true,
            estimatedDelivery: true,
            transporter: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            trackingHistory: true,
          },
        },
        outreachAttempts: {
          orderBy: { createdAt: "desc" },
        },
        aiActions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!ndr) {
      return NextResponse.json({ error: "NDR not found" }, { status: 404 });
    }

    return NextResponse.json(ndr);
  } catch (error) {
    console.error("Error fetching NDR:", error);
    return NextResponse.json(
      { error: "Failed to fetch NDR" },
      { status: 500 }
    );
  }
}

// PATCH /api/ndr/[id] - Update NDR
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
      priority,
      resolutionType,
      resolutionNotes,
      reattemptDate,
      reattemptSlot,
      customerResponse,
      preferredSlot,
      updatedAddress,
      updatedPhone,
    } = body;

    // Find existing NDR
    const existingNDR = await prisma.nDR.findUnique({
      where: { id },
      include: { delivery: true },
    });

    if (!existingNDR) {
      return NextResponse.json({ error: "NDR not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      // If resolved, set resolution timestamp and resolver
      if (status === "RESOLVED") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = session.user.id || "MANUAL";
      }
    }

    if (priority) updateData.priority = priority;
    if (resolutionType) updateData.resolutionType = resolutionType;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (reattemptDate) updateData.reattemptDate = new Date(reattemptDate);
    if (reattemptSlot) updateData.reattemptSlot = reattemptSlot;
    if (customerResponse) updateData.customerResponse = customerResponse;
    if (preferredSlot) updateData.preferredSlot = preferredSlot;
    if (updatedAddress) updateData.updatedAddress = updatedAddress;
    if (updatedPhone) updateData.updatedPhone = updatedPhone;

    const ndr = await prisma.nDR.update({
      where: { id },
      data: updateData,
      include: {
        order: true,
        delivery: {
          include: {
            transporter: true,
          },
        },
        outreachAttempts: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // Update delivery status based on NDR status
    if (status === "RESOLVED" && resolutionType) {
      let deliveryStatus = existingNDR.delivery.status;

      switch (resolutionType) {
        case "REATTEMPT_SCHEDULED":
          deliveryStatus = "OUT_FOR_DELIVERY";
          break;
        case "ADDRESS_UPDATED":
          deliveryStatus = "PENDING";
          break;
        case "CUSTOMER_CONFIRMED":
          deliveryStatus = "OUT_FOR_DELIVERY";
          break;
        case "RTO_INITIATED":
          deliveryStatus = "RTO";
          break;
        case "DELIVERED":
          deliveryStatus = "DELIVERED";
          break;
        case "CANCELLED":
          deliveryStatus = "CANCELLED";
          break;
      }

      await prisma.delivery.update({
        where: { id: existingNDR.deliveryId },
        data: { status: deliveryStatus },
      });
    }

    // Log the update action
    await prisma.aIActionLog.create({
      data: {
        entityType: "NDR",
        entityId: ndr.id,
        ndrId: ndr.id,
        actionType: "MANUAL_UPDATE",
        actionDetails: {
          previousStatus: existingNDR.status,
          newStatus: status,
          resolutionType,
          updatedBy: session.user.id || "MANUAL",
        },
        status: "SUCCESS",
        companyId: ndr.companyId,
      },
    });

    return NextResponse.json(ndr);
  } catch (error) {
    console.error("Error updating NDR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update NDR" },
      { status: 500 }
    );
  }
}

// DELETE /api/ndr/[id] - Delete NDR (rare, mainly for testing)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if NDR exists
    const ndr = await prisma.nDR.findUnique({
      where: { id },
    });

    if (!ndr) {
      return NextResponse.json({ error: "NDR not found" }, { status: 404 });
    }

    // Delete related outreach attempts first
    await prisma.nDROutreach.deleteMany({
      where: { ndrId: id },
    });

    // Delete NDR
    await prisma.nDR.delete({
      where: { id },
    });

    return NextResponse.json({ message: "NDR deleted successfully" });
  } catch (error) {
    console.error("Error deleting NDR:", error);
    return NextResponse.json(
      { error: "Failed to delete NDR" },
      { status: 500 }
    );
  }
}
