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
      include: { Company: true },
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

    // Get deliveries for the period
    const deliveries = await prisma.delivery.findMany({
      where: {
        Order: { Location: { companyId: user.companyId } },
        createdAt: { gte: startDate },
      },
      include: {
        Order: {
          select: { id: true, orderNo: true, createdAt: true, locationId: true, Location: { select: { id: true, name: true } } },
        },
        Transporter: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate fulfillment metrics
    const totalDeliveries = deliveries.length;
    const deliveredDeliveries = deliveries.filter((d) => d.status === "DELIVERED");
    const inTransitDeliveries = deliveries.filter((d) =>
      ["IN_TRANSIT", "OUT_FOR_DELIVERY", "SHIPPED"].includes(d.status)
    );
    const failedDeliveries = deliveries.filter((d) =>
      ["RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED", "CANCELLED"].includes(d.status)
    );

    // Calculate delivery rate
    const deliveryRate = totalDeliveries > 0
      ? (deliveredDeliveries.length / totalDeliveries) * 100
      : 0;

    // Calculate average delivery time
    const deliveryTimes = deliveredDeliveries
      .filter((d) => d.deliveryDate)
      .map((d) => {
        const created = new Date(d.createdAt);
        const delivered = new Date(d.deliveryDate!);
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

    deliveries.forEach((d) => {
      const transporterId = d.transporterId || "unassigned";
      const transporterName = d.Transporter?.name || "Unassigned";

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
      if (d.status === "DELIVERED") {
        transporterMetrics[transporterId].delivered += 1;
      }
      if (["RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED", "CANCELLED"].includes(d.status)) {
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

    deliveries.forEach((d) => {
      const locationId = d.Order.locationId || "unknown";
      const locationName = d.Order.Location?.name || "Unknown";

      if (!locationMetrics[locationId]) {
        locationMetrics[locationId] = {
          name: locationName,
          total: 0,
          delivered: 0,
          pending: 0,
        };
      }

      locationMetrics[locationId].total += 1;
      if (d.status === "DELIVERED") {
        locationMetrics[locationId].delivered += 1;
      }
      if (["PENDING", "PACKED", "MANIFESTED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(d.status)) {
        locationMetrics[locationId].pending += 1;
      }
    });

    // SLA compliance (orders shipped within 24 hours)
    const slaCompliant = deliveries.filter((d) => {
      if (!d.Order.createdAt || !d.shipDate) return false;
      const orderDate = new Date(d.Order.createdAt);
      const shipDate = new Date(d.shipDate);
      const hoursToShip = (shipDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
      return hoursToShip <= 24;
    }).length;
    const slaCompliance = totalDeliveries > 0 ? (slaCompliant / totalDeliveries) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalShipments: totalDeliveries,
        deliveredCount: deliveredDeliveries.length,
        inTransitCount: inTransitDeliveries.length,
        failedCount: failedDeliveries.length,
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
