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

// Allowed scan types
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

    if (!body.awbNumber) {
      return NextResponse.json(
        { success: false, error: "AWB number is required" },
        { status: 400 }
      );
    }

    if (!body.scanType || !SCAN_TYPES.includes(body.scanType)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan type" },
        { status: 400 }
      );
    }

    // Find shipment by AWB number
    const shipment = await prisma.shipment.findUnique({
      where: { awbNumber: body.awbNumber },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Determine the new status based on scan type
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

    const newStatus = statusMap[body.scanType] || shipment.status;

    // Create the scan record
    const scan = await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        scanType: body.scanType,
        scanCode: body.awbNumber,
        hubId: body.hubId || user.hubId,
        tripId: body.tripId,
        consignmentId: body.consignmentId,
        scannedBy: user.id,
        scannedByName: user.name,
        latitude: body.latitude,
        longitude: body.longitude,
        remarks: body.remarks,
        scanTime: new Date(),
      },
    });

    // Update shipment status
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: newStatus,
        currentHubId: body.hubId || user.hubId,
      },
    });

    // Create shipment event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: body.scanType,
        status: newStatus,
        statusText: `${body.scanType.replace(/_/g, " ")} completed`,
        location: body.location,
        source: "MOBILE_APP",
        eventTime: new Date(),
        remarks: body.remarks,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        scan,
        shipment: {
          id: shipment.id,
          awbNumber: shipment.awbNumber,
          status: newStatus,
        },
      },
      message: `${body.scanType.replace(/_/g, " ")} successful`,
    });
  } catch (error) {
    console.error("Error processing scan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process scan" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const scanType = searchParams.get("scanType");
    const hubId = searchParams.get("hubId");

    const where: any = {
      scannedBy: user.id,
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.scanTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (scanType) {
      where.scanType = scanType;
    }

    if (hubId) {
      where.hubId = hubId;
    }

    const scans = await prisma.shipmentScan.findMany({
      where,
      orderBy: { scanTime: "desc" },
      take: 100,
      include: {
        shipment: {
          select: {
            awbNumber: true,
            status: true,
            consigneeName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error("Error fetching scans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scans" },
      { status: 500 }
    );
  }
}
