import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    // Fetch hubs with their coordinates and stats
    const hubs = await prisma.hub.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        pincode: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        sortingCapacity: true,
      },
    });

    // Create hub lookup map
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    // Get shipment counts per hub
    const shipmentCounts = await prisma.shipment.groupBy({
      by: ["currentHubId"],
      where: {
        currentHubId: { not: null },
        status: {
          in: ["IN_HUB", "RECEIVED_AT_ORIGIN_HUB", "IN_SORTING", "SORTED", "CONSOLIDATED"],
        },
      },
      _count: {
        id: true,
      },
    });

    const hubShipmentMap = new Map(
      shipmentCounts.map((sc) => [sc.currentHubId, sc._count.id])
    );

    // Format hub data with utilization
    const hubsData = hubs.map((hub) => {
      const shipmentsInHub = hubShipmentMap.get(hub.id) || 0;
      const capacity = hub.sortingCapacity || 500;
      const utilizationPercent = Math.min(100, Math.round((shipmentsInHub / capacity) * 100));

      return {
        id: hub.id,
        code: hub.code,
        name: hub.name,
        type: hub.type,
        city: hub.city,
        state: hub.state,
        lat: hub.latitude || getDefaultLatitude(hub.city),
        lng: hub.longitude || getDefaultLongitude(hub.city),
        utilizationPercent,
        shipmentsInHub,
        capacity,
      };
    });

    // Fetch vehicles with current positions
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: { in: ["AVAILABLE", "IN_TRANSIT"] },
      },
      select: {
        id: true,
        registrationNo: true,
        type: true,
        status: true,
        lastLatitude: true,
        lastLongitude: true,
        lastGpsUpdate: true,
        currentHubId: true,
      },
    });

    // Get current trips for vehicles (without hub relations)
    const activeTrips = await prisma.trip.findMany({
      where: {
        status: { in: ["IN_TRANSIT", "LOADING", "READY"] },
      },
      select: {
        id: true,
        tripNumber: true,
        vehicleId: true,
        status: true,
        lastLatitude: true,
        lastLongitude: true,
        route: {
          select: {
            id: true,
            name: true,
            originHubId: true,
            destinationHubId: true,
          },
        },
      },
    });

    const tripByVehicle = new Map(
      activeTrips.map((t) => [t.vehicleId, t])
    );

    // Format vehicle data
    const vehiclesData = vehicles.map((v) => {
      const trip = tripByVehicle.get(v.id);
      let lat = v.lastLatitude;
      let lng = v.lastLongitude;

      // If no GPS, use hub location or trip route
      if (!lat || !lng) {
        if (trip?.lastLatitude && trip?.lastLongitude) {
          lat = trip.lastLatitude;
          lng = trip.lastLongitude;
        } else if (trip?.route?.originHubId) {
          const originHub = hubMap.get(trip.route.originHubId);
          if (originHub) {
            lat = originHub.latitude || getDefaultLatitude(originHub.city);
            lng = originHub.longitude || getDefaultLongitude(originHub.city);
          }
        } else if (v.currentHubId) {
          const hub = hubsData.find((h) => h.id === v.currentHubId);
          if (hub) {
            lat = hub.lat;
            lng = hub.lng;
          }
        }
      }

      return {
        id: v.id,
        regNo: v.registrationNo,
        type: v.type,
        status: v.status,
        lat: lat || 20.5937, // Default center of India
        lng: lng || 78.9629,
        lastUpdate: v.lastGpsUpdate?.toISOString() || null,
        currentTripId: trip?.id || null,
        tripNumber: trip?.tripNumber || null,
      };
    });

    // Format trip routes for map lines
    const tripRoutes = activeTrips.map((trip) => {
      const originHub = trip.route?.originHubId ? hubMap.get(trip.route.originHubId) : null;
      const destHub = trip.route?.destinationHubId ? hubMap.get(trip.route.destinationHubId) : null;

      const originLat = originHub?.latitude || getDefaultLatitude(originHub?.city);
      const originLng = originHub?.longitude || getDefaultLongitude(originHub?.city);
      const destLat = destHub?.latitude || getDefaultLatitude(destHub?.city);
      const destLng = destHub?.longitude || getDefaultLongitude(destHub?.city);

      return {
        id: trip.id,
        tripNumber: trip.tripNumber,
        status: trip.status,
        isDelayed: false, // Would calculate from expected times
        originHub: {
          code: originHub?.code || "?",
          lat: originLat,
          lng: originLng,
        },
        destHub: {
          code: destHub?.code || "?",
          lat: destLat,
          lng: destLng,
        },
        currentPosition: trip.lastLatitude && trip.lastLongitude
          ? { lat: trip.lastLatitude, lng: trip.lastLongitude }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        hubs: hubsData,
        vehicles: vehiclesData,
        tripRoutes,
        bounds: calculateBounds(hubsData),
      },
    });
  } catch (error) {
    console.error("Control Tower Map Data Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch map data" },
      { status: 500 }
    );
  }
}

// Default coordinates for major Indian cities
function getDefaultLatitude(city: string | null | undefined): number {
  const cityCoords: Record<string, number> = {
    Delhi: 28.6139,
    Mumbai: 19.076,
    Bangalore: 12.9716,
    Chennai: 13.0827,
    Hyderabad: 17.385,
    Kolkata: 22.5726,
    Pune: 18.5204,
    Ahmedabad: 23.0225,
    Jaipur: 26.9124,
    Lucknow: 26.8467,
  };
  return cityCoords[city || ""] || 20.5937; // Default to center of India
}

function getDefaultLongitude(city: string | null | undefined): number {
  const cityCoords: Record<string, number> = {
    Delhi: 77.209,
    Mumbai: 72.8777,
    Bangalore: 77.5946,
    Chennai: 80.2707,
    Hyderabad: 78.4867,
    Kolkata: 88.3639,
    Pune: 73.8567,
    Ahmedabad: 72.5714,
    Jaipur: 75.7873,
    Lucknow: 80.9462,
  };
  return cityCoords[city || ""] || 78.9629; // Default to center of India
}

function calculateBounds(hubs: { lat: number; lng: number }[]) {
  if (hubs.length === 0) {
    return {
      minLat: 8.4,
      maxLat: 37.6,
      minLng: 68.7,
      maxLng: 97.25,
    };
  }

  const lats = hubs.map((h) => h.lat);
  const lngs = hubs.map((h) => h.lng);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}
