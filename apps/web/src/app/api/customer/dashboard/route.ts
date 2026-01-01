import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

async function verifyCustomerAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await prisma.customerSession.findUnique({
    where: { token },
    include: { client: true },
  });

  if (!session || !session.isActive || new Date() > session.expiresAt) {
    return null;
  }

  return session.client;
}

export async function GET(request: NextRequest) {
  try {
    const client = await verifyCustomerAuth(request);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get shipment statistics for this client
    const shipments = await prisma.shipment.findMany({
      where: { clientId: client.id },
      include: {
        scans: {
          orderBy: { scanTime: "desc" },
        },
      },
    });

    // Calculate SLA metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentShipments = shipments.filter(
      (s) => new Date(s.createdAt) >= thirtyDaysAgo
    );

    // Status distribution
    const statusCounts = {
      total: shipments.length,
      booked: shipments.filter((s) => s.status === "BOOKED").length,
      inHub: shipments.filter((s) => s.status === "IN_HUB").length,
      inTransit: shipments.filter((s) => s.status === "IN_TRANSIT").length,
      outForDelivery: shipments.filter((s) => s.status === "OUT_FOR_DELIVERY").length,
      delivered: shipments.filter((s) => s.status === "DELIVERED").length,
      withPartner: shipments.filter((s) => s.status === "WITH_PARTNER").length,
      failed: shipments.filter((s) => s.status === "FAILED").length,
    };

    // SLA adherence calculation
    const deliveredShipments = shipments.filter((s) => s.status === "DELIVERED");
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;

    for (const shipment of deliveredShipments) {
      const deliveryScans = shipment.scans.filter(
        (scan) => scan.scanType === "DELIVERED" || scan.scanType === "POD_CAPTURED"
      );
      if (deliveryScans.length > 0) {
        const deliveryTime = new Date(deliveryScans[0].scanTime);
        const expectedDate = shipment.expectedDeliveryDate;
        if (expectedDate && deliveryTime <= new Date(expectedDate)) {
          onTimeDeliveries++;
        } else {
          lateDeliveries++;
        }
      }
    }

    const slaAdherence =
      deliveredShipments.length > 0
        ? Math.round((onTimeDeliveries / deliveredShipments.length) * 100)
        : 100;

    // Average TAT calculation
    let totalTat = 0;
    let tatCount = 0;

    for (const shipment of deliveredShipments) {
      const deliveryScans = shipment.scans.filter(
        (scan) => scan.scanType === "DELIVERED" || scan.scanType === "POD_CAPTURED"
      );
      if (deliveryScans.length > 0) {
        const deliveryTime = new Date(deliveryScans[0].scanTime);
        const bookingTime = new Date(shipment.createdAt);
        const tatDays = Math.ceil(
          (deliveryTime.getTime() - bookingTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalTat += tatDays;
        tatCount++;
      }
    }

    const avgTat = tatCount > 0 ? (totalTat / tatCount).toFixed(1) : "N/A";

    // Zone-wise breakdown
    const zoneBreakdown: Record<string, { total: number; delivered: number; onTime: number }> = {};

    for (const shipment of shipments) {
      // Extract zone from destination - simplified
      const zone = "NATIONAL"; // Default, would be calculated from destination
      if (!zoneBreakdown[zone]) {
        zoneBreakdown[zone] = { total: 0, delivered: 0, onTime: 0 };
      }
      zoneBreakdown[zone].total++;
      if (shipment.status === "DELIVERED") {
        zoneBreakdown[zone].delivered++;
      }
    }

    // Recent activity
    const recentActivity = shipments
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        awbNumber: s.awbNumber,
        status: s.status,
        origin: s.originCity,
        destination: s.destinationCity,
        updatedAt: s.updatedAt,
        expectedDeliveryDate: s.expectedDeliveryDate,
      }));

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthShipments = shipments.filter((s) => {
        const created = new Date(s.createdAt);
        return created >= monthStart && created <= monthEnd;
      });
      monthlyTrends.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        booked: monthShipments.length,
        delivered: monthShipments.filter((s) => s.status === "DELIVERED").length,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalShipments: statusCounts.total,
          activeShipments: statusCounts.inHub + statusCounts.inTransit + statusCounts.outForDelivery,
          deliveredShipments: statusCounts.delivered,
          pendingPickup: statusCounts.booked,
        },
        sla: {
          adherencePercentage: slaAdherence,
          onTimeDeliveries,
          lateDeliveries,
          averageTat: avgTat,
          targetSla: 95,
        },
        statusBreakdown: statusCounts,
        recentActivity,
        monthlyTrends,
        billing: {
          creditLimit: client.creditLimit,
          currentBalance: client.currentBalance,
          availableCredit: (client.creditLimit || 0) - (client.currentBalance || 0),
        },
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
