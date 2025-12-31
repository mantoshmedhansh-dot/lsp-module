import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { getDemoContext } from "@/lib/demo-context";

// POST /api/orders/[orderId]/pick - Mark order as picked
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const prisma = await getPrisma();
    const { orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const notes = body.notes;

    // Get demo staff for local development
    const demoContext = await getDemoContext();
    const pickedById = demoContext.staffId;

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
    const validStatuses = ["AWB_GENERATED", "PICKUP_SCHEDULED", "PICKUP_PENDING"];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot pick order in ${order.status} status`,
          },
        },
        { status: 400 }
      );
    }

    // Get staff info
    const staff = await prisma.warehouseStaff.findUnique({
      where: { id: pickedById },
      include: { user: { select: { name: true } } },
    });

    const staffName = staff?.user.name || "Warehouse Staff";

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "PICKED",
        pickedAt: new Date(),
        pickedById: staff?.id,
        notes: notes ? `${order.notes || ""}\nPick: ${notes}`.trim() : order.notes,
      },
    });

    // Create event
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "PICKED",
        statusText: `Order picked by ${staffName}`,
        source: "WAREHOUSE",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error picking order:", error);
    return NextResponse.json(
      { success: false, error: { code: "PICK_ERROR", message: "Failed to pick order" } },
      { status: 500 }
    );
  }
}
