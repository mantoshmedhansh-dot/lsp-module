import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { getDemoContext } from "@/lib/demo-context";

// POST /api/orders/[orderId]/dispatch - Mark order as dispatched (handed over to partner)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const handoverNotes = body.handoverNotes;

    // Get demo staff for local development
    const demoContext = await getDemoContext();
    const dispatchedById = demoContext.staffId;

    // Get the order with partner
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: {
          select: { displayName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Order not found" } },
        { status: 404 }
      );
    }

    // Validate order status
    const validStatuses = ["PACKED", "LABELLED", "READY_TO_DISPATCH"];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot dispatch order in ${order.status} status`,
          },
        },
        { status: 400 }
      );
    }

    if (!order.partnerId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_PARTNER",
            message: "Order must be manifested before dispatch",
          },
        },
        { status: 400 }
      );
    }

    // Get staff info
    const staff = await prisma.warehouseStaff.findUnique({
      where: { id: dispatchedById },
      include: { user: { select: { name: true } } },
    });

    const staffName = staff?.user.name || "Warehouse Staff";

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "DISPATCHED",
        dispatchedAt: new Date(),
        dispatchedById: staff?.id,
        notes: handoverNotes
          ? `${order.notes || ""}\nDispatch: ${handoverNotes}`.trim()
          : order.notes,
      },
    });

    // Create events
    await prisma.orderEvent.createMany({
      data: [
        {
          orderId,
          status: "DISPATCHED",
          statusText: `Order dispatched by ${staffName}`,
          source: "WAREHOUSE",
          eventTime: new Date(),
        },
        {
          orderId,
          status: "HANDED_OVER",
          statusText: `Handed over to ${order.partner?.displayName || "partner"}`,
          source: "SYSTEM",
          eventTime: new Date(),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error dispatching order:", error);
    return NextResponse.json(
      { success: false, error: { code: "DISPATCH_ERROR", message: "Failed to dispatch order" } },
      { status: 500 }
    );
  }
}
