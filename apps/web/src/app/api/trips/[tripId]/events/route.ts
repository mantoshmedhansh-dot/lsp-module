import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { tripEventSchema } from "@/lib/validations";

// GET /api/trips/[tripId]/events - List all events for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    // Verify trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    const events = await prisma.tripEvent.findMany({
      where: { tripId },
      orderBy: { eventTime: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching trip events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trip events" },
      { status: 500 }
    );
  }
}

// POST /api/trips/[tripId]/events - Add a new event to a trip
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const body = await request.json();
    const validatedData = tripEventSchema.parse(body);

    // Verify trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, status: true },
    });

    if (!trip) {
      return NextResponse.json(
        { success: false, error: "Trip not found" },
        { status: 404 }
      );
    }

    // Create the event
    const event = await prisma.tripEvent.create({
      data: {
        tripId,
        ...validatedData,
      },
    });

    // Update trip location if provided
    if (validatedData.latitude || validatedData.longitude || validatedData.location) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          lastLatitude: validatedData.latitude,
          lastLongitude: validatedData.longitude,
          currentLocation: validatedData.location,
          lastLocationUpdate: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    console.error("Error creating trip event:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to create trip event" },
      { status: 500 }
    );
  }
}
