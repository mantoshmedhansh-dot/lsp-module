import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { getDemoContext } from "@/lib/demo-context";
import {
  calculateVolumetricWeight,
  calculateChargeableWeight,
} from "@/lib/partner-selection";

// POST /api/orders/[orderId]/pack - Mark order as packed with updated dimensions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { orderId } = await params;
    const body = await request.json();
    const { weightKg, lengthCm, widthCm, heightCm } = body;

    if (!weightKg || weightKg <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Weight is required" },
        },
        { status: 400 }
      );
    }

    // Get demo staff for local development
    const demoContext = await getDemoContext();
    const packedById = demoContext.staffId;

    // Get the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Validate order status
    const validStatuses = ["PICKED", "PACKING"];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot pack order in ${order.status} status`,
          },
        },
        { status: 400 }
      );
    }

    // Get staff info
    const staff = await prisma.warehouseStaff.findUnique({
      where: { id: packedById },
      include: { user: { select: { name: true } } },
    });

    const staffName = staff?.user.name || "Warehouse Staff";

    // Calculate updated weights
    let volumetricWeight: number | null = null;
    let chargeableWeight = weightKg;

    if (lengthCm && widthCm && heightCm) {
      volumetricWeight = calculateVolumetricWeight(lengthCm, widthCm, heightCm);
      chargeableWeight = calculateChargeableWeight(weightKg, volumetricWeight);
    }

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PACKED",
        packedAt: new Date(),
        packedById: staff?.id,
        weightKg,
        lengthCm: lengthCm || null,
        widthCm: widthCm || null,
        heightCm: heightCm || null,
        volumetricWeight,
        chargeableWeight,
      },
    });

    // Create event
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "PACKED",
        statusText: `Order packed by ${staffName}. Weight: ${weightKg}kg${
          lengthCm && widthCm && heightCm
            ? `, Dimensions: ${lengthCm}x${widthCm}x${heightCm}cm`
            : ""
        }`,
        source: "WAREHOUSE",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error packing order:", error);
    return NextResponse.json(
      { success: false, error: { code: "PACK_ERROR", message: "Failed to pack order" } },
      { status: 500 }
    );
  }
}
