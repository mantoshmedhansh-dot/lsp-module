import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

/**
 * Bulk Scanning API for Hub Operations
 *
 * Efficiently process multiple shipment scans at once
 */

const SCAN_STATUS_MAP: Record<string, string> = {
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

const SCAN_EVENT_TEXT: Record<string, string> = {
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

interface BulkScanRequest {
  awbNumbers: string[];
  scanType: string;
  hubId: string;
  tripId?: string;
  consignmentId?: string;
  scannedBy: string;
}

// POST /api/shipments/bulk-scan - Scan multiple shipments at once
export async function POST(request: NextRequest) {
  try {
    const body: BulkScanRequest = await request.json();

    const { awbNumbers, scanType, hubId, tripId, consignmentId, scannedBy } =
      body;

    // Validate inputs
    if (!awbNumbers || awbNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No AWB numbers provided" },
        { status: 400 }
      );
    }

    if (!scanType || !SCAN_STATUS_MAP[scanType]) {
      return NextResponse.json(
        { success: false, error: "Invalid scan type" },
        { status: 400 }
      );
    }

    if (!hubId) {
      return NextResponse.json(
        { success: false, error: "Hub ID is required" },
        { status: 400 }
      );
    }

    // Get hub details
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Hub not found" },
        { status: 404 }
      );
    }

    const location = `${hub.name}, ${hub.city}`;
    const scanTime = new Date();

    // Find all shipments
    const shipments = await prisma.shipment.findMany({
      where: {
        awbNumber: { in: awbNumbers },
      },
    });

    const foundAwbs = new Set(shipments.map((s) => s.awbNumber));
    const notFoundAwbs = awbNumbers.filter((awb) => !foundAwbs.has(awb));

    const results: {
      success: { awb: string; status: string }[];
      failed: { awb: string; reason: string }[];
    } = {
      success: [],
      failed: notFoundAwbs.map((awb) => ({ awb, reason: "AWB not found" })),
    };

    // Process each shipment
    for (const shipment of shipments) {
      try {
        // Create scan record
        await prisma.shipmentScan.create({
          data: {
            shipmentId: shipment.id,
            scanType,
            scanCode: shipment.awbNumber,
            hubId,
            tripId,
            consignmentId,
            scannedBy,
            scanTime,
            location,
          },
        });

        // Update shipment
        const updateData: any = {
          status: SCAN_STATUS_MAP[scanType],
          currentHubId: hubId,
        };

        if (scanType === "HANDOVER_SCAN") {
          updateData.handedOverToPartner = true;
          updateData.partnerHandoverTime = scanTime;
        }

        if (consignmentId && scanType === "LOAD_SCAN") {
          updateData.consignmentId = consignmentId;
        }

        await prisma.shipment.update({
          where: { id: shipment.id },
          data: updateData,
        });

        // Create event
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            eventType: scanType,
            status: SCAN_STATUS_MAP[scanType],
            statusText: SCAN_EVENT_TEXT[scanType],
            location,
            hubId,
            source: "BULK_SCAN",
            eventTime: scanTime,
            metadata: JSON.stringify({ scannedBy, tripId, consignmentId }),
          },
        });

        results.success.push({
          awb: shipment.awbNumber,
          status: SCAN_STATUS_MAP[scanType],
        });
      } catch (err) {
        results.failed.push({
          awb: shipment.awbNumber,
          reason: "Processing error",
        });
      }
    }

    // Update consignment shipment count if applicable
    if (consignmentId && scanType === "LOAD_SCAN" && results.success.length > 0) {
      await prisma.consignment.update({
        where: { id: consignmentId },
        data: {
          shipmentCount: { increment: results.success.length },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalProcessed: awbNumbers.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        results,
      },
    });
  } catch (error) {
    console.error("Error in bulk scan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process bulk scan" },
      { status: 500 }
    );
  }
}
