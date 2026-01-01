import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Helper to verify auth token
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || !session.isActive || new Date() > session.expiresAt) {
    return null;
  }

  return session.user;
}

const SCAN_TYPES = [
  "PICKUP_SCAN",
  "INSCAN",
  "OUTSCAN",
  "LOAD_SCAN",
  "UNLOAD_SCAN",
  "OFD_SCAN",
  "DELIVERY_SCAN",
  "RETURN_SCAN",
  "HANDOVER_SCAN",
];

interface BulkScanItem {
  awbNumber: string;
  scanType: string;
  hubId?: string;
  tripId?: string;
  consignmentId?: string;
}

interface ScanResult {
  awbNumber: string;
  success: boolean;
  error?: string;
  shipmentId?: string;
  newStatus?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.scans || !Array.isArray(body.scans) || body.scans.length === 0) {
      return NextResponse.json(
        { success: false, error: "Scans array is required" },
        { status: 400 }
      );
    }

    if (body.scans.length > 100) {
      return NextResponse.json(
        { success: false, error: "Maximum 100 scans allowed per request" },
        { status: 400 }
      );
    }

    const results: ScanResult[] = [];
    const statusMap: Record<string, string> = {
      PICKUP_SCAN: "PICKED_UP",
      INSCAN: "IN_TRANSIT",
      OUTSCAN: "IN_TRANSIT",
      LOAD_SCAN: "IN_TRANSIT",
      UNLOAD_SCAN: "IN_TRANSIT",
      OFD_SCAN: "OUT_FOR_DELIVERY",
      DELIVERY_SCAN: "DELIVERED",
      RETURN_SCAN: "RETURNED",
      HANDOVER_SCAN: "IN_TRANSIT",
    };

    for (const scan of body.scans as BulkScanItem[]) {
      // Validate scan
      if (!scan.awbNumber) {
        results.push({
          awbNumber: scan.awbNumber || "UNKNOWN",
          success: false,
          error: "AWB number is required",
        });
        continue;
      }

      if (!scan.scanType || !SCAN_TYPES.includes(scan.scanType)) {
        results.push({
          awbNumber: scan.awbNumber,
          success: false,
          error: "Invalid scan type",
        });
        continue;
      }

      try {
        // Find shipment
        const shipment = await prisma.shipment.findUnique({
          where: { awbNumber: scan.awbNumber },
        });

        if (!shipment) {
          results.push({
            awbNumber: scan.awbNumber,
            success: false,
            error: "Shipment not found",
          });
          continue;
        }

        const newStatus = statusMap[scan.scanType] || shipment.status;

        // Create scan record
        await prisma.shipmentScan.create({
          data: {
            shipmentId: shipment.id,
            scanType: scan.scanType,
            scanCode: scan.awbNumber,
            hubId: scan.hubId || user.hubId,
            tripId: scan.tripId,
            consignmentId: scan.consignmentId,
            scannedBy: user.id,
            scannedByName: user.name,
            scanTime: new Date(),
          },
        });

        // Update shipment status
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: newStatus,
            currentHubId: scan.hubId || user.hubId,
          },
        });

        // Create event
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            eventType: scan.scanType,
            status: newStatus,
            statusText: `${scan.scanType.replace(/_/g, " ")} completed`,
            source: "MOBILE_APP",
            eventTime: new Date(),
          },
        });

        results.push({
          awbNumber: scan.awbNumber,
          success: true,
          shipmentId: shipment.id,
          newStatus,
        });
      } catch (error) {
        console.error(`Error processing scan for ${scan.awbNumber}:`, error);
        results.push({
          awbNumber: scan.awbNumber,
          success: false,
          error: "Failed to process scan",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
        },
      },
      message: `Processed ${successCount} of ${results.length} scans successfully`,
    });
  } catch (error) {
    console.error("Error processing bulk scans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process bulk scans" },
      { status: 500 }
    );
  }
}
