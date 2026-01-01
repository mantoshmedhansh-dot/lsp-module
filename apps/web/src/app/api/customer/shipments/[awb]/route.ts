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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ awb: string }> }
) {
  try {
    const { awb } = await params;
    const client = await verifyCustomerAuth(request);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find shipment by AWB number
    const shipment = await prisma.shipment.findFirst({
      where: {
        awbNumber: awb,
        clientId: client.id,
      },
      include: {
        scans: {
          orderBy: { scanTime: "desc" },
          include: {
            hub: {
              select: { name: true, city: true },
            },
          },
        },
        currentHub: {
          select: { name: true, city: true },
        },
        journeyPlan: true,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Calculate SLA status
    const now = new Date();
    const expectedDate = shipment.expectedDeliveryDate
      ? new Date(shipment.expectedDeliveryDate)
      : null;

    let slaStatus: "on_track" | "at_risk" | "delayed" | "delivered" = "on_track";
    let daysRemaining: number | null = null;

    if (shipment.status === "DELIVERED") {
      slaStatus = "delivered";
      // Check if it was delivered on time
      if (expectedDate) {
        const deliveryScan = shipment.scans.find(
          (s) => s.scanType === "DELIVERED" || s.scanType === "POD_CAPTURED"
        );
        if (deliveryScan && new Date(deliveryScan.scanTime) > expectedDate) {
          slaStatus = "delayed";
        }
      }
    } else if (expectedDate) {
      daysRemaining = Math.ceil(
        (expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining < 0) {
        slaStatus = "delayed";
      } else if (daysRemaining <= 1) {
        slaStatus = "at_risk";
      }
    }

    // Format timeline
    const timeline = shipment.scans.map((scan) => ({
      type: scan.scanType,
      time: scan.scanTime,
      location: scan.hub ? `${scan.hub.name}, ${scan.hub.city}` : scan.location || "In Transit",
      remarks: scan.remarks,
    }));

    return NextResponse.json({
      success: true,
      data: {
        awbNumber: shipment.awbNumber,
        status: shipment.status,
        origin: {
          city: shipment.originCity,
          state: shipment.originState,
          pincode: shipment.originPincode,
          address: shipment.senderAddress,
          name: shipment.senderName,
          phone: shipment.senderPhone,
        },
        destination: {
          city: shipment.destinationCity,
          state: shipment.destinationState,
          pincode: shipment.destinationPincode,
          address: shipment.receiverAddress,
          name: shipment.receiverName,
          phone: shipment.receiverPhone,
        },
        package: {
          weight: shipment.weightKg,
          description: shipment.packageDescription,
          pieces: shipment.packageCount,
          isCod: shipment.isCod,
          codAmount: shipment.codAmount,
        },
        dates: {
          booked: shipment.createdAt,
          expectedDelivery: shipment.expectedDeliveryDate,
          actualDelivery: shipment.deliveredAt,
        },
        sla: {
          status: slaStatus,
          daysRemaining,
          expectedDate: shipment.expectedDeliveryDate,
        },
        currentLocation: shipment.currentHub
          ? `${shipment.currentHub.name}, ${shipment.currentHub.city}`
          : shipment.lastLocation || "Processing",
        timeline,
      },
    });
  } catch (error) {
    console.error("Tracking error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tracking data" },
      { status: 500 }
    );
  }
}
