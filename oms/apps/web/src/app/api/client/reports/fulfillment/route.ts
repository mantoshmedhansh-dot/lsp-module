import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/reports/fulfillment - Get fulfillment report data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30days";

    // Get client's company
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get shipments for the period
    const shipments = await prisma.shipment.findMany({
      where: {
        order: { companyId: user.companyId },
        createdAt: { gte: startDate },
      },
      include: {
        order: {
          select: { id: true, orderNo: true, createdAt: true },
        },
        transporter: {
          select: { id: true, name: true },
        },
        location: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate fulfillment metrics
    const totalShipments = shipments.length;
    const deliveredShipments = shipments.filter((s) => s.status === "DELIVERED");
    const inTransitShipments = shipments.filter((s) =>
      ["IN_TRANSIT", "OUT_FOR_DELIVERY", "PICKED_UP"].includes(s.status)
    );
    const failedShipments = shipments.filter((s) =>
      ["FAILED", "RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(s.status)
    );

    // Calculate delivery rate
    const deliveryRate = totalShipments > 0
      ? (deliveredShipments.length / totalShipments) * 100
      : 0;

    // Calculate average delivery time
    const deliveryTimes = deliveredShipments
      .filter((s) => s.deliveredAt)
      .map((s) => {
        const created = new Date(s.createdAt);
        const delivered = new Date(s.deliveredAt!);
        return (delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      });
    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, t) => sum + t, 0) / deliveryTimes.length
      : 0;

    // Get metrics by transporter
    const transporterMetrics: Record<string, {
      name: string;
      total: number;
      delivered: number;
      failed: number;
      avgTime: number;
    }> = {};

    shipments.forEach((s) => {
      const transporterId = s.transporterId || "unassigned";
      const transporterName = s.transporter?.name || "Unassigned";

      if (!transporterMetrics[transporterId]) {
        transporterMetrics[transporterId] = {
          name: transporterName,
          total: 0,
          delivered: 0,
          failed: 0,
          avgTime: 0,
        };
      }

      transporterMetrics[transporterId].total += 1;
      if (s.status === "DELIVERED") {
        transporterMetrics[transporterId].delivered += 1;
      }
      if (["FAILED", "RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"].includes(s.status)) {
        transporterMetrics[transporterId].failed += 1;
      }
    });

    // Get metrics by location
    const locationMetrics: Record<string, {
      name: string;
      total: number;
      delivered: number;
      pending: number;
    }> = {};

    shipments.forEach((s) => {
      const locationId = s.locationId || "unknown";
      const locationName = s.location?.name || "Unknown";

      if (!locationMetrics[locationId]) {
        locationMetrics[locationId] = {
          name: locationName,
          total: 0,
          delivered: 0,
          pending: 0,
        };
      }

      locationMetrics[locationId].total += 1;
      if (s.status === "DELIVERED") {
        locationMetrics[locationId].delivered += 1;
      }
      if (["CREATED", "PENDING", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)) {
        locationMetrics[locationId].pending += 1;
      }
    });

    // SLA compliance (orders shipped within 24 hours)
    const slaCompliant = shipments.filter((s) => {
      if (!s.order.createdAt || !s.pickedUpAt) return false;
      const orderDate = new Date(s.order.createdAt);
      const pickupDate = new Date(s.pickedUpAt);
      const hoursToShip = (pickupDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
      return hoursToShip <= 24;
    }).length;
    const slaCompliance = totalShipments > 0 ? (slaCompliant / totalShipments) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalShipments,
        deliveredCount: deliveredShipments.length,
        inTransitCount: inTransitShipments.length,
        failedCount: failedShipments.length,
        deliveryRate: Math.round(deliveryRate * 10) / 10,
        avgDeliveryTime: Math.round(avgDeliveryTime * 10) / 10,
        slaCompliance: Math.round(slaCompliance * 10) / 10,
      },
      byTransporter: Object.entries(transporterMetrics).map(([id, data]) => ({
        transporterId: id,
        ...data,
        deliveryRate: data.total > 0 ? Math.round((data.delivered / data.total) * 1000) / 10 : 0,
      })),
      byLocation: Object.entries(locationMetrics).map(([id, data]) => ({
        locationId: id,
        ...data,
        deliveryRate: data.total > 0 ? Math.round((data.delivered / data.total) * 1000) / 10 : 0,
      })),
      period,
    });
  } catch (error) {
    console.error("Error fetching fulfillment report:", error);
    return NextResponse.json(
      { error: "Failed to fetch fulfillment report" },
      { status: 500 }
    );
  }
}
