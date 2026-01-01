import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

/**
 * Shipment Scanning API
 *
 * Scan types:
 * - PICKUP_SCAN: When shipment is picked up from shipper
 * - INSCAN: When shipment arrives at a hub
 * - OUTSCAN: When shipment leaves a hub
 * - LOAD_SCAN: When loaded onto a vehicle/trip
 * - UNLOAD_SCAN: When unloaded from a vehicle/trip
 * - HANDOVER_SCAN: When handed over to partner
 * - OFD_SCAN: Out for delivery scan
 * - DELIVERY_SCAN: Delivered to consignee
 * - RTO_SCAN: Return to origin initiated
 */

type ScanType =
  | "PICKUP_SCAN"
  | "INSCAN"
  | "OUTSCAN"
  | "LOAD_SCAN"
  | "UNLOAD_SCAN"
  | "HANDOVER_SCAN"
  | "OFD_SCAN"
  | "DELIVERY_SCAN"
  | "RTO_SCAN";

const SCAN_STATUS_MAP: Record<ScanType, string> = {
  PICKUP_SCAN: "PICKED_UP",
  INSCAN: "IN_HUB",
  OUTSCAN: "IN_TRANSIT",
  LOAD_SCAN: "LOADED",
  UNLOAD_SCAN: "IN_HUB",
  HANDOVER_SCAN: "WITH_PARTNER",
  OFD_SCAN: "OUT_FOR_DELIVERY",
  DELIVERY_SCAN: "DELIVERED",
  RTO_SCAN: "RTO_INITIATED",
};

const SCAN_EVENT_TEXT: Record<ScanType, string> = {
  PICKUP_SCAN: "Shipment picked up from shipper",
  INSCAN: "Shipment arrived at hub",
  OUTSCAN: "Shipment dispatched from hub",
  LOAD_SCAN: "Shipment loaded on vehicle",
  UNLOAD_SCAN: "Shipment unloaded at hub",
  HANDOVER_SCAN: "Shipment handed over to partner",
  OFD_SCAN: "Shipment out for delivery",
  DELIVERY_SCAN: "Shipment delivered successfully",
  RTO_SCAN: "Return to origin initiated",
};

// POST /api/shipments/[shipmentId]/scan - Record a scan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const { shipmentId } = await params;
    const body = await request.json();

    const {
      scanType,
      hubId,
      tripId,
      consignmentId,
      scannedBy,
      latitude,
      longitude,
      remarks,
      podImage,
      receiverName,
      receiverPhone,
    } = body;

    // Validate scan type
    if (!scanType || !SCAN_STATUS_MAP[scanType as ScanType]) {
      return NextResponse.json(
        { success: false, error: "Invalid scan type" },
        { status: 400 }
      );
    }

    // Find shipment by ID or AWB
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [{ id: shipmentId }, { awbNumber: shipmentId }],
      },
      include: {
        legs: { orderBy: { legIndex: "asc" } },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Validate hub exists if provided
    let hub = null;
    if (hubId) {
      hub = await prisma.hub.findUnique({ where: { id: hubId } });
      if (!hub) {
        return NextResponse.json(
          { success: false, error: "Hub not found" },
          { status: 404 }
        );
      }
    }

    // Get location string
    let location = "";
    if (hub) {
      location = `${hub.name}, ${hub.city}`;
    } else if (latitude && longitude) {
      location = `${latitude}, ${longitude}`;
    }

    // Create scan record
    const scan = await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        scanType,
        scanCode: shipment.awbNumber,
        hubId,
        tripId,
        consignmentId,
        scannedBy: scannedBy || "SYSTEM",
        scanTime: new Date(),
        latitude,
        longitude,
        location,
        remarks,
        podImage,
        receiverName,
        receiverPhone,
      },
    });

    // Update shipment status and current hub
    const updateData: any = {
      status: SCAN_STATUS_MAP[scanType as ScanType],
    };

    if (hubId) {
      updateData.currentHubId = hubId;
    }

    // Handle specific scan types
    if (scanType === "HANDOVER_SCAN") {
      updateData.handedOverToPartner = true;
      updateData.partnerHandoverTime = new Date();
    }

    if (scanType === "DELIVERY_SCAN") {
      updateData.deliveredAt = new Date();
      updateData.podReceiverName = receiverName;
      updateData.podReceiverPhone = receiverPhone;
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    // Update shipment leg if applicable
    if (hubId && shipment.legs.length > 0) {
      const currentLeg = shipment.legs.find(
        (leg) =>
          leg.status === "IN_TRANSIT" ||
          (leg.status === "PENDING" && leg.fromHubId === hubId)
      );

      if (currentLeg) {
        if (scanType === "INSCAN" && currentLeg.toHubId === hubId) {
          // Arrived at destination hub for this leg
          await prisma.shipmentLeg.update({
            where: { id: currentLeg.id },
            data: {
              status: "COMPLETED",
              actualArrivalTime: new Date(),
              unloadScanBy: scannedBy,
            },
          });
        } else if (scanType === "OUTSCAN" && currentLeg.fromHubId === hubId) {
          // Departed from origin hub for this leg
          await prisma.shipmentLeg.update({
            where: { id: currentLeg.id },
            data: {
              status: "IN_TRANSIT",
              actualDepartureTime: new Date(),
              loadScanBy: scannedBy,
            },
          });
        }
      }
    }

    // Create shipment event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: scanType,
        status: SCAN_STATUS_MAP[scanType as ScanType],
        statusText: SCAN_EVENT_TEXT[scanType as ScanType],
        location,
        hubId,
        source: "HUB_SCAN",
        eventTime: new Date(),
        metadata: JSON.stringify({
          scannedBy,
          tripId,
          consignmentId,
          remarks,
        }),
      },
    });

    // If this is a consignment scan, update consignment shipment count
    if (consignmentId && scanType === "LOAD_SCAN") {
      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          shipmentCount: { increment: 1 },
        },
      });

      // Also associate shipment with consignment
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { consignmentId },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        scan,
        newStatus: SCAN_STATUS_MAP[scanType as ScanType],
        message: SCAN_EVENT_TEXT[scanType as ScanType],
      },
    });
  } catch (error) {
    console.error("Error recording scan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record scan" },
      { status: 500 }
    );
  }
}

// GET /api/shipments/[shipmentId]/scan - Get scan history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const { shipmentId } = await params;

    // Find shipment
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [{ id: shipmentId }, { awbNumber: shipmentId }],
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    const scans = await prisma.shipmentScan.findMany({
      where: { shipmentId: shipment.id },
      orderBy: { scanTime: "desc" },
    });

    // Enrich with hub details
    const hubIds = [...new Set(scans.map((s) => s.hubId).filter(Boolean))];
    const hubs = await prisma.hub.findMany({
      where: { id: { in: hubIds as string[] } },
      select: { id: true, code: true, name: true, city: true },
    });
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    const enrichedScans = scans.map((scan) => ({
      ...scan,
      hub: scan.hubId ? hubMap.get(scan.hubId) : null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedScans,
    });
  } catch (error) {
    console.error("Error fetching scans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scans" },
      { status: 500 }
    );
  }
}
