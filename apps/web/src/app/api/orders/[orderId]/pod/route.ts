import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { podSchema } from "@/lib/validations";

// POST /api/orders/[orderId]/pod - Record Proof of Delivery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { orderId } = await params;
    const body = await request.json();

    const validated = podSchema.safeParse({ ...body, orderId });
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    const {
      signature,
      photo,
      otp,
      receiverName,
      receiverRelation,
      latitude,
      longitude,
    } = validated.data;

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
    const validStatuses = ["OUT_FOR_DELIVERY", "IN_TRANSIT"];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot record POD for order in ${order.status} status`,
          },
        },
        { status: 400 }
      );
    }

    // Validate that at least one POD method is provided
    if (!signature && !photo && !otp) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "POD_REQUIRED",
            message: "At least one POD method (signature, photo, or OTP) is required",
          },
        },
        { status: 400 }
      );
    }

    // TODO: Store signature and photo in S3 and get URLs
    const signatureUrl = signature ? `/api/pod/${orderId}/signature` : null;
    const photoUrl = photo ? `/api/pod/${orderId}/photo` : null;

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        podSignature: signatureUrl,
        podPhoto: photoUrl,
        podOtp: otp,
        podReceiverName: receiverName,
        podReceiverRelation: receiverRelation,
        podLatitude: latitude,
        podLongitude: longitude,
      },
    });

    // Create event
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "DELIVERED",
        statusText: `Delivered to ${receiverName}${
          receiverRelation ? ` (${receiverRelation})` : ""
        }`,
        location: latitude && longitude ? `${latitude}, ${longitude}` : undefined,
        source: "PARTNER",
        eventTime: new Date(),
      },
    });

    // TODO: Send webhook to client
    // await webhookService.send(order.client.webhookUrl, {
    //   event: "order.delivered",
    //   order: updatedOrder,
    // });

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        pod: {
          receiverName,
          receiverRelation,
          hasSignature: !!signature,
          hasPhoto: !!photo,
          hasOtp: !!otp,
          deliveredAt: updatedOrder.deliveredAt,
        },
      },
    });
  } catch (error) {
    console.error("Error recording POD:", error);
    return NextResponse.json(
      { success: false, error: { code: "POD_ERROR", message: "Failed to record POD" } },
      { status: 500 }
    );
  }
}

// GET /api/orders/[orderId]/pod - Get POD details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveredAt: true,
        podSignature: true,
        podPhoto: true,
        podOtp: true,
        podReceiverName: true,
        podReceiverRelation: true,
        podLatitude: true,
        podLongitude: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    if (order.status !== "DELIVERED") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_DELIVERED", message: "Order is not yet delivered" },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        deliveredAt: order.deliveredAt,
        receiverName: order.podReceiverName,
        receiverRelation: order.podReceiverRelation,
        signatureUrl: order.podSignature,
        photoUrl: order.podPhoto,
        verifiedByOtp: !!order.podOtp,
        location:
          order.podLatitude && order.podLongitude
            ? { lat: order.podLatitude, lng: order.podLongitude }
            : null,
      },
    });
  } catch (error) {
    console.error("Error fetching POD:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch POD" } },
      { status: 500 }
    );
  }
}
