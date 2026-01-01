import { prisma } from "@cjdquick/database";

interface AlertInput {
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  shipmentId?: string;
  tripId?: string;
  hubId?: string;
  metrics?: Record<string, any>;
  expiresInMinutes?: number;
}

/**
 * Create a control tower alert
 */
export async function createAlert(input: AlertInput): Promise<string> {
  const expiresAt = input.expiresInMinutes
    ? new Date(Date.now() + input.expiresInMinutes * 60 * 1000)
    : null;

  const alert = await prisma.controlTowerAlert.create({
    data: {
      alertType: input.alertType,
      severity: input.severity,
      title: input.title,
      description: input.description,
      shipmentId: input.shipmentId,
      tripId: input.tripId,
      hubId: input.hubId,
      metrics: input.metrics ? JSON.stringify(input.metrics) : null,
      expiresAt,
    },
  });

  return alert.id;
}

/**
 * Check for and create SLA breach alerts
 */
export async function generateSLABreachAlerts(): Promise<number> {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Find shipments about to breach SLA
  const atRiskShipments = await prisma.shipment.findMany({
    where: {
      status: {
        notIn: ["DELIVERED", "CANCELLED", "RETURNED", "RTO_DELIVERED"],
      },
      expectedDeliveryDate: {
        lte: twoHoursFromNow,
        gte: now,
      },
    },
    select: {
      id: true,
      awbNumber: true,
      consigneeName: true,
      consigneeCity: true,
      expectedDeliveryDate: true,
      status: true,
    },
    take: 50,
  });

  let alertsCreated = 0;

  for (const shipment of atRiskShipments) {
    // Check if alert already exists for this shipment
    const existingAlert = await prisma.controlTowerAlert.findFirst({
      where: {
        shipmentId: shipment.id,
        alertType: "SLA_BREACH",
        status: "ACTIVE",
      },
    });

    if (!existingAlert && shipment.expectedDeliveryDate) {
      const hoursRemaining = (shipment.expectedDeliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      const severity = hoursRemaining < 1 ? "CRITICAL" : "HIGH";

      await createAlert({
        alertType: "SLA_BREACH",
        severity,
        title: `SLA Breach Risk: ${shipment.awbNumber}`,
        description: `Shipment to ${shipment.consigneeName || "Unknown"} in ${shipment.consigneeCity || "Unknown"} may miss SLA. Only ${hoursRemaining.toFixed(1)} hours remaining.`,
        shipmentId: shipment.id,
        metrics: {
          hoursRemaining,
          expectedDelivery: shipment.expectedDeliveryDate.toISOString(),
          currentStatus: shipment.status,
        },
        expiresInMinutes: 240, // 4 hours
      });
      alertsCreated++;
    }
  }

  return alertsCreated;
}

/**
 * Check for and create hub congestion alerts
 */
export async function generateHubCongestionAlerts(): Promise<number> {
  // Get hub capacities and shipment counts
  const hubs = await prisma.hub.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      sortingCapacity: true,
    },
  });

  const shipmentCounts = await prisma.shipment.groupBy({
    by: ["currentHubId"],
    where: {
      currentHubId: { not: null },
      status: {
        in: ["IN_HUB", "RECEIVED_AT_ORIGIN_HUB", "IN_SORTING", "SORTED", "CONSOLIDATED"],
      },
    },
    _count: { id: true },
  });

  const countMap = new Map(
    shipmentCounts.map((sc) => [sc.currentHubId, sc._count.id])
  );

  let alertsCreated = 0;

  for (const hub of hubs) {
    const shipmentsInHub = countMap.get(hub.id) || 0;
    const capacity = hub.sortingCapacity || 500;
    const utilizationPercent = (shipmentsInHub / capacity) * 100;

    // Only alert if utilization > 85%
    if (utilizationPercent > 85) {
      // Check if alert already exists
      const existingAlert = await prisma.controlTowerAlert.findFirst({
        where: {
          hubId: hub.id,
          alertType: "HUB_CONGESTION",
          status: "ACTIVE",
        },
      });

      if (!existingAlert) {
        const severity = utilizationPercent > 95 ? "CRITICAL" : "HIGH";

        await createAlert({
          alertType: "HUB_CONGESTION",
          severity,
          title: `Hub Congestion: ${hub.code}`,
          description: `${hub.name} is at ${Math.round(utilizationPercent)}% capacity with ${shipmentsInHub} shipments.`,
          hubId: hub.id,
          metrics: {
            utilizationPercent,
            shipmentsInHub,
            capacity,
          },
          expiresInMinutes: 60, // 1 hour
        });
        alertsCreated++;
      }
    }
  }

  return alertsCreated;
}

/**
 * Check for stuck shipments (no scan in 24+ hours)
 */
export async function generateStuckShipmentAlerts(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find shipments in transit with no recent scans
  const stuckShipments = await prisma.shipment.findMany({
    where: {
      status: {
        in: ["IN_TRANSIT", "WITH_PARTNER", "PARTNER_IN_TRANSIT"],
      },
      updatedAt: {
        lte: twentyFourHoursAgo,
      },
    },
    select: {
      id: true,
      awbNumber: true,
      status: true,
      updatedAt: true,
      currentHub: {
        select: { code: true, name: true },
      },
    },
    take: 50,
  });

  let alertsCreated = 0;

  for (const shipment of stuckShipments) {
    // Check if alert already exists
    const existingAlert = await prisma.controlTowerAlert.findFirst({
      where: {
        shipmentId: shipment.id,
        alertType: "SHIPMENT_STUCK",
        status: "ACTIVE",
      },
    });

    if (!existingAlert) {
      const hoursStuck = (Date.now() - shipment.updatedAt.getTime()) / (1000 * 60 * 60);
      const severity = hoursStuck > 48 ? "HIGH" : "MEDIUM";

      await createAlert({
        alertType: "SHIPMENT_STUCK",
        severity,
        title: `Shipment Stuck: ${shipment.awbNumber}`,
        description: `No movement for ${Math.round(hoursStuck)} hours. Last location: ${shipment.currentHub?.name || "Unknown"}`,
        shipmentId: shipment.id,
        metrics: {
          hoursStuck,
          lastStatus: shipment.status,
          lastUpdate: shipment.updatedAt.toISOString(),
        },
        expiresInMinutes: 480, // 8 hours
      });
      alertsCreated++;
    }
  }

  return alertsCreated;
}

/**
 * Run all alert generators
 * This should be called periodically (e.g., every 15 minutes via cron)
 */
export async function runAlertGenerators(): Promise<{
  slaBreaches: number;
  hubCongestion: number;
  stuckShipments: number;
}> {
  const [slaBreaches, hubCongestion, stuckShipments] = await Promise.all([
    generateSLABreachAlerts(),
    generateHubCongestionAlerts(),
    generateStuckShipmentAlerts(),
  ]);

  return {
    slaBreaches,
    hubCongestion,
    stuckShipments,
  };
}

/**
 * Cleanup expired alerts
 */
export async function cleanupExpiredAlerts(): Promise<number> {
  const result = await prisma.controlTowerAlert.updateMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
      status: "ACTIVE",
    },
    data: {
      status: "EXPIRED",
    },
  });

  return result.count;
}
