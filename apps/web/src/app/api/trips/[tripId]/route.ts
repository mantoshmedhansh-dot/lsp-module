import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { updateTripSchema } from "@/lib/validations";

// GET /api/trips/[tripId] - Get trip details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        route: true,
        events: {
          orderBy: { eventTime: "desc" },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    // Fetch vehicle, driver, and hub details
    const [vehicle, driver, originHub, destHub] = await Promise.all([
      prisma.vehicle.findUnique({
        where: { id: trip.vehicleId },
        select: {
          id: true,
          registrationNo: true,
          type: true,
          capacityTonnage: true,
          capacityVolumeCBM: true,
          make: true,
          model: true,
        },
      }),
      prisma.driver.findUnique({
        where: { id: trip.driverId },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          phone: true,
          licenseNumber: true,
        },
      }),
      trip.originHubId
        ? prisma.hub.findUnique({
            where: { id: trip.originHubId },
            select: { id: true, name: true, code: true, city: true, state: true },
          })
        : null,
      trip.destinationHubId
        ? prisma.hub.findUnique({
            where: { id: trip.destinationHubId },
            select: { id: true, name: true, code: true, city: true, state: true },
          })
        : null,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...trip,
        vehicle,
        driver,
        originHub,
        destinationHub: destHub,
      },
    });
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trip" },
      { status: 500 }
    );
  }
}

// PATCH /api/trips/[tripId] - Update trip
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const body = await request.json();
    const validatedData = updateTripSchema.parse(body);

    // Check if trip exists
    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!existingTrip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    // Handle status transitions
    if (validatedData.status) {
      const validTransitions: Record<string, string[]> = {
        PLANNED: ["LOADING", "CANCELLED"],
        LOADING: ["READY", "CANCELLED"],
        READY: ["IN_TRANSIT", "CANCELLED"],
        IN_TRANSIT: ["ARRIVED", "CANCELLED"],
        ARRIVED: ["UNLOADING", "COMPLETED"],
        UNLOADING: ["COMPLETED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      const allowedStatuses = validTransitions[existingTrip.status] || [];
      if (!allowedStatuses.includes(validatedData.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from ${existingTrip.status} to ${validatedData.status}`,
          },
          { status: 400 }
        );
      }

      // Auto-set timestamps based on status
      if (validatedData.status === "IN_TRANSIT" && !validatedData.actualDeparture) {
        validatedData.actualDeparture = new Date();
      }
      if (
        (validatedData.status === "ARRIVED" || validatedData.status === "COMPLETED") &&
        !validatedData.actualArrival
      ) {
        validatedData.actualArrival = new Date();
      }
    }

    // Update location timestamp if location is being updated
    const updateData: any = { ...validatedData };
    if (validatedData.lastLatitude || validatedData.lastLongitude) {
      updateData.lastLocationUpdate = new Date();
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        route: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Create status change event if status was updated
    if (validatedData.status) {
      await prisma.tripEvent.create({
        data: {
          tripId,
          eventType: validatedData.status === "IN_TRANSIT" ? "DEPARTURE" : "ARRIVAL",
          description: `Trip status changed to ${validatedData.status}`,
          location: validatedData.currentLocation,
          latitude: validatedData.lastLatitude,
          longitude: validatedData.lastLongitude,
          eventTime: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    console.error("Error updating trip:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update trip" },
      { status: 500 }
    );
  }
}

// DELETE /api/trips/[tripId] - Cancel trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    // Can only cancel planned or loading trips
    if (!["PLANNED", "LOADING"].includes(trip.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel trip in ${trip.status} status`,
        },
        { status: 400 }
      );
    }

    // Soft cancel by changing status
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: "CANCELLED" },
    });

    // Create cancellation event
    await prisma.tripEvent.create({
      data: {
        tripId,
        eventType: "INCIDENT",
        description: "Trip cancelled",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Trip cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling trip:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel trip" },
      { status: 500 }
    );
  }
}
