import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { randomBytes } from "crypto";

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

function generateAwbNumber(): string {
  const prefix = "CJD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// GET - List customer's shipments
export async function GET(request: NextRequest) {
  try {
    const client = await verifyCustomerAuth(request);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: any = { clientId: client.id };
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          scans: {
            orderBy: { scanTime: "desc" },
            take: 1,
          },
        },
      }),
      prisma.shipment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: shipments.map((s) => ({
          id: s.id,
          awbNumber: s.awbNumber,
          status: s.status,
          originCity: s.originCity,
          originPincode: s.originPincode,
          destinationCity: s.destinationCity,
          destinationPincode: s.destinationPincode,
          weightKg: s.weightKg,
          receiverName: s.receiverName,
          expectedDeliveryDate: s.expectedDeliveryDate,
          createdAt: s.createdAt,
          lastScan: s.scans[0] || null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
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

// POST - Create new shipment
export async function POST(request: NextRequest) {
  try {
    const client = await verifyCustomerAuth(request);

    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      originPincode,
      destinationPincode,
      serviceType,
      weightKg,
      senderName,
      senderPhone,
      senderAddress,
      receiverName,
      receiverPhone,
      receiverAddress,
      packageDescription,
      declaredValue,
      isCod,
      codAmount,
      expectedDeliveryDate,
      estimatedCost,
    } = body;

    // Validation
    if (!originPincode || !destinationPincode || !receiverName || !receiverPhone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get pincode info
    const [originInfo, destInfo] = await Promise.all([
      prisma.pincodeMaster.findUnique({ where: { pincode: originPincode } }),
      prisma.pincodeMaster.findUnique({ where: { pincode: destinationPincode } }),
    ]);

    const awbNumber = generateAwbNumber();

    // Create shipment
    const shipment = await prisma.shipment.create({
      data: {
        awbNumber,
        clientId: client.id,
        status: "BOOKED",
        fulfillmentMode: "OWN_FLEET",
        senderName,
        senderPhone,
        senderAddress,
        originCity: originInfo?.city || "Unknown",
        originState: originInfo?.state || "Unknown",
        originPincode,
        receiverName,
        receiverPhone,
        receiverAddress,
        destinationCity: destInfo?.city || "Unknown",
        destinationState: destInfo?.state || "Unknown",
        destinationPincode,
        weightKg: weightKg || 10,
        volumetricWeight: weightKg || 10,
        chargeableWeight: Math.max(weightKg || 10, 10),
        packageCount: 1,
        packageDescription,
        declaredValue: declaredValue || 0,
        isCod: isCod || false,
        codAmount: isCod ? (codAmount || 0) : 0,
        invoiceValue: estimatedCost || 0,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      },
    });

    // Create initial scan
    await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        awbNumber,
        scanType: "BOOKED",
        scanTime: new Date(),
        remarks: `Shipment booked via customer portal. Service: ${serviceType}`,
      },
    });

    // Update client balance (if applicable)
    if (estimatedCost) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          currentBalance: {
            increment: estimatedCost,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: shipment.id,
        awbNumber: shipment.awbNumber,
        status: shipment.status,
        expectedDeliveryDate: shipment.expectedDeliveryDate,
        estimatedCost,
      },
    });
  } catch (error) {
    console.error("Error creating shipment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}
