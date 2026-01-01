import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { createJourneyPlan } from "@/lib/fulfillment-router";

// Generate AWB number: CJD + YYYYMMDD + 8 random chars
function generateAwbNumber(): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CJD${date}${random}`;
}

// GET /api/shipments - List shipments with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const hubId = searchParams.get("hubId");
    const clientId = searchParams.get("clientId");
    const fulfillmentMode = searchParams.get("fulfillmentMode");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) where.status = status;
    if (hubId) where.currentHubId = hubId;
    if (clientId) where.clientId = clientId;
    if (fulfillmentMode) where.fulfillmentMode = fulfillmentMode;
    if (search) {
      where.OR = [
        { awbNumber: { contains: search } },
        { consigneeName: { contains: search } },
        { consigneePhone: { contains: search } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          consignment: { select: { consignmentNumber: true, status: true } },
          _count: { select: { scans: true, events: true } },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: shipments,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch shipments" },
      { status: 500 }
    );
  }
}

// POST /api/shipments - Create a new shipment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Generate AWB
    const awbNumber = generateAwbNumber();

    // Determine fulfillment strategy and create journey plan
    const { journeyPlanId, decision } = await createJourneyPlan(
      body.shipperPincode,
      body.consigneePincode
    );

    // Calculate chargeable weight
    const volumetricWeight = body.lengthCm && body.widthCm && body.heightCm
      ? (body.lengthCm * body.widthCm * body.heightCm) / 5000
      : null;
    const chargeableWeight = Math.max(
      body.actualWeightKg,
      volumetricWeight || 0
    );

    // Create shipment with journey plan
    const shipment = await prisma.shipment.create({
      data: {
        awbNumber,
        orderId: body.orderId,
        clientId: body.clientId,
        clientOrderRef: body.clientOrderRef,

        // Shipper
        shipperName: body.shipperName,
        shipperPhone: body.shipperPhone,
        shipperAddress: body.shipperAddress,
        shipperPincode: body.shipperPincode,
        shipperCity: body.shipperCity,
        shipperState: body.shipperState,

        // Consignee
        consigneeName: body.consigneeName,
        consigneePhone: body.consigneePhone,
        consigneeAddress: body.consigneeAddress,
        consigneePincode: body.consigneePincode,
        consigneeCity: body.consigneeCity,
        consigneeState: body.consigneeState,

        // Package
        pieces: body.pieces || 1,
        actualWeightKg: body.actualWeightKg,
        volumetricWeightKg: volumetricWeight,
        chargeableWeightKg: chargeableWeight,
        lengthCm: body.lengthCm,
        widthCm: body.widthCm,
        heightCm: body.heightCm,

        // Content
        contentDescription: body.contentDescription,
        declaredValue: body.declaredValue,

        // Payment
        paymentMode: body.paymentMode || "PREPAID",
        codAmount: body.codAmount || 0,

        // Service
        serviceType: body.serviceType || "STANDARD",

        // Fulfillment
        fulfillmentMode: decision.mode,
        originHubId: decision.originHubId,
        destinationHubId: decision.destinationHubId,
        journeyPlanId,

        // Partner info (for hybrid)
        partnerId: decision.partnerId,

        // Expected delivery
        expectedDeliveryDate: new Date(
          Date.now() + decision.estimatedTransitDays * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Create shipment legs from journey plan
    for (const leg of decision.legs) {
      await prisma.shipmentLeg.create({
        data: {
          shipmentId: shipment.id,
          journeyPlanId,
          legIndex: leg.legIndex,
          legType: leg.legType,
          fromHubId: leg.fromHubId,
          toHubId: leg.toHubId,
          fromLocation: leg.fromLocation,
          toLocation: leg.toLocation,
          mode: leg.mode,
          partnerId: leg.partnerId,
        },
      });
    }

    // Create initial event
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: "BOOKING",
        status: "BOOKED",
        statusText: "Shipment booked successfully",
        source: "SYSTEM",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...shipment,
        journeyPlan: decision,
      },
    });
  } catch (error: any) {
    console.error("Error creating shipment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create shipment" },
      { status: 500 }
    );
  }
}
