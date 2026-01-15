import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/quotations/[id] - Get B2B quotation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        customerId: customer.id,
      },
      include: {
        items: {
          include: {
            sku: {
              select: { id: true, code: true, name: true, imageUrl: true },
            },
          },
        },
        convertedOrder: {
          select: { id: true, orderNo: true, status: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const now = new Date();
    const daysUntilExpiry = Math.max(
      0,
      Math.ceil((quotation.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    return NextResponse.json({
      id: quotation.id,
      quotationNo: quotation.quotationNo,
      status: quotation.status,
      subtotal: Number(quotation.subtotal),
      taxAmount: Number(quotation.taxAmount),
      discountAmount: Number(quotation.discountAmount || 0),
      totalAmount: Number(quotation.totalAmount),
      createdAt: quotation.createdAt.toISOString().split("T")[0],
      validUntil: quotation.validUntil.toISOString().split("T")[0],
      validDays: daysUntilExpiry,
      remarks: quotation.remarks,
      shippingAddress: quotation.shippingAddress,
      billingAddress: quotation.billingAddress,
      rejectionReason: quotation.rejectionReason,
      convertedOrder: quotation.convertedOrder,
      items: quotation.items.map((item) => ({
        id: item.id,
        sku: {
          id: item.sku.id,
          code: item.sku.code,
          name: item.sku.name,
          imageUrl: item.sku.imageUrl,
        },
        skuCode: item.skuCode,
        skuName: item.skuName,
        quantity: item.quantity,
        listPrice: Number(item.listPrice || item.unitPrice),
        unitPrice: Number(item.unitPrice),
        discountPercent: Number(item.discountPercent || 0),
        discountAmount: Number(item.discountAmount || 0),
        taxPercent: Number(item.taxPercent || 18),
        taxAmount: Number(item.taxAmount),
        totalPrice: Number(item.totalPrice),
      })),
    });
  } catch (error) {
    console.error("Error fetching B2B quotation:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/quotations/[id] - Convert quotation to order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        customerId: customer.id,
      },
      include: {
        items: {
          include: {
            sku: true,
          },
        },
        customer: true,
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved quotations can be converted to orders" },
        { status: 400 }
      );
    }

    if (quotation.convertedToOrderId) {
      return NextResponse.json(
        { error: "Quotation already converted to order" },
        { status: 400 }
      );
    }

    // Check if quotation is expired
    if (new Date() > quotation.validUntil) {
      return NextResponse.json(
        { error: "Quotation has expired" },
        { status: 400 }
      );
    }

    // Convert to order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate order number
      const orderSequence = await tx.sequence.upsert({
        where: { name: "order" },
        update: { currentValue: { increment: 1 } },
        create: { name: "order", prefix: "ORD", currentValue: 1, paddingLength: 8 },
      });
      const orderNo = `${orderSequence.prefix}${String(orderSequence.currentValue).padStart(orderSequence.paddingLength, "0")}`;

      // Create order
      const order = await tx.order.create({
        data: {
          orderNo,
          companyId: quotation.companyId,
          locationId: quotation.locationId,
          channel: "B2B",
          status: "CONFIRMED",
          paymentMode: "CREDIT",
          customerId: quotation.customerId,
          paymentTermType: quotation.paymentTermType,
          paymentTermDays: quotation.paymentTermDays,
          shippingAddress: quotation.shippingAddress,
          billingAddress: quotation.billingAddress,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          discount: quotation.discountAmount,
          totalAmount: quotation.totalAmount,
          items: {
            create: quotation.items.map((item) => ({
              skuId: item.skuId,
              skuCode: item.skuCode || item.sku.code,
              skuName: item.skuName || item.sku.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discountAmount,
              taxAmount: item.taxAmount,
              totalPrice: item.totalPrice,
            })),
          },
        },
      });

      // Update quotation
      await tx.quotation.update({
        where: { id },
        data: {
          status: "CONVERTED",
          convertedToOrderId: order.id,
          convertedAt: new Date(),
        },
      });

      // Update customer credit if credit is enabled
      if (quotation.customer.creditEnabled) {
        await tx.customer.update({
          where: { id: quotation.customerId },
          data: {
            creditUsed: { increment: Number(quotation.totalAmount) },
          },
        });

        // Create credit transaction
        const creditUsed = Number(quotation.customer.creditUsed);
        const creditLimit = Number(quotation.customer.creditLimit);
        const orderAmount = Number(quotation.totalAmount);

        await tx.creditTransaction.create({
          data: {
            customerId: quotation.customerId,
            type: "UTILIZATION",
            amount: orderAmount,
            balanceBefore: creditLimit - creditUsed,
            balanceAfter: creditLimit - creditUsed - orderAmount,
            referenceType: "ORDER",
            referenceId: order.id,
            referenceNo: orderNo,
            description: `Order created from quotation ${quotation.quotationNo}`,
            createdBy: session.user.id || "system",
          },
        });
      }

      return order;
    });

    return NextResponse.json({
      success: true,
      order: {
        id: result.id,
        orderNo: result.orderNo,
      },
      message: "Quotation converted to order successfully",
    });
  } catch (error) {
    console.error("Error converting quotation to order:", error);
    return NextResponse.json(
      { error: "Failed to convert quotation to order" },
      { status: 500 }
    );
  }
}
