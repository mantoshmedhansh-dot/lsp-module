import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { updateRouteSchema } from "@/lib/validations";

// GET /api/routes/[routeId] - Get route details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await params;

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        trips: {
          take: 10,
          orderBy: { scheduledDeparture: "desc" },
          select: {
            id: true,
            tripNumber: true,
            status: true,
            scheduledDeparture: true,
            scheduledArrival: true,
            vehicleId: true,
            driverId: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { success: false, error: "Route not found" },
        { status: 404 }
      );
    }

    // Fetch hub details
    let originHub = null;
    let destinationHub = null;

    if (route.originHubId) {
      originHub = await prisma.hub.findUnique({
        where: { id: route.originHubId },
        select: { id: true, name: true, code: true, city: true, state: true },
      });
    }

    if (route.destinationHubId) {
      destinationHub = await prisma.hub.findUnique({
        where: { id: route.destinationHubId },
        select: { id: true, name: true, code: true, city: true, state: true },
      });
    }

    // Calculate route statistics
    const tripStats = await prisma.trip.aggregate({
      where: { routeId },
      _count: { id: true },
      _avg: {
        fillRateWeight: true,
        fillRateVolume: true,
        actualCost: true,
      },
    });

    const completedTrips = await prisma.trip.count({
      where: { routeId, status: "COMPLETED" },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...route,
        originHub,
        destinationHub,
        statistics: {
          totalTrips: tripStats._count.id,
          completedTrips,
          avgFillRateWeight: tripStats._avg.fillRateWeight || 0,
          avgFillRateVolume: tripStats._avg.fillRateVolume || 0,
          avgCost: tripStats._avg.actualCost || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching route:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch route" },
      { status: 500 }
    );
  }
}

// PATCH /api/routes/[routeId] - Update route
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await params;
    const body = await request.json();
    const validatedData = updateRouteSchema.parse(body);

    // Check if route exists
    const existingRoute = await prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!existingRoute) {
      return NextResponse.json(
        { success: false, error: "Route not found" },
        { status: 404 }
      );
    }

    // Check for duplicate code if being changed
    if (validatedData.code && validatedData.code !== existingRoute.code) {
      const duplicateCode = await prisma.route.findUnique({
        where: { code: validatedData.code },
      });
      if (duplicateCode) {
        return NextResponse.json(
          { success: false, error: "Route code already exists" },
          { status: 400 }
        );
      }
    }

    // Validate hub IDs if provided
    if (validatedData.originHubId) {
      const originHub = await prisma.hub.findUnique({
        where: { id: validatedData.originHubId },
      });
      if (!originHub) {
        return NextResponse.json(
          { success: false, error: "Origin hub not found" },
          { status: 400 }
        );
      }
    }

    if (validatedData.destinationHubId) {
      const destHub = await prisma.hub.findUnique({
        where: { id: validatedData.destinationHubId },
      });
      if (!destHub) {
        return NextResponse.json(
          { success: false, error: "Destination hub not found" },
          { status: 400 }
        );
      }
    }

    const route = await prisma.route.update({
      where: { id: routeId },
      data: validatedData,
    });

    return NextResponse.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    console.error("Error updating route:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update route" },
      { status: 500 }
    );
  }
}

// DELETE /api/routes/[routeId] - Delete/deactivate route
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await params;

    // Check if route exists
    const route = await prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      return NextResponse.json(
        { success: false, error: "Route not found" },
        { status: 404 }
      );
    }

    // Check for active trips
    const activeTrips = await prisma.trip.count({
      where: {
        routeId,
        status: { in: ["PLANNED", "LOADING", "READY", "IN_TRANSIT"] },
      },
    });

    if (activeTrips > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete route with ${activeTrips} active trips. Deactivate instead.`,
        },
        { status: 400 }
      );
    }

    // Soft delete by deactivating
    await prisma.route.update({
      where: { id: routeId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Route deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting route:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete route" },
      { status: 500 }
    );
  }
}
