import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

/**
 * Partner Status Updates API
 *
 * Receives status updates from partner networks to maintain
 * end-to-end visibility on CJDarcl Quick platform
 *
 * Partners can push:
 * - Pickup confirmation
 * - In-transit updates
 * - Out for delivery
 * - Delivery confirmation with POD
 * - Delivery failures with reason
 */

interface PartnerUpdate {
  partnerCode: string;
  partnerAwb?: string;
  cjdAwb?: string;
  eventType: string;
  eventTime: string;
  location?: string;
  status?: string;
  statusText?: string;
  // For delivery
  receiverName?: string;
  receiverPhone?: string;
  podImage?: string;
  // For failure
  failureReason?: string;
  // For OTP delivery
  otpVerified?: boolean;
}

const PARTNER_STATUS_MAP: Record<string, string> = {
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_HUB: "IN_HUB",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  RTO_INITIATED: "RTO_INITIATED",
  RTO_IN_TRANSIT: "RTO_IN_TRANSIT",
  RTO_DELIVERED: "RTO_DELIVERED",
};

// POST /api/partner-updates - Receive status update from partner
export async function POST(request: NextRequest) {
  try {
    const body: PartnerUpdate = await request.json();

    const {
      partnerCode,
      partnerAwb,
      cjdAwb,
      eventType,
      eventTime,
      location,
      status,
      statusText,
      receiverName,
      receiverPhone,
      podImage,
      failureReason,
      otpVerified,
    } = body;

    // Validate partner
    const partner = await prisma.partner.findUnique({
      where: { code: partnerCode },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: "Invalid partner code" },
        { status: 401 }
      );
    }

    // Find shipment by partner AWB or CJD AWB
    let shipment;
    if (cjdAwb) {
      shipment = await prisma.shipment.findFirst({
        where: { awbNumber: cjdAwb, partnerId: partner.id },
      });
    } else if (partnerAwb) {
      shipment = await prisma.shipment.findFirst({
        where: { partnerAwb, partnerId: partner.id },
      });
    }

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Map partner status to our status
    const mappedStatus = PARTNER_STATUS_MAP[eventType] || status || shipment.status;

    // Create partner scan/event record
    await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        scanType: `PARTNER_${eventType}`,
        scanCode: partnerAwb || shipment.awbNumber,
        scannedBy: `PARTNER_${partnerCode}`,
        scanTime: new Date(eventTime),
        location,
        remarks: statusText ? `${statusText}${receiverName ? ` (Receiver: ${receiverName})` : ""}` : null,
      },
    });

    // Create shipment event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: `PARTNER_${eventType}`,
        status: mappedStatus,
        statusText: statusText || `Partner update: ${eventType}`,
        location,
        source: "PARTNER_PUSH",
        eventTime: new Date(eventTime),
        remarks: `Partner: ${partnerCode}, AWB: ${partnerAwb || "N/A"}${failureReason ? `, Reason: ${failureReason}` : ""}`,
      },
    });

    // Update shipment status
    const updateData: any = { status: mappedStatus };

    if (eventType === "DELIVERED") {
      updateData.deliveredAt = new Date(eventTime);
      updateData.podReceiverName = receiverName;
      updateData.podReceiverPhone = receiverPhone;
      if (podImage) updateData.podImage = podImage;
    }

    if (eventType === "DELIVERY_FAILED") {
      updateData.lastFailureReason = failureReason;
      updateData.deliveryAttempts = { increment: 1 };
    }

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        awbNumber: shipment.awbNumber,
        newStatus: mappedStatus,
        message: "Status updated successfully",
      },
    });
  } catch (error) {
    console.error("Error processing partner update:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process update" },
      { status: 500 }
    );
  }
}

// GET /api/partner-updates - Get partner update log for a shipment
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const awbNumber = searchParams.get("awb");
    const partnerAwb = searchParams.get("partnerAwb");

    if (!awbNumber && !partnerAwb) {
      return NextResponse.json(
        { success: false, error: "AWB number required" },
        { status: 400 }
      );
    }

    // Find shipment
    const shipment = await prisma.shipment.findFirst({
      where: awbNumber ? { awbNumber } : { partnerAwb: partnerAwb || undefined },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Get partner events
    const events = await prisma.shipmentEvent.findMany({
      where: {
        shipmentId: shipment.id,
        source: "PARTNER_PUSH",
      },
      orderBy: { eventTime: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        awbNumber: shipment.awbNumber,
        partnerAwb: shipment.partnerAwb,
        events,
      },
    });
  } catch (error) {
    console.error("Error fetching partner updates:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
