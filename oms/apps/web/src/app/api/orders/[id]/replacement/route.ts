import { NextRequest, NextResponse } from "next/server";
import { prisma, OrderStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// POST /api/orders/[id]/replacement - Create replacement order from return
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: returnId } = await params;
    const body = await request.json();
    const { items, shippingAddress, remarks } = body;

    // Get return with original order
    const returnRecord = await prisma.return.findUnique({
      where: { id: returnId },
      include: {
        Order_Return_orderIdToOrder: {
          include: {
            OrderItem: {
              include: {
                SKU: true,
              },
            },
            Location: true,
          },
        },
        ReturnItem: true,
      },
    });

    if (!returnRecord) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    // Check if return is eligible for replacement
    // ReturnStatus: INITIATED, IN_TRANSIT, RECEIVED, QC_PENDING, QC_PASSED, QC_FAILED, RESTOCKED, DISPOSED, REFUNDED
    if (!["RECEIVED", "QC_PASSED"].includes(returnRecord.status)) {
      return NextResponse.json(
        { error: "Return must be received or QC passed for replacement" },
        { status: 400 }
      );
    }

    // Check if return has associated order
    const originalOrder = returnRecord.Order_Return_orderIdToOrder;
    if (!originalOrder) {
      return NextResponse.json(
        { error: "Return has no associated order" },
        { status: 400 }
      );
    }

    // Check if replacement already exists
    const existingReplacement = await prisma.order.findFirst({
      where: { replacementForReturnId: returnId },
    });

    if (existingReplacement) {
      return NextResponse.json(
        { error: "Replacement order already exists", orderId: existingReplacement.id },
        { status: 400 }
      );
    }

    // Determine items for replacement
    let replacementItems: { skuId: string; quantity: number; unitPrice: number; taxAmount: number }[] = [];

    if (items && items.length > 0) {
      // Custom items specified
      for (const item of items) {
        const sku = await prisma.sKU.findUnique({
          where: { id: item.skuId },
        });

        if (!sku) {
          return NextResponse.json(
            { error: `SKU not found: ${item.skuId}` },
            { status: 400 }
          );
        }

        replacementItems.push({
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice: item.unitPrice || sku.mrp?.toNumber() || 0,
          taxAmount: item.taxAmount || 0,
        });
      }
    } else {
      // Use return items for replacement - fetch SKUs separately
      const skuIds = returnRecord.ReturnItem.map((item) => item.skuId);
      const skus = await prisma.sKU.findMany({
        where: { id: { in: skuIds } },
        select: { id: true, mrp: true },
      });
      const skuMap = new Map(skus.map((s) => [s.id, s]));

      replacementItems = returnRecord.ReturnItem.map((item) => {
        const sku = skuMap.get(item.skuId);
        return {
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice: sku?.mrp?.toNumber() || 0,
          taxAmount: 0,
        };
      });
    }

    if (replacementItems.length === 0) {
      return NextResponse.json(
        { error: "No items specified for replacement" },
        { status: 400 }
      );
    }

    // Calculate totals (replacement orders are typically free for customer)
    let subtotal = 0;
    let totalTax = 0;

    const orderItems = replacementItems.map((item) => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;
      totalTax += item.taxAmount;

      return {
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: item.taxAmount,
        discount: item.unitPrice * item.quantity, // Full discount for replacement
        totalPrice: item.taxAmount, // Customer pays only tax if applicable
      };
    });

    // Use original shipping address or provided one
    const finalShippingAddress = shippingAddress || originalOrder.shippingAddress;

    // Generate order number
    const sequence = await prisma.sequence.upsert({
      where: { name: "order" },
      update: { currentValue: { increment: 1 } },
      create: { name: "order", prefix: "ORD", currentValue: 1 },
    });

    const orderNo = `ORD${String(sequence.currentValue).padStart(8, "0")}`;

    // Create replacement order
    const replacementOrder = await prisma.order.create({
      data: {
        orderNo,
        channel: originalOrder.channel,
        paymentMode: "PREPAID", // Replacement orders are prepaid (no payment due)
        status: "CREATED" as OrderStatus,
        customerName: originalOrder.customerName,
        customerPhone: originalOrder.customerPhone,
        customerEmail: originalOrder.customerEmail,
        shippingAddress: finalShippingAddress,
        orderDate: new Date(),
        subtotal,
        taxAmount: totalTax,
        shippingCharges: 0, // Free shipping for replacement
        discount: subtotal, // Full discount
        codCharges: 0,
        totalAmount: totalTax, // Only tax if applicable, usually 0
        locationId: originalOrder.locationId,
        replacementForReturnId: returnId,
        dataSourceType: "REPLACEMENT",
        priority: 1, // High priority
        remarks: remarks || `Replacement for Return ${returnRecord.returnNo}`,
        OrderItem: {
          create: orderItems,
        },
      },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
      },
    });

    // Mark return as restocked since replacement is being created
    await prisma.return.update({
      where: { id: returnId },
      data: {
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: replacementOrder.id,
        orderNo: replacementOrder.orderNo,
        status: replacementOrder.status,
        items: replacementOrder.OrderItem,
      },
      message: `Replacement order ${replacementOrder.orderNo} created successfully`,
    });
  } catch (error) {
    console.error("Error creating replacement order:", error);
    return NextResponse.json(
      { error: "Failed to create replacement order" },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/replacement - Get replacement order for a return
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: returnId } = await params;

    const replacementOrder = await prisma.order.findFirst({
      where: { replacementForReturnId: returnId },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Delivery: {
          include: {
            Transporter: true,
          },
        },
      },
    });

    if (!replacementOrder) {
      return NextResponse.json(
        { error: "No replacement order found for this return" },
        { status: 404 }
      );
    }

    return NextResponse.json(replacementOrder);
  } catch (error) {
    console.error("Error fetching replacement order:", error);
    return NextResponse.json(
      { error: "Failed to fetch replacement order" },
      { status: 500 }
    );
  }
}
