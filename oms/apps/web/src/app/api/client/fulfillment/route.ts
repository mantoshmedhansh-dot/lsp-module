import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/fulfillment - Get fulfillment analytics for client portal
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "last7days";

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "last30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last90days":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case "last7days":
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get user's company ID for filtering
    const companyId = session.user.companyId;

    // Fetch all orders with deliveries
    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: startDate },
        ...(companyId ? { Location: { companyId } } : {}),
      },
      include: {
        Location: { select: { name: true } },
        Delivery: {
          include: {
            Transporter: { select: { name: true } },
          },
        },
      },
    });

    // Calculate summary
    const pendingPicklist = orders.filter(
      (o) => o.status === "ALLOCATED" || o.status === "CONFIRMED"
    ).length;
    const picklistedPendingPick = orders.filter(
      (o) => o.status === "PICKLIST_GENERATED"
    ).length;
    const pickedPendingPack = orders.filter(
      (o) => o.status === "PICKED" || o.status === "PICKING"
    ).length;
    const packedPendingManifest = orders.filter(
      (o) => o.status === "PACKED"
    ).length;
    const manifestedPendingShip = orders.filter(
      (o) => o.status === "MANIFESTED"
    ).length;

    // By Channel
    const channelMap = new Map<
      string,
      {
        pendingPicklist: number;
        pendingPick: number;
        pendingPack: number;
        pendingManifest: number;
        pendingShip: number;
        shipByDate: Date | null;
      }
    >();

    orders.forEach((o) => {
      const existing = channelMap.get(o.channel) || {
        pendingPicklist: 0,
        pendingPick: 0,
        pendingPack: 0,
        pendingManifest: 0,
        pendingShip: 0,
        shipByDate: null,
      };

      if (o.status === "ALLOCATED" || o.status === "CONFIRMED") {
        existing.pendingPicklist++;
      } else if (o.status === "PICKLIST_GENERATED") {
        existing.pendingPick++;
      } else if (o.status === "PICKED" || o.status === "PICKING") {
        existing.pendingPack++;
      } else if (o.status === "PACKED") {
        existing.pendingManifest++;
      } else if (o.status === "MANIFESTED") {
        existing.pendingShip++;
      }

      if (o.shipByDate && (!existing.shipByDate || o.shipByDate < existing.shipByDate)) {
        existing.shipByDate = o.shipByDate;
      }

      channelMap.set(o.channel, existing);
    });

    const byChannel = Array.from(channelMap.entries())
      .map(([channel, data]) => {
        const { shipByDate, ...rest } = data;
        return {
          channel,
          shipByDate: shipByDate?.toISOString() || null,
          ...rest,
        };
      })
      .filter(
        (c) =>
          c.pendingPicklist > 0 ||
          c.pendingPick > 0 ||
          c.pendingPack > 0 ||
          c.pendingManifest > 0 ||
          c.pendingShip > 0
      );

    // By Location
    const locationMap = new Map<
      string,
      {
        pendingPicklist: number;
        pendingPick: number;
        pendingPack: number;
        pendingManifest: number;
        pendingShip: number;
      }
    >();

    orders.forEach((o) => {
      const locationName = o.Location.name;
      const existing = locationMap.get(locationName) || {
        pendingPicklist: 0,
        pendingPick: 0,
        pendingPack: 0,
        pendingManifest: 0,
        pendingShip: 0,
      };

      if (o.status === "ALLOCATED" || o.status === "CONFIRMED") {
        existing.pendingPicklist++;
      } else if (o.status === "PICKLIST_GENERATED") {
        existing.pendingPick++;
      } else if (o.status === "PICKED" || o.status === "PICKING") {
        existing.pendingPack++;
      } else if (o.status === "PACKED") {
        existing.pendingManifest++;
      } else if (o.status === "MANIFESTED") {
        existing.pendingShip++;
      }

      locationMap.set(locationName, existing);
    });

    const byLocation = Array.from(locationMap.entries()).map(([location, data]) => ({
      location,
      ...data,
    }));

    // Shipments by Date
    const deliveries = await prisma.delivery.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(companyId ? { Order: { Location: { companyId } } } : {}),
      },
    });

    const shipmentsByDateMap = new Map<
      string,
      { packed: number; shipped: number }
    >();

    deliveries.forEach((d) => {
      if (d.packDate) {
        const dateKey = new Date(d.packDate).toISOString().split("T")[0];
        const existing = shipmentsByDateMap.get(dateKey) || { packed: 0, shipped: 0 };
        existing.packed++;
        shipmentsByDateMap.set(dateKey, existing);
      }
      if (d.shipDate) {
        const dateKey = new Date(d.shipDate).toISOString().split("T")[0];
        const existing = shipmentsByDateMap.get(dateKey) || { packed: 0, shipped: 0 };
        existing.shipped++;
        shipmentsByDateMap.set(dateKey, existing);
      }
    });

    const shipmentsByDate = Array.from(shipmentsByDateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Shipments by Transporter
    const transporterMap = new Map<string, number>();
    deliveries.forEach((d) => {
      const order = orders.find((o) => o.Delivery.some((del) => del.id === d.id));
      if (order) {
        const delivery = order.Delivery.find((del) => del.id === d.id);
        if (delivery?.Transporter) {
          const name = delivery.Transporter.name;
          transporterMap.set(name, (transporterMap.get(name) || 0) + 1);
        }
      }
    });

    const shipmentsByTransporter = Array.from(transporterMap.entries())
      .map(([transporter, count]) => ({ transporter, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      summary: {
        pendingPicklist,
        picklistedPendingPick,
        pickedPendingPack,
        packedPendingManifest,
        manifestedPendingShip,
      },
      byChannel,
      byLocation,
      shipmentsByDate,
      shipmentsByTransporter,
    });
  } catch (error) {
    console.error("Error fetching fulfillment data:", error);
    return NextResponse.json(
      { error: "Failed to fetch fulfillment data" },
      { status: 500 }
    );
  }
}
