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
          { userId: session.user.id },
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
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          items: { select: { id: true } },
          delivery: {
            select: { expectedDeliveryDate: true, trackingNumber: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length,
        createdAt: order.createdAt.toISOString().split("T")[0],
        expectedDelivery: order.delivery?.expectedDeliveryDate?.toISOString().split("T")[0],
        trackingNumber: order.delivery?.trackingNumber,
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

// POST /api/b2b/orders - Create B2B order from cart
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, shippingAddressId, notes } = await request.json();

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
          { userId: session.user.id },
        ],
      },
      include: {
        priceList: { include: { items: true } },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Check credit availability
    let orderTotal = 0;
    const orderItems = [];

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

      // Get price from customer's price list or default
      let price = Number(sku.sellingPrice);
      if (customer.priceList) {
        const priceListItem = customer.priceList.items.find(
          (p) => p.skuId === item.skuId
        );
        if (priceListItem) {
          price = Number(priceListItem.price);
        }
      }

      const lineTotal = price * item.quantity;
      orderTotal += lineTotal;

      orderItems.push({
        skuId: item.skuId,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: lineTotal,
      });
    }

    // Check credit limit
    if (customer.creditLimit && Number(customer.creditAvailable) < orderTotal) {
      return NextResponse.json(
        {
          error: "Insufficient credit available",
          creditAvailable: Number(customer.creditAvailable),
          orderTotal,
        },
        { status: 400 }
      );
    }

    // Generate order number
    const orderCount = await prisma.order.count({
      where: { companyId: customer.companyId },
    });
    const orderNumber = `B2B-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, "0")}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        companyId: customer.companyId,
        customerId: customer.id,
        orderNumber,
        channel: "B2B_PORTAL",
        status: "PENDING",
        totalAmount: orderTotal,
        paymentMode: "CREDIT",
        items: {
          create: orderItems,
        },
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || "",
        shippingAddress: customer.shippingAddress as string || "",
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
        notes,
      },
      include: {
        items: true,
      },
    });

    // Update customer credit
    if (customer.creditLimit) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          creditUsed: { increment: orderTotal },
          creditAvailable: { decrement: orderTotal },
        },
      });

      // Record credit transaction
      await prisma.creditTransaction.create({
        data: {
          customerId: customer.id,
          type: "PURCHASE",
          amount: orderTotal,
          reference: orderNumber,
          balanceAfter: Number(customer.creditAvailable) - orderTotal,
          notes: `Order ${orderNumber}`,
        },
      });
    }

    return NextResponse.json({
      message: "Order created successfully",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
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
