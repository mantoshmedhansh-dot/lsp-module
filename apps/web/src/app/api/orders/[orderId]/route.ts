import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";

// GET /api/orders/[orderId] - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        warehouse: true,
        events: {
          orderBy: { eventTime: "desc" },
        },
        ndrCase: true,
        pickedBy: {
          include: { user: { select: { name: true } } },
        },
        packedBy: {
          include: { user: { select: { name: true } } },
        },
        dispatchedBy: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch order" } },
      { status: 500 }
    );
  }
}
