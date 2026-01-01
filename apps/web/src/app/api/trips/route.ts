import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { createTripSchema } from "@/lib/validations";

// Generate trip number: TRP-YYYYMMDD-XXXX
function generateTripNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TRP-${dateStr}-${random}`;
}

// GET /api/trips - List all trips with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const routeId = searchParams.get("routeId");
    const vehicleId = searchParams.get("vehicleId");
    const driverId = searchParams.get("driverId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (routeId) {
      where.routeId = routeId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (driverId) {
      where.driverId = driverId;
    }

    if (dateFrom || dateTo) {
      where.scheduledDeparture = {};
      if (dateFrom) {
        where.scheduledDeparture.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.scheduledDeparture.lte = new Date(dateTo);
      }
    }

    if (search) {
      where.tripNumber = { contains: search };
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { scheduledDeparture: "desc" },
        include: {
          route: {
            select: { id: true, code: true, name: true },
          },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    // Fetch vehicle and driver info
    const vehicleIds = [...new Set(trips.map((t) => t.vehicleId))];
    const driverIds = [...new Set(trips.map((t) => t.driverId))];

    const [vehicles, drivers] = await Promise.all([
      prisma.vehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: { id: true, registrationNo: true, type: true },
      }),
      prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true, employeeCode: true, phone: true },
      }),
    ]);

    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const tripsWithDetails = trips.map((trip) => ({
      ...trip,
      vehicle: vehicleMap.get(trip.vehicleId),
      driver: driverMap.get(trip.driverId),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: tripsWithDetails,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

// POST /api/trips - Create a new trip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createTripSchema.parse(body);

    // Validate route exists
    const route = await prisma.route.findUnique({
      where: { id: validatedData.routeId },
    });

    if (!route) {
      return NextResponse.json(
        { success: false, error: "Route not found" },
        { status: 400 }
      );
    }

    // Validate vehicle exists and is available
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: validatedData.vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found" },
        { status: 400 }
      );
    }

    if (!vehicle.isActive) {
      return NextResponse.json(
        { success: false, error: "Vehicle is not active" },
        { status: 400 }
      );
    }

    // Validate driver exists and is available
    const driver = await prisma.driver.findUnique({
      where: { id: validatedData.driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { success: false, error: "Driver not found" },
        { status: 400 }
      );
    }

    if (!driver.isActive) {
      return NextResponse.json(
        { success: false, error: "Driver is not active" },
        { status: 400 }
      );
    }

    // Check for overlapping trips for vehicle
    const overlappingVehicleTrip = await prisma.trip.findFirst({
      where: {
        vehicleId: validatedData.vehicleId,
        status: { in: ["PLANNED", "LOADING", "READY", "IN_TRANSIT"] },
        OR: [
          {
            scheduledDeparture: { lte: validatedData.scheduledArrival },
            scheduledArrival: { gte: validatedData.scheduledDeparture },
          },
        ],
      },
    });

    if (overlappingVehicleTrip) {
      return NextResponse.json(
        {
          success: false,
          error: `Vehicle has overlapping trip: ${overlappingVehicleTrip.tripNumber}`,
        },
        { status: 400 }
      );
    }

    // Check for overlapping trips for driver
    const overlappingDriverTrip = await prisma.trip.findFirst({
      where: {
        driverId: validatedData.driverId,
        status: { in: ["PLANNED", "LOADING", "READY", "IN_TRANSIT"] },
        OR: [
          {
            scheduledDeparture: { lte: validatedData.scheduledArrival },
            scheduledArrival: { gte: validatedData.scheduledDeparture },
          },
        ],
      },
    });

    if (overlappingDriverTrip) {
      return NextResponse.json(
        {
          success: false,
          error: `Driver has overlapping trip: ${overlappingDriverTrip.tripNumber}`,
        },
        { status: 400 }
      );
    }

    // Generate trip number
    const tripNumber = generateTripNumber();

    // Use route's origin/destination if not overridden
    const originHubId = validatedData.originHubId || route.originHubId;
    const destinationHubId = validatedData.destinationHubId || route.destinationHubId;

    const trip = await prisma.trip.create({
      data: {
        tripNumber,
        routeId: validatedData.routeId,
        vehicleId: validatedData.vehicleId,
        driverId: validatedData.driverId,
        type: validatedData.type || route.type,
        originHubId,
        destinationHubId,
        scheduledDeparture: validatedData.scheduledDeparture,
        scheduledArrival: validatedData.scheduledArrival,
        plannedDistanceKm: route.distanceKm,
        estimatedCost: validatedData.estimatedCost || route.baseCostPerTrip,
        notes: validatedData.notes,
        sealNumber: validatedData.sealNumber,
      },
      include: {
        route: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    console.error("Error creating trip:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create trip" },
      { status: 500 }
    );
  }
}
