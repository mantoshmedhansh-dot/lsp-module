import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET /api/partner-handovers/[handoverId] - Get handover details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handoverId: string }> }
) {
  try {
    const { handoverId } = await params;

    // Find by ID or handover number
    const handover = await prisma.partnerHandover.findFirst({
      where: {
        OR: [{ id: handoverId }, { handoverNumber: handoverId }],
      },
    });

    if (!handover) {
      return NextResponse.json(
        { success: false, error: "Handover not found" },
        { status: 404 }
      );
    }

    // Fetch related data
    const shipmentIds = JSON.parse(handover.shipmentIds || "[]");
    const [partner, hub, shipments] = await Promise.all([
      prisma.partner.findUnique({
        where: { id: handover.partnerId },
        select: { id: true, code: true, name: true, displayName: true },
      }),
      prisma.hub.findUnique({
        where: { id: handover.handoverHubId },
        select: { id: true, code: true, name: true, city: true },
      }),
      prisma.shipment.findMany({
        where: { id: { in: shipmentIds } },
        select: {
          id: true,
          awbNumber: true,
          partnerAwb: true,
          status: true,
          consigneeName: true,
          consigneePincode: true,
          consigneeCity: true,
          chargeableWeightKg: true,
          pieces: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...handover,
        partner,
        handoverHub: hub,
        shipments,
      },
    });
  } catch (error) {
    console.error("Error fetching handover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch handover" },
      { status: 500 }
    );
  }
}

// PATCH /api/partner-handovers/[handoverId] - Update handover
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ handoverId: string }> }
) {
  try {
    const { handoverId } = await params;
    const body = await request.json();

    const { action, acknowledgedBy, partnerMrNumber, partnerAwbMappings, remarks } =
      body;

    const handover = await prisma.partnerHandover.findUnique({
      where: { id: handoverId },
    });

    if (!handover) {
      return NextResponse.json(
        { success: false, error: "Handover not found" },
        { status: 404 }
      );
    }

    // Handle acknowledge action
    if (action === "ACKNOWLEDGE") {
      if (handover.status !== "PENDING" && handover.status !== "HANDED_OVER") {
        return NextResponse.json(
          { success: false, error: "Handover already processed" },
          { status: 400 }
        );
      }

      await prisma.partnerHandover.update({
        where: { id: handoverId },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          acknowledgedBy,
          partnerMrNumber, // Partner's manifest/receipt number
        },
      });

      // If partner AWB mappings provided, update shipments
      if (partnerAwbMappings && Array.isArray(partnerAwbMappings)) {
        for (const mapping of partnerAwbMappings) {
          const { awbNumber, partnerAwb } = mapping;
          if (awbNumber && partnerAwb) {
            await prisma.shipment.updateMany({
              where: { awbNumber },
              data: { partnerAwb },
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: { message: "Handover acknowledged" },
      });
    }

    // Handle mark as handed over (physical handover done)
    if (action === "HAND_OVER") {
      if (handover.status !== "PENDING") {
        return NextResponse.json(
          { success: false, error: "Invalid handover status" },
          { status: 400 }
        );
      }

      await prisma.partnerHandover.update({
        where: { id: handoverId },
        data: {
          status: "HANDED_OVER",
          handoverTime: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Handover completed" },
      });
    }

    // Regular update
    const allowedUpdates: any = {};
    if (remarks !== undefined) allowedUpdates.remarks = remarks;
    if (partnerMrNumber !== undefined)
      allowedUpdates.partnerMrNumber = partnerMrNumber;

    const updated = await prisma.partnerHandover.update({
      where: { id: handoverId },
      data: allowedUpdates,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating handover:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update handover" },
      { status: 500 }
    );
  }
}
