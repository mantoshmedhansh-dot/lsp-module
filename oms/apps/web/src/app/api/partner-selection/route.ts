import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import {
  selectOptimalPartner,
  checkRouteServiceability,
} from "@/lib/intelligent-orchestration";

/**
 * Partner Selection API - OMS Backend
 *
 * Intelligent courier partner selection based on:
 * - Cost optimization
 * - Delivery speed (TAT)
 * - Reliability score
 * - Route serviceability
 */

// GET /api/partner-selection - Get partner recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const weight = parseFloat(searchParams.get("weight") || "0.5");
    const paymentMode = searchParams.get("paymentMode") || "PREPAID";
    const codAmount = parseFloat(searchParams.get("codAmount") || "0");

    // Get recommendation for specific order
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { Location: true },
      });

      if (!order) {
        return NextResponse.json({
          success: false,
          error: "Order not found",
        }, { status: 404 });
      }

      const shippingAddress = order.shippingAddress as { pincode?: string } | null;
      const locationAddr = order.Location?.address as { pincode?: string } | null;
      const result = await selectOptimalPartner({
        originPincode: locationAddr?.pincode || "110001",
        destinationPincode: shippingAddress?.pincode || "560001",
        weightKg: 0.5, // Default weight if not available
        isCod: order.paymentMode === "COD",
        codAmount: order.paymentMode === "COD" ? Number(order.totalAmount) : 0,
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          ...result,
        },
      });
    }

    // Get recommendation for given parameters
    if (origin && destination) {
      const result = await selectOptimalPartner({
        originPincode: origin,
        destinationPincode: destination,
        weightKg: weight,
        isCod: paymentMode === "COD",
        codAmount,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Return all active transporters
    const transporters = await prisma.transporter.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { transporters },
    });
  } catch (error) {
    console.error("Partner selection error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get partner recommendations",
    }, { status: 500 });
  }
}

// POST /api/partner-selection - Calculate or assign partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Calculate optimal partner
    if (action === "calculate") {
      const {
        originPincode,
        destinationPincode,
        weightKg = 0.5,
        isCod = false,
        codAmount = 0,
        weights,
      } = body;

      if (!originPincode || !destinationPincode) {
        return NextResponse.json({
          success: false,
          error: "Origin and destination pincodes required",
        }, { status: 400 });
      }

      const result = await selectOptimalPartner({
        originPincode,
        destinationPincode,
        weightKg,
        isCod,
        codAmount,
        weights,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // Assign partner to order
    if (action === "assign") {
      const { orderId, transporterId } = body;

      if (!orderId || !transporterId) {
        return NextResponse.json({
          success: false,
          error: "orderId and transporterId required",
        }, { status: 400 });
      }

      const transporter = await prisma.transporter.findUnique({
        where: { id: transporterId },
      });

      if (!transporter) {
        return NextResponse.json({
          success: false,
          error: "Transporter not found",
        }, { status: 404 });
      }

      // Generate AWB number (in production, would call transporter API)
      const awbNo = `${transporter.code.substring(0, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

      // Create delivery record
      const delivery = await prisma.delivery.create({
        data: {
          deliveryNo: `DEL-${Date.now().toString(36).toUpperCase()}`,
          orderId,
          transporterId,
          awbNo,
          status: "PENDING",
        },
        include: {
          Transporter: { select: { code: true, name: true } },
        },
      });

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "MANIFESTED" },
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          deliveryId: delivery.id,
          transporterCode: delivery.Transporter?.code,
          transporterName: delivery.Transporter?.name,
          awbNo: delivery.awbNo,
        },
      });
    }

    // Check serviceability for partner
    if (action === "check_serviceability") {
      const { originPincode, destinationPincode, transporterId } = body;

      const route = await checkRouteServiceability(originPincode, destinationPincode);

      if (transporterId) {
        const isServiceable = route.transporters.some(t => t.id === transporterId);
        return NextResponse.json({
          success: true,
          data: {
            transporterId,
            originPincode,
            destinationPincode,
            isServiceable,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: route,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action",
    }, { status: 400 });
  } catch (error) {
    console.error("Partner selection POST error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to process request",
    }, { status: 500 });
  }
}
