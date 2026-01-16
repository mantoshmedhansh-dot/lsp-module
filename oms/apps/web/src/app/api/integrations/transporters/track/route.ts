import { NextRequest, NextResponse } from "next/server";
import { prisma, DeliveryStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/integrations/transporters/track - Get tracking info
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deliveryId = searchParams.get("deliveryId");
    const awbNo = searchParams.get("awbNo");

    if (!deliveryId && !awbNo) {
      return NextResponse.json(
        { error: "Delivery ID or AWB number is required" },
        { status: 400 }
      );
    }

    // Find delivery
    const delivery = await prisma.delivery.findFirst({
      where: deliveryId ? { id: deliveryId } : { awbNo: awbNo! },
      include: {
        Transporter: true,
        Order: {
          select: {
            id: true,
            orderNo: true,
            customerName: true,
            customerPhone: true,
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    if (!delivery.awbNo) {
      return NextResponse.json(
        { error: "AWB number not assigned yet" },
        { status: 400 }
      );
    }

    const transporter = delivery.Transporter;

    if (!transporter?.apiEnabled || !transporter?.apiConfig) {
      // Return stored tracking info if API not configured
      return NextResponse.json({
        awbNo: delivery.awbNo,
        status: delivery.status,
        trackingUrl: delivery.trackingUrl,
        events: [],
        lastUpdated: delivery.updatedAt,
      });
    }

    const apiConfig = transporter.apiConfig as {
      apiKey?: string;
      email?: string;
      password?: string;
      apiEndpoint?: string;
    };

    if (!apiConfig.apiEndpoint) {
      return NextResponse.json({
        awbNo: delivery.awbNo,
        status: delivery.status,
        trackingUrl: delivery.trackingUrl,
        events: [],
        lastUpdated: delivery.updatedAt,
      });
    }

    // Fetch tracking from transporter API
    let trackingData: TrackingResult;

    try {
      switch (transporter.code.toUpperCase()) {
        case "SHIPROCKET":
          trackingData = await getShiprocketTracking(
            apiConfig,
            apiConfig.apiEndpoint!,
            delivery.awbNo
          );
          break;

        case "DELHIVERY":
          trackingData = await getDelhiveryTracking(
            apiConfig,
            apiConfig.apiEndpoint!,
            delivery.awbNo
          );
          break;

        default:
          return NextResponse.json({
            awbNo: delivery.awbNo,
            status: delivery.status,
            trackingUrl: delivery.trackingUrl,
            events: [],
            lastUpdated: delivery.updatedAt,
            message: "Live tracking not available for this transporter",
          });
      }
    } catch (trackError) {
      console.error("Tracking fetch error:", trackError);
      return NextResponse.json({
        awbNo: delivery.awbNo,
        status: delivery.status,
        trackingUrl: delivery.trackingUrl,
        events: [],
        lastUpdated: delivery.updatedAt,
        error: "Failed to fetch live tracking",
      });
    }

    // Update delivery with latest tracking
    const newStatus = mapTrackingStatus(trackingData.status);

    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Only set deliveredAt if delivered
    if (newStatus === "DELIVERED") {
      updateData.shipDate = new Date();
    }

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: updateData,
    });

    // Update order status if delivered
    if (newStatus === "DELIVERED") {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: "DELIVERED" },
      });
    }

    return NextResponse.json({
      awbNo: delivery.awbNo,
      status: newStatus,
      trackingUrl: delivery.trackingUrl,
      currentLocation: trackingData.currentLocation,
      expectedDelivery: trackingData.expectedDelivery,
      events: trackingData.events,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Error fetching tracking:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracking" },
      { status: 500 }
    );
  }
}

// POST /api/integrations/transporters/track - Bulk tracking update
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { deliveryIds, transporterId } = body;

    if (!deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return NextResponse.json(
        { error: "Delivery IDs are required" },
        { status: 400 }
      );
    }

    // Get deliveries
    const where: Record<string, unknown> = {
      id: { in: deliveryIds },
      awbNo: { not: null },
    };

    if (transporterId) {
      where.transporterId = transporterId;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        Transporter: true,
      },
    });

    const results: {
      deliveryId: string;
      awbNo: string;
      status: string;
      success: boolean;
      error?: string;
    }[] = [];

    // Group by transporter for efficient API calls
    const byTransporter = new Map<string, typeof deliveries>();
    for (const delivery of deliveries) {
      if (!delivery.Transporter) continue;
      const key = delivery.Transporter.id;
      const existing = byTransporter.get(key) || [];
      existing.push(delivery);
      byTransporter.set(key, existing);
    }

    for (const [, transporterDeliveries] of byTransporter) {
      const transporter = transporterDeliveries[0].Transporter!;

      if (!transporter.apiEnabled || !transporter.apiConfig) {
        for (const d of transporterDeliveries) {
          results.push({
            deliveryId: d.id,
            awbNo: d.awbNo!,
            status: d.status,
            success: false,
            error: "API not configured",
          });
        }
        continue;
      }

      const apiConfig = transporter.apiConfig as {
        apiKey?: string;
        email?: string;
        password?: string;
        apiEndpoint?: string;
      };

      if (!apiConfig.apiEndpoint) {
        for (const d of transporterDeliveries) {
          results.push({
            deliveryId: d.id,
            awbNo: d.awbNo!,
            status: d.status,
            success: false,
            error: "API endpoint not configured",
          });
        }
        continue;
      }

      // Fetch tracking for all AWBs
      const awbNumbers = transporterDeliveries.map((d) => d.awbNo!);

      try {
        let trackingResults: Map<string, TrackingResult>;

        switch (transporter.code.toUpperCase()) {
          case "SHIPROCKET":
            trackingResults = await getShiprocketBulkTracking(
              apiConfig,
              apiConfig.apiEndpoint!,
              awbNumbers
            );
            break;

          case "DELHIVERY":
            trackingResults = await getDelhiveryBulkTracking(
              apiConfig,
              apiConfig.apiEndpoint!,
              awbNumbers
            );
            break;

          default:
            for (const d of transporterDeliveries) {
              results.push({
                deliveryId: d.id,
                awbNo: d.awbNo!,
                status: d.status,
                success: false,
                error: "Transporter not supported",
              });
            }
            continue;
        }

        // Update each delivery
        for (const delivery of transporterDeliveries) {
          const tracking = trackingResults.get(delivery.awbNo!);
          if (!tracking) {
            results.push({
              deliveryId: delivery.id,
              awbNo: delivery.awbNo!,
              status: delivery.status,
              success: false,
              error: "No tracking data",
            });
            continue;
          }

          const newStatus = mapTrackingStatus(tracking.status);

          const updateData: Record<string, unknown> = {
            status: newStatus,
          };

          if (newStatus === "DELIVERED") {
            updateData.shipDate = new Date();
          }

          await prisma.delivery.update({
            where: { id: delivery.id },
            data: updateData,
          });

          if (newStatus === "DELIVERED") {
            await prisma.order.update({
              where: { id: delivery.orderId },
              data: { status: "DELIVERED" },
            });
          }

          results.push({
            deliveryId: delivery.id,
            awbNo: delivery.awbNo!,
            status: newStatus,
            success: true,
          });
        }
      } catch (err) {
        for (const d of transporterDeliveries) {
          results.push({
            deliveryId: d.id,
            awbNo: d.awbNo!,
            status: d.status,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      total: deliveryIds.length,
      updated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error("Error in bulk tracking:", error);
    return NextResponse.json(
      { error: "Failed to update tracking" },
      { status: 500 }
    );
  }
}

// Types
interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

interface TrackingResult {
  status: string;
  currentLocation?: string;
  expectedDelivery?: string;
  events: TrackingEvent[];
}

// Helper functions
// DeliveryStatus: PENDING, PACKED, MANIFESTED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED
function mapTrackingStatus(apiStatus: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
    // Shiprocket statuses
    PICKUP_SCHEDULED: "MANIFESTED",
    PICKUP_GENERATED: "MANIFESTED",
    OUT_FOR_PICKUP: "MANIFESTED",
    PICKED_UP: "SHIPPED",
    IN_TRANSIT: "IN_TRANSIT",
    REACHED_DESTINATION: "IN_TRANSIT",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    RTO_INITIATED: "RTO_INITIATED",
    RTO_IN_TRANSIT: "RTO_IN_TRANSIT",
    RTO_DELIVERED: "RTO_DELIVERED",
    CANCELLED: "CANCELLED",

    // Delhivery statuses
    Manifested: "MANIFESTED",
    "In Transit": "IN_TRANSIT",
    "Reached Destination Hub": "IN_TRANSIT",
    "Out for Delivery": "OUT_FOR_DELIVERY",
    Delivered: "DELIVERED",
    "RTO Initiated": "RTO_INITIATED",
    "RTO In-Transit": "RTO_IN_TRANSIT",
    "RTO Delivered": "RTO_DELIVERED",
    Cancelled: "CANCELLED",
  };

  return statusMap[apiStatus] || "IN_TRANSIT";
}

async function getShiprocketTracking(
  credentials: { email?: string; password?: string },
  apiEndpoint: string,
  awbNo: string
): Promise<TrackingResult> {
  // Authenticate
  const authResponse = await fetch(`${apiEndpoint}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error("Failed to authenticate with Shiprocket");
  }

  const { token } = await authResponse.json();

  // Get tracking
  const trackResponse = await fetch(
    `${apiEndpoint}/courier/track/awb/${awbNo}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!trackResponse.ok) {
    throw new Error("Failed to fetch tracking");
  }

  const data = await trackResponse.json();
  const tracking = data.tracking_data;

  return {
    status: tracking.shipment_status || "IN_TRANSIT",
    currentLocation: tracking.current_status || "",
    expectedDelivery: tracking.etd,
    events: (tracking.shipment_track || []).map((e: { date: string; status: string; location: string; activity: string }) => ({
      timestamp: e.date,
      status: e.status,
      location: e.location,
      description: e.activity,
    })),
  };
}

async function getShiprocketBulkTracking(
  credentials: { email?: string; password?: string },
  apiEndpoint: string,
  awbNumbers: string[]
): Promise<Map<string, TrackingResult>> {
  const results = new Map<string, TrackingResult>();

  // Authenticate once
  const authResponse = await fetch(`${apiEndpoint}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error("Failed to authenticate");
  }

  const { token } = await authResponse.json();

  // Fetch tracking for each (Shiprocket doesn't have bulk tracking)
  for (const awbNo of awbNumbers) {
    try {
      const trackResponse = await fetch(
        `${apiEndpoint}/courier/track/awb/${awbNo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (trackResponse.ok) {
        const data = await trackResponse.json();
        const tracking = data.tracking_data;

        results.set(awbNo, {
          status: tracking.shipment_status || "IN_TRANSIT",
          currentLocation: tracking.current_status,
          expectedDelivery: tracking.etd,
          events: (tracking.shipment_track || []).map((e: { date: string; status: string; location: string; activity: string }) => ({
            timestamp: e.date,
            status: e.status,
            location: e.location,
            description: e.activity,
          })),
        });
      }
    } catch {
      // Skip failed individual tracking
    }
  }

  return results;
}

async function getDelhiveryTracking(
  credentials: { apiKey?: string },
  apiEndpoint: string,
  awbNo: string
): Promise<TrackingResult> {
  const response = await fetch(
    `${apiEndpoint}/api/v1/packages/json/?waybill=${awbNo}`,
    {
      headers: { Authorization: `Token ${credentials.apiKey}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tracking");
  }

  const data = await response.json();
  const shipment = data.ShipmentData?.[0]?.Shipment;

  if (!shipment) {
    throw new Error("No shipment data");
  }

  return {
    status: shipment.Status?.Status || "IN_TRANSIT",
    currentLocation: shipment.Status?.StatusLocation,
    expectedDelivery: shipment.ExpectedDeliveryDate,
    events: (shipment.Scans || []).map((s: { ScanDetail: { ScanDateTime: string; Scan: string; ScannedLocation: string; Instructions: string } }) => ({
      timestamp: s.ScanDetail.ScanDateTime,
      status: s.ScanDetail.Scan,
      location: s.ScanDetail.ScannedLocation,
      description: s.ScanDetail.Instructions,
    })),
  };
}

async function getDelhiveryBulkTracking(
  credentials: { apiKey?: string },
  apiEndpoint: string,
  awbNumbers: string[]
): Promise<Map<string, TrackingResult>> {
  const results = new Map<string, TrackingResult>();

  // Delhivery supports comma-separated waybills
  const waybills = awbNumbers.join(",");
  const response = await fetch(
    `${apiEndpoint}/api/v1/packages/json/?waybill=${waybills}`,
    {
      headers: { Authorization: `Token ${credentials.apiKey}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tracking");
  }

  const data = await response.json();

  for (const item of data.ShipmentData || []) {
    const shipment = item.Shipment;
    if (!shipment?.AWB) continue;

    results.set(shipment.AWB, {
      status: shipment.Status?.Status || "IN_TRANSIT",
      currentLocation: shipment.Status?.StatusLocation,
      expectedDelivery: shipment.ExpectedDeliveryDate,
      events: (shipment.Scans || []).map((s: { ScanDetail: { ScanDateTime: string; Scan: string; ScannedLocation: string; Instructions: string } }) => ({
        timestamp: s.ScanDetail.ScanDateTime,
        status: s.ScanDetail.Scan,
        location: s.ScanDetail.ScannedLocation,
        description: s.ScanDetail.Instructions,
      })),
    });
  }

  return results;
}
