import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET /api/shipments/[shipmentId] - Get shipment details with full journey
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const { shipmentId } = await params;

    // Try to find by ID or AWB number
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [{ id: shipmentId }, { awbNumber: shipmentId }],
      },
      include: {
        consignment: {
          select: {
            id: true,
            consignmentNumber: true,
            status: true,
            tripId: true,
          },
        },
        journeyPlan: true,
        legs: {
          orderBy: { legIndex: "asc" },
        },
        scans: {
          orderBy: { scanTime: "desc" },
          take: 50,
        },
        events: {
          orderBy: { eventTime: "desc" },
          take: 50,
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Fetch hub details for current location
    let currentHub = null;
    if (shipment.currentHubId) {
      currentHub = await prisma.hub.findUnique({
        where: { id: shipment.currentHubId },
        select: { id: true, code: true, name: true, city: true },
      });
    }

    // Fetch partner details if applicable
    let partner = null;
    if (shipment.partnerId) {
      partner = await prisma.partner.findUnique({
        where: { id: shipment.partnerId },
        select: { id: true, code: true, name: true, displayName: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...shipment,
        currentHub,
        partner,
      },
    });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

// PATCH /api/shipments/[shipmentId] - Update shipment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const { shipmentId } = await params;
    const body = await request.json();

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Only allow certain fields to be updated
    const allowedUpdates: any = {};
    const updateableFields = [
      "consigneeName",
      "consigneePhone",
      "consigneeAddress",
      "pieces",
      "actualWeightKg",
      "contentDescription",
      "notes",
    ];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        allowedUpdates[field] = body[field];
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: allowedUpdates,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating shipment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update shipment" },
      { status: 500 }
    );
  }
}
