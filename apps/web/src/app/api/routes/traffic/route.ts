import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Traffic-based Route Optimization API
// Integrates with Google Maps / HERE Maps for real-time traffic data

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tripId = searchParams.get("tripId");
    const shipmentId = searchParams.get("shipmentId");

    const where: any = {};
    if (tripId) where.tripId = tripId;
    if (shipmentId) where.shipmentId = shipmentId;

    const routes = await prisma.trafficRouteCalculation.findMany({
      where,
      orderBy: { calculatedAt: "desc" },
      take: 50,
    });

    // Get toll plazas for reference
    const tollPlazas = await prisma.tollPlaza.findMany({
      where: { isActive: true },
      orderBy: { state: "asc" },
    });

    // Get active weather alerts
    const weatherAlerts = await prisma.weatherAlert.findMany({
      where: {
        isActive: true,
        effectiveUntil: { gte: new Date() },
      },
      orderBy: { severity: "desc" },
    });

    // Get active traffic incidents
    const trafficIncidents = await prisma.trafficIncident.findMany({
      where: {
        isActive: true,
        OR: [
          { endTime: null },
          { endTime: { gte: new Date() } },
        ],
      },
      orderBy: { severity: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        routes,
        tollPlazas,
        weatherAlerts,
        trafficIncidents,
      },
    });
  } catch (error) {
    console.error("Error fetching traffic routes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch traffic routes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CALCULATE_ROUTE": {
        const {
          originLat,
          originLng,
          destinationLat,
          destinationLng,
          waypoints,
          optimizationType = "FASTEST",
          tripId,
          shipmentId,
        } = body;

        // In production, this would call Google Maps Directions API
        // const googleMapsResponse = await fetch(
        //   `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&departure_time=now&traffic_model=best_guess&key=${process.env.GOOGLE_MAPS_API_KEY}`
        // );

        // Mock calculation for development
        const distanceMeters = Math.round(
          calculateHaversineDistance(originLat, originLng, destinationLat, destinationLng) * 1000
        );
        const durationMinutes = Math.round(distanceMeters / 1000 / 40 * 60); // Assume 40 km/h avg
        const trafficMultiplier = 1 + Math.random() * 0.5; // 0-50% traffic delay
        const durationInTraffic = Math.round(durationMinutes * trafficMultiplier);

        // Estimate toll cost based on distance
        const tollPlazas = await prisma.tollPlaza.findMany({ where: { isActive: true } });
        const estimatedTollCount = Math.floor(distanceMeters / 100000); // Roughly 1 toll per 100km
        const estimatedTollCost = estimatedTollCount * 150; // Avg Rs 150 per toll

        // Estimate fuel cost (12 km/l diesel, Rs 90/l)
        const estimatedFuelCost = Math.round((distanceMeters / 1000) / 12 * 90);

        // Check for weather alerts along route
        const weatherAlerts = await prisma.weatherAlert.findMany({
          where: { isActive: true, effectiveUntil: { gte: new Date() } },
        });
        const weatherCondition = weatherAlerts.length > 0 ? weatherAlerts[0].alertType : "CLEAR";
        const weatherDelayMinutes = weatherAlerts.reduce((sum, a) => sum + a.suggestedDelayHours * 60, 0);

        // Determine traffic level
        let trafficLevel = "NORMAL";
        if (trafficMultiplier > 1.4) trafficLevel = "SEVERE";
        else if (trafficMultiplier > 1.25) trafficLevel = "HEAVY";
        else if (trafficMultiplier < 1.1) trafficLevel = "LIGHT";

        const route = await prisma.trafficRouteCalculation.create({
          data: {
            originLat,
            originLng,
            destinationLat,
            destinationLng,
            waypoints: waypoints ? JSON.stringify(waypoints) : null,
            distanceMeters,
            durationMinutes,
            durationInTraffic,
            trafficLevel,
            congestionScore: (trafficMultiplier - 1) * 100,
            estimatedTollCost,
            estimatedFuelCost,
            tollPlazaCount: estimatedTollCount,
            weatherCondition,
            weatherDelayMinutes,
            optimizationType,
            provider: "GOOGLE",
            tripId,
            shipmentId,
            validUntil: new Date(Date.now() + 30 * 60 * 1000), // Valid for 30 mins
          },
        });

        return NextResponse.json({
          success: true,
          data: route,
        });
      }

      case "ADD_TOLL_PLAZA": {
        const { name, code, highway, latitude, longitude, state, rates } = body;

        const tollPlaza = await prisma.tollPlaza.create({
          data: {
            name,
            code,
            highway,
            latitude,
            longitude,
            state,
            carSingleTrip: rates?.carSingleTrip || 0,
            carReturnTrip: rates?.carReturnTrip || 0,
            lcvSingleTrip: rates?.lcvSingleTrip || 0,
            lcvReturnTrip: rates?.lcvReturnTrip || 0,
            busTruckSingleTrip: rates?.busTruckSingleTrip || 0,
            busTruckReturnTrip: rates?.busTruckReturnTrip || 0,
            heavyVehicleSingleTrip: rates?.heavyVehicleSingleTrip || 0,
            heavyVehicleReturnTrip: rates?.heavyVehicleReturnTrip || 0,
          },
        });

        return NextResponse.json({ success: true, data: tollPlaza });
      }

      case "ADD_WEATHER_ALERT": {
        const {
          region,
          state,
          city,
          latitude,
          longitude,
          alertType,
          severity,
          headline,
          description,
          impactOnDelivery,
          suggestedDelayHours,
          effectiveFrom,
          effectiveUntil,
          source,
        } = body;

        const alert = await prisma.weatherAlert.create({
          data: {
            region,
            state,
            city,
            latitude,
            longitude,
            alertType,
            severity: severity || "MODERATE",
            headline,
            description,
            impactOnDelivery,
            suggestedDelayHours: suggestedDelayHours || 0,
            effectiveFrom: new Date(effectiveFrom),
            effectiveUntil: new Date(effectiveUntil),
            source: source || "IMD",
          },
        });

        return NextResponse.json({ success: true, data: alert });
      }

      case "REPORT_INCIDENT": {
        const {
          latitude,
          longitude,
          roadName,
          city,
          state,
          incidentType,
          severity,
          description,
          delayMinutes,
          expectedClearTime,
        } = body;

        const incident = await prisma.trafficIncident.create({
          data: {
            latitude,
            longitude,
            roadName,
            city,
            state,
            incidentType,
            severity: severity || "MODERATE",
            description,
            delayMinutes: delayMinutes || 0,
            startTime: new Date(),
            expectedClearTime: expectedClearTime ? new Date(expectedClearTime) : null,
            source: "USER_REPORTED",
          },
        });

        return NextResponse.json({ success: true, data: incident });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in traffic route API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Haversine formula to calculate distance between two points
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
