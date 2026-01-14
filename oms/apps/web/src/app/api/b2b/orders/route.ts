import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/orders - Get B2B customer orders
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

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
      return NextResponse.json({ orders: [], total: 0 });
    }

    const where: Record<string, unknown> = { customerId: customer.id };
    if (status && status !== "all") {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          items: { select: { id: true } },
          deliveries: {
            select: { status: true, awbNumber: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
        createdAt: order.createdAt.toISOString().split("T")[0],
        deliveryStatus: order.deliveries[0]?.status || null,
        awbNumber: order.deliveries[0]?.awbNumber || null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching B2B orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST /api/b2b/orders - Create a new B2B order
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, shippingAddressIndex = 0, poNumber, notes } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Order must have at least one item" },
        { status: 400 }
      );
    }

    // Get the B2B customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: session.user.email },
          { portalUserId: session.user.id },
        ],
      },
      include: {
        priceList: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Get default location for the customer's company
    const location = await prisma.location.findFirst({
      where: { companyId: customer.companyId, isActive: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "No active location found" },
        { status: 400 }
      );
    }

    // Calculate totals with price list if available
    let subtotal = 0;
    let taxAmount = 0;
    const orderItems: Array<{
      skuId: string;
      skuCode: string;
      skuName: string;
      quantity: number;
      unitPrice: number;
      taxPercent: number;
      taxAmount: number;
      totalPrice: number;
    }> = [];

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

      // Check for price list pricing
      let unitPrice = Number(sku.sellingPrice);
      if (customer.priceList) {
        const priceListItem = customer.priceList.items.find(
          (p: { skuId: string }) => p.skuId === item.skuId
        );
        if (priceListItem) {
          unitPrice = Number(priceListItem.price);
        }
      }

      const itemTaxPercent = Number(sku.taxPercent || 18);
      const lineTotal = unitPrice * item.quantity;
      const lineTax = lineTotal * (itemTaxPercent / 100);

      subtotal += lineTotal;
      taxAmount += lineTax;

      orderItems.push({
        skuId: item.skuId,
        skuCode: sku.code,
        skuName: sku.name,
        quantity: item.quantity,
        unitPrice,
        taxPercent: itemTaxPercent,
        taxAmount: lineTax,
        totalPrice: lineTotal + lineTax,
      });
    }

    const totalAmount = subtotal + taxAmount;

    // Check credit limit if using credit payment
    if (customer.creditEnabled) {
      if (Number(customer.creditAvailable) < totalAmount) {
        return NextResponse.json(
          { error: "Insufficient credit available" },
          { status: 400 }
        );
      }
    }

    // Generate order number
    const orderCount = await prisma.order.count({
      where: {
        locationId: location.id,
        createdAt: {
          gte: new Date(new Date().getFullYear(), 0, 1),
        },
      },
    });
    const orderNo = `B2B-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, "0")}`;

    // Get shipping address
    const shippingAddress = customer.shippingAddresses[shippingAddressIndex] || customer.shippingAddresses[0] || customer.billingAddress;

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNo,
        externalOrderNo: poNumber,
        channel: "B2B",
        orderType: "B2B",
        paymentMode: customer.creditEnabled ? "CREDIT" : "PREPAID",
        status: "CREATED",
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        shippingAddress: shippingAddress as object,
        billingAddress: customer.billingAddress as object,
        subtotal,
        taxAmount,
        totalAmount,
        orderDate: new Date(),
        locationId: location.id,
        customerId: customer.id,
        paymentTermType: customer.paymentTermType,
        paymentTermDays: customer.paymentTermDays,
        poNumber,
        remarks: notes,
        items: {
          create: orderItems.map((item) => ({
            sku: { connect: { id: item.skuId } },
            skuCode: item.skuCode,
            skuName: item.skuName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxPercent: item.taxPercent,
            taxAmount: item.taxAmount,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Update credit if using credit payment
    if (customer.creditEnabled) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          creditUsed: { increment: totalAmount },
          creditAvailable: { decrement: totalAmount },
        },
      });

      // Record credit transaction
      await prisma.b2BCreditTransaction.create({
        data: {
          customerId: customer.id,
          type: "ORDER",
          amount: totalAmount,
          reference: orderNo,
          balanceAfter: Number(customer.creditAvailable) - totalAmount,
          description: `Order ${orderNo}`,
        },
      });
    }

    return NextResponse.json({
      message: "Order created successfully",
      order: {
        id: order.id,
        orderNo: order.orderNo,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
      },
    });
  } catch (error) {
    console.error("Error creating B2B order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
