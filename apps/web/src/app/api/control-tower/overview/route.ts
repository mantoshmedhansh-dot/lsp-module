import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query params
    const clientId = searchParams.get("clientId");
    const fulfillmentMode = searchParams.get("fulfillmentMode"); // OWN_FLEET, PARTNER, HYBRID
    const legType = searchParams.get("legType"); // FIRST_MILE, LINE_HAUL, LAST_MILE

    // Get current timestamp for consistency
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build where clause for shipments based on filters
    const shipmentWhere: any = {
      status: {
        notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"],
      },
    };

    if (clientId) {
      shipmentWhere.clientId = clientId;
    }

    if (fulfillmentMode) {
      shipmentWhere.fulfillmentMode = fulfillmentMode;
    }

    // Build where clause for delivered shipments (for on-time calculation)
    const deliveredWhere: any = {
      status: "DELIVERED",
      updatedAt: {
        gte: twentyFourHoursAgo,
      },
    };

    if (clientId) {
      deliveredWhere.clientId = clientId;
    }

    if (fulfillmentMode) {
      deliveredWhere.fulfillmentMode = fulfillmentMode;
    }

    // Fetch all data in parallel
    const [
      shipments,
      trips,
      hubs,
      vehicles,
      recentDeliveries,
      clientInfo,
    ] = await Promise.all([
      // All active shipments (filtered)
      prisma.shipment.findMany({
        where: shipmentWhere,
        select: {
          id: true,
          status: true,
          expectedDeliveryDate: true,
          currentHubId: true,
          fulfillmentMode: true,
          createdAt: true,
          clientId: true,
        },
      }),

      // Active trips
      prisma.trip.findMany({
        where: {
          status: {
            in: ["PLANNED", "LOADING", "READY", "IN_TRANSIT"],
          },
        },
        select: {
          id: true,
          status: true,
          vehicleId: true,
        },
      }),

      // All hubs with their capacity
      prisma.hub.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          sortingCapacity: true,
        },
      }),

      // All vehicles
      prisma.vehicle.findMany({
        select: {
          id: true,
          status: true,
        },
      }),

      // Recent deliveries for on-time calculation (filtered)
      prisma.shipment.findMany({
        where: deliveredWhere,
        select: {
          id: true,
          expectedDeliveryDate: true,
          updatedAt: true,
        },
      }),

      // Get client info if filtered
      clientId
        ? prisma.client.findUnique({
            where: { id: clientId },
            select: {
              id: true,
              companyName: true,
            },
          })
        : null,
    ]);

    // Filter by leg type if specified (fetch separately if needed)
    let filteredShipments = shipments;
    if (legType) {
      const shipmentLegs = await prisma.shipmentLeg.findMany({
        where: {
          legType,
          status: { not: "COMPLETED" },
        },
        select: {
          shipmentId: true,
        },
      });
      const shipmentIdsWithLeg = new Set(shipmentLegs.map((l) => l.shipmentId));
      filteredShipments = shipments.filter((s) => shipmentIdsWithLeg.has(s.id));
    }

    // Calculate KPIs
    const activeShipments = filteredShipments.length;
    const inTransit = filteredShipments.filter((s) => s.status === "IN_TRANSIT").length;

    // At-risk HIGH: shipments past expected delivery or close to breach
    const atRiskHigh = filteredShipments.filter((s) => {
      if (!s.expectedDeliveryDate) return false;
      const expected = new Date(s.expectedDeliveryDate);
      const hoursUntilExpected = (expected.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilExpected < 4;
    }).length;

    // Delayed over 2 hours
    const delayedOver2Hours = filteredShipments.filter((s) => {
      if (!s.expectedDeliveryDate) return false;
      const expected = new Date(s.expectedDeliveryDate);
      const delayHours = (now.getTime() - expected.getTime()) / (1000 * 60 * 60);
      return delayHours > 2;
    }).length;

    // On-time delivery percentage
    let onTimeDeliveryPercent = 100;
    if (recentDeliveries.length > 0) {
      const onTimeCount = recentDeliveries.filter((d) => {
        if (!d.expectedDeliveryDate) return true;
        return new Date(d.updatedAt) <= new Date(d.expectedDeliveryDate);
      }).length;
      onTimeDeliveryPercent = Math.round((onTimeCount / recentDeliveries.length) * 100);
    }

    // Hub utilization
    const hubShipmentCounts = new Map<string, number>();
    filteredShipments.forEach((s) => {
      if (s.currentHubId) {
        hubShipmentCounts.set(
          s.currentHubId,
          (hubShipmentCounts.get(s.currentHubId) || 0) + 1
        );
      }
    });

    let networkHubUtilization = 0;
    if (hubs.length > 0) {
      const totalCapacity = hubs.reduce((sum, h) => sum + (h.sortingCapacity || 500), 0);
      const totalShipmentsInHubs = Array.from(hubShipmentCounts.values()).reduce(
        (sum, count) => sum + count,
        0
      );
      networkHubUtilization = Math.min(
        100,
        Math.round((totalShipmentsInHubs / totalCapacity) * 100)
      );
    }

    // Fleet utilization
    const totalVehicles = vehicles.length;
    const inTransitVehicles = vehicles.filter((v) => v.status === "IN_TRANSIT").length;
    const availableVehicles = vehicles.filter((v) => v.status === "AVAILABLE").length;
    const fleetUtilization = totalVehicles > 0
      ? Math.round((inTransitVehicles / (inTransitVehicles + availableVehicles || 1)) * 100)
      : 0;

    // SLA breach risk
    const slaBreachRisk = filteredShipments.filter((s) => {
      if (!s.expectedDeliveryDate) return false;
      const expected = new Date(s.expectedDeliveryDate);
      const hoursUntilExpected = (expected.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilExpected > 0 && hoursUntilExpected < 24;
    }).length;

    // Fulfillment mode breakdown
    const fulfillmentBreakdown = {
      ownFleet: filteredShipments.filter((s) => s.fulfillmentMode === "OWN_FLEET").length,
      partner: filteredShipments.filter((s) => s.fulfillmentMode === "PARTNER").length,
      hybrid: filteredShipments.filter((s) => s.fulfillmentMode === "HYBRID").length,
    };

    // Trends (mock for now)
    const trends = {
      shipmentsChange: Math.round((Math.random() - 0.5) * 20),
      delayedChange: Math.round((Math.random() - 0.5) * 10),
      utilizationChange: Math.round((Math.random() - 0.5) * 10),
    };

    return NextResponse.json({
      success: true,
      data: {
        timestamp: now.toISOString(),
        filters: {
          clientId: clientId || null,
          clientName: clientInfo?.companyName || null,
          fulfillmentMode: fulfillmentMode || null,
          legType: legType || null,
        },
        kpis: {
          activeShipments,
          inTransit,
          atRiskHigh,
          delayedOver2Hours,
          onTimeDeliveryPercent,
          networkHubUtilization,
          fleetUtilization,
          slaBreachRisk,
        },
        fulfillmentBreakdown,
        trends,
        summary: {
          totalHubs: hubs.length,
          totalVehicles,
          activeTrips: trips.length,
          shipmentsInHub: filteredShipments.filter((s) =>
            ["IN_HUB", "RECEIVED_AT_ORIGIN_HUB", "IN_SORTING", "SORTED"].includes(s.status)
          ).length,
          shipmentsWithPartner: filteredShipments.filter((s) =>
            ["WITH_PARTNER", "PARTNER_IN_TRANSIT", "HANDED_TO_PARTNER"].includes(s.status)
          ).length,
          recentDeliveries: recentDeliveries.length,
        },
      },
    });
  } catch (error) {
    console.error("Control Tower Overview Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch control tower overview" },
      { status: 500 }
    );
  }
}
