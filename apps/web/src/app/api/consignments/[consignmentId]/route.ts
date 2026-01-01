import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET /api/consignments/[consignmentId] - Get consignment details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> }
) {
  try {
    const { consignmentId } = await params;

    // Find by ID or consignment number
    const consignment = await prisma.consignment.findFirst({
      where: {
        OR: [
          { id: consignmentId },
          { consignmentNumber: consignmentId },
        ],
      },
      include: {
        shipments: {
          select: {
            id: true,
            awbNumber: true,
            status: true,
            consigneeName: true,
            consigneePincode: true,
            consigneeCity: true,
            chargeableWeightKg: true,
            pieces: true,
          },
        },
        bags: true,
      },
    });

    if (!consignment) {
      return NextResponse.json(
        { success: false, error: "Consignment not found" },
        { status: 404 }
      );
    }

    // Fetch hub and trip details
    const [originHub, destHub, trip] = await Promise.all([
      prisma.hub.findUnique({
        where: { id: consignment.originHubId },
        select: { id: true, code: true, name: true, city: true },
      }),
      prisma.hub.findUnique({
        where: { id: consignment.destinationHubId },
        select: { id: true, code: true, name: true, city: true },
      }),
      consignment.tripId
        ? prisma.trip.findUnique({
            where: { id: consignment.tripId },
            select: {
              id: true,
              tripNumber: true,
              status: true,
              scheduledDeparture: true,
            },
          })
        : null,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...consignment,
        originHub,
        destinationHub: destHub,
        trip,
      },
    });
  } catch (error) {
    console.error("Error fetching consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch consignment" },
      { status: 500 }
    );
  }
}

// PATCH /api/consignments/[consignmentId] - Update consignment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> }
) {
  try {
    const { consignmentId } = await params;
    const body = await request.json();

    const { action, tripId, notes, sealNumber } = body;

    const consignment = await prisma.consignment.findUnique({
      where: { id: consignmentId },
      include: {
        shipments: true,
      },
    });

    if (!consignment) {
      return NextResponse.json(
        { success: false, error: "Consignment not found" },
        { status: 404 }
      );
    }

    // Handle specific actions
    if (action === "CLOSE") {
      // Close consignment - no more shipments can be added
      if (consignment.status !== "OPEN") {
        return NextResponse.json(
          { success: false, error: "Consignment is not open" },
          { status: 400 }
        );
      }

      // Calculate totals from associated shipments
      const totals = await prisma.shipment.aggregate({
        where: { consignmentId: consignment.id },
        _sum: { chargeableWeightKg: true },
        _count: true,
      });

      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          shipmentCount: totals._count,
          totalWeightKg: totals._sum.chargeableWeightKg || 0,
          sealNumber,
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Consignment closed", shipmentCount: totals._count },
      });
    }

    if (action === "ASSIGN_TRIP") {
      // Assign consignment to a trip
      if (!tripId) {
        return NextResponse.json(
          { success: false, error: "Trip ID required" },
          { status: 400 }
        );
      }

      const trip = await prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) {
        return NextResponse.json(
          { success: false, error: "Trip not found" },
          { status: 404 }
        );
      }

      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          tripId,
          status: "LOADED",
          loadedAt: new Date(),
        },
      });

      // Update trip totals
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          totalShipments: { increment: consignment.shipmentCount },
          totalWeightKg: { increment: consignment.totalWeightKg },
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Consignment assigned to trip" },
      });
    }

    if (action === "DISPATCH") {
      // Mark consignment as dispatched (in transit)
      if (consignment.status !== "LOADED") {
        return NextResponse.json(
          { success: false, error: "Consignment must be loaded first" },
          { status: 400 }
        );
      }

      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          status: "IN_TRANSIT",
          dispatchedAt: new Date(),
        },
      });

      // Update all shipments in consignment
      await prisma.shipment.updateMany({
        where: { consignmentId: consignment.id },
        data: { status: "IN_TRANSIT" },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Consignment dispatched" },
      });
    }

    if (action === "ARRIVE") {
      // Mark consignment as arrived at destination
      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          status: "ARRIVED",
          arrivedAt: new Date(),
        },
      });

      // Update all shipments - move to destination hub
      await prisma.shipment.updateMany({
        where: { consignmentId: consignment.id },
        data: {
          status: "IN_HUB",
          currentHubId: consignment.destinationHubId,
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: "Consignment arrived at destination" },
      });
    }

    // Regular update
    const allowedUpdates: any = {};
    if (notes !== undefined) allowedUpdates.notes = notes;
    if (sealNumber !== undefined) allowedUpdates.sealNumber = sealNumber;

    const updated = await prisma.consignment.update({
      where: { id: consignmentId },
      data: allowedUpdates,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update consignment" },
      { status: 500 }
    );
  }
}

// DELETE /api/consignments/[consignmentId] - Delete empty consignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> }
) {
  try {
    const { consignmentId } = await params;

    const consignment = await prisma.consignment.findUnique({
      where: { id: consignmentId },
      include: { _count: { select: { shipments: true } } },
    });

    if (!consignment) {
      return NextResponse.json(
        { success: false, error: "Consignment not found" },
        { status: 404 }
      );
    }

    if (consignment._count.shipments > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete consignment with shipments" },
        { status: 400 }
      );
    }

    if (consignment.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: "Can only delete open consignments" },
        { status: 400 }
      );
    }

    await prisma.consignment.delete({
      where: { id: consignmentId },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Consignment deleted" },
    });
  } catch (error) {
    console.error("Error deleting consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete consignment" },
      { status: 500 }
    );
  }
}
