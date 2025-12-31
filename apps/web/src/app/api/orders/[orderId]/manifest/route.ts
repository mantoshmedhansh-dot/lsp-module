import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { selectOptimalPartner } from "@/lib/partner-selection";

// POST /api/orders/[orderId]/manifest - Manifest order (assign partner, generate AWB)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { partnerId } = body; // Optional: if not provided, use auto-selection

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            weightCost: true,
            weightSpeed: true,
            weightReliability: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    if (order.status !== "CREATED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot manifest order in ${order.status} status`,
          },
        },
        { status: 400 }
      );
    }

    let selectedPartnerId = partnerId;
    let partnerRate: number | null = null;
    let partnerScore: number | null = null;

    // Auto-select partner if not provided
    if (!selectedPartnerId) {
      const selectionResult = await selectOptimalPartner({
        originPincode: order.originPincode,
        destinationPincode: order.deliveryPincode,
        weightKg: Number(order.chargeableWeight || order.weightKg),
        isCod: order.paymentMode === "COD",
        codAmount: Number(order.codAmount),
        clientWeights: {
          cost: Number(order.client.weightCost),
          speed: Number(order.client.weightSpeed),
          reliability: Number(order.client.weightReliability),
        },
      });

      if (!selectionResult) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NO_PARTNER",
              message: "No serviceable partner found for this route",
            },
          },
          { status: 400 }
        );
      }

      selectedPartnerId = selectionResult.recommended.partnerId;
      partnerRate = selectionResult.recommended.rate;
      partnerScore = selectionResult.recommended.finalScore;
    }

    // Get partner details
    const partner = await prisma.partner.findUnique({
      where: { id: selectedPartnerId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: "PARTNER_NOT_FOUND", message: "Partner not found" } },
        { status: 400 }
      );
    }

    // Generate AWB number (mock - in real implementation, call partner API)
    const awbNumber = `${partner.code}${Date.now()}`.substring(0, 14);

    // Calculate client rate (markup)
    const clientRate = partnerRate ? partnerRate * 1.15 : null; // 15% markup

    // Mock label and tracking URLs
    const labelUrl = `/api/labels/${awbNumber}`;
    const trackingUrl = `${partner.apiBaseUrl}/track/${awbNumber}`;

    // Calculate expected delivery
    const serviceability = await prisma.partnerServiceability.findFirst({
      where: {
        partnerId: selectedPartnerId,
        originPincode: order.originPincode,
        destinationPincode: order.deliveryPincode,
      },
    });

    const expectedDeliveryDate = serviceability
      ? new Date(
          Date.now() + serviceability.estimatedTatDays * 24 * 60 * 60 * 1000
        )
      : null;

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        partnerId: selectedPartnerId,
        awbNumber,
        partnerRate,
        clientRate,
        partnerScore,
        labelUrl,
        trackingUrl,
        expectedDeliveryDate,
        status: "AWB_GENERATED",
        manifestedAt: new Date(),
      },
      include: {
        partner: {
          select: { code: true, displayName: true },
        },
      },
    });

    // Create events
    await prisma.orderEvent.createMany({
      data: [
        {
          orderId,
          status: "PARTNER_ASSIGNED",
          statusText: `Partner assigned: ${partner.displayName}`,
          source: "SYSTEM",
          eventTime: new Date(),
        },
        {
          orderId,
          status: "AWB_GENERATED",
          statusText: `AWB generated: ${awbNumber}`,
          source: "SYSTEM",
          eventTime: new Date(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        awbNumber,
        labelUrl,
        trackingUrl,
        partnerName: partner.displayName,
        expectedDeliveryDate,
      },
    });
  } catch (error) {
    console.error("Error manifesting order:", error);
    return NextResponse.json(
      { success: false, error: { code: "MANIFEST_ERROR", message: "Failed to manifest order" } },
      { status: 500 }
    );
  }
}
