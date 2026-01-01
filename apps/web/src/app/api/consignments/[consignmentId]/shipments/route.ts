import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// POST /api/consignments/[consignmentId]/shipments - Add shipments to consignment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> }
) {
  try {
    const { consignmentId } = await params;
    const body = await request.json();

    const { awbNumbers, scannedBy, hubId } = body;

    if (!awbNumbers || awbNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No AWB numbers provided" },
        { status: 400 }
      );
    }

    // Find consignment
    const consignment = await prisma.consignment.findUnique({
      where: { id: consignmentId },
    });

    if (!consignment) {
      return NextResponse.json(
        { success: false, error: "Consignment not found" },
        { status: 404 }
      );
    }

    if (consignment.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: "Consignment is not open for adding shipments" },
        { status: 400 }
      );
    }

    // Find shipments
    const shipments = await prisma.shipment.findMany({
      where: {
        awbNumber: { in: awbNumbers },
        consignmentId: null, // Not already in a consignment
      },
    });

    const foundAwbs = new Set(shipments.map((s) => s.awbNumber));
    const notFoundAwbs = awbNumbers.filter((awb: string) => !foundAwbs.has(awb));

    // Check for shipments already in consignment
    const alreadyAssigned = await prisma.shipment.findMany({
      where: {
        awbNumber: { in: awbNumbers },
        consignmentId: { not: null },
      },
      select: { awbNumber: true, consignmentId: true },
    });

    const results = {
      added: [] as string[],
      notFound: notFoundAwbs,
      alreadyAssigned: alreadyAssigned.map((s) => s.awbNumber),
    };

    // Add shipments to consignment
    const scanTime = new Date();
    let totalWeight = 0;

    for (const shipment of shipments) {
      // Update shipment
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          consignmentId: consignment.id,
          status: "CONSOLIDATED",
        },
      });

      // Create load scan
      await prisma.shipmentScan.create({
        data: {
          shipmentId: shipment.id,
          scanType: "LOAD_SCAN",
          scanCode: shipment.awbNumber,
          hubId: hubId || consignment.originHubId,
          consignmentId: consignment.id,
          scannedBy: scannedBy || "SYSTEM",
          scanTime,
        },
      });

      // Create event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "CONSOLIDATED",
          status: "CONSOLIDATED",
          statusText: `Added to consignment ${consignment.consignmentNumber}`,
          source: "CONSOLIDATION",
          eventTime: scanTime,
          metadata: JSON.stringify({
            consignmentId: consignment.id,
            consignmentNumber: consignment.consignmentNumber,
          }),
        },
      });

      results.added.push(shipment.awbNumber);
      totalWeight += shipment.chargeableWeightKg || 0;
    }

    // Update consignment totals
    await prisma.consignment.update({
      where: { id: consignment.id },
      data: {
        shipmentCount: { increment: results.added.length },
        totalWeightKg: { increment: totalWeight },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        consignmentNumber: consignment.consignmentNumber,
        addedCount: results.added.length,
        results,
      },
    });
  } catch (error) {
    console.error("Error adding shipments to consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add shipments to consignment" },
      { status: 500 }
    );
  }
}

// DELETE /api/consignments/[consignmentId]/shipments - Remove shipment from consignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ consignmentId: string }> }
) {
  try {
    const { consignmentId } = await params;
    const body = await request.json();

    const { awbNumber, reason } = body;

    if (!awbNumber) {
      return NextResponse.json(
        { success: false, error: "AWB number required" },
        { status: 400 }
      );
    }

    // Find consignment
    const consignment = await prisma.consignment.findUnique({
      where: { id: consignmentId },
    });

    if (!consignment) {
      return NextResponse.json(
        { success: false, error: "Consignment not found" },
        { status: 404 }
      );
    }

    if (consignment.status !== "OPEN") {
      return NextResponse.json(
        { success: false, error: "Cannot remove shipments from closed consignment" },
        { status: 400 }
      );
    }

    // Find shipment
    const shipment = await prisma.shipment.findFirst({
      where: {
        awbNumber,
        consignmentId: consignment.id,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found in this consignment" },
        { status: 404 }
      );
    }

    // Remove from consignment
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        consignmentId: null,
        status: "IN_HUB",
      },
    });

    // Update consignment totals
    await prisma.consignment.update({
      where: { id: consignment.id },
      data: {
        shipmentCount: { decrement: 1 },
        totalWeightKg: { decrement: shipment.chargeableWeightKg || 0 },
      },
    });

    // Create event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: "DECONSOLIDATED",
        status: "IN_HUB",
        statusText: `Removed from consignment ${consignment.consignmentNumber}`,
        source: "CONSOLIDATION",
        eventTime: new Date(),
        metadata: JSON.stringify({ reason }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Shipment removed from consignment" },
    });
  } catch (error) {
    console.error("Error removing shipment from consignment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove shipment from consignment" },
      { status: 500 }
    );
  }
}
