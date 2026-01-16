import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

// Helper to generate order number
function generateOrderNo(): string {
  const prefix = "ORD";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/orders - List orders with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const channel = searchParams.get("channel") || "";
    const paymentMode = searchParams.get("paymentMode") || "";
    const locationId = searchParams.get("locationId") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by user's location access
    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    // Override with specific location if provided
    if (locationId) {
      where.locationId = locationId;
    }

    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: "insensitive" } },
        { externalOrderNo: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode;
    }

    if (fromDate) {
      where.orderDate = {
        ...(where.orderDate as object || {}),
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      where.orderDate = {
        ...(where.orderDate as object || {}),
        lte: new Date(toDate + "T23:59:59"),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          Location: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          OrderItem: {
            include: {
              SKU: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          Delivery: {
            select: {
              id: true,
              deliveryNo: true,
              status: true,
              awbNo: true,
              Transporter: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              OrderItem: true,
              Picklist: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Get status counts for tabs
    const locationFilter = where.locationId as string | { in: string[] } | undefined;
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      where: locationFilter ? { locationId: locationFilter } : undefined,
      _count: {
        _all: true,
      },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      externalOrderNo,
      channel,
      orderType,
      paymentMode,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      billingAddress,
      items,
      shipByDate,
      promisedDate,
      priority,
      tags,
      remarks,
      locationId,
    } = body;

    // Validate required fields
    if (!customerName || !customerPhone || !shippingAddress || !items?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Calculate totals from items
    let subtotal = 0;
    let taxAmount = 0;
    let discount = 0;

    const orderItems = await Promise.all(
      items.map(async (item: { skuId: string; quantity: number; unitPrice?: number; discount?: number }) => {
        const sku = await prisma.sKU.findUnique({
          where: { id: item.skuId },
        });

        if (!sku) {
          throw new Error(`SKU not found: ${item.skuId}`);
        }

        const unitPrice = item.unitPrice || Number(sku.sellingPrice) || 0;
        const itemDiscount = item.discount || 0;
        const itemTax = unitPrice * item.quantity * 0.18; // Assuming 18% GST
        const itemTotal = unitPrice * item.quantity - itemDiscount + itemTax;

        subtotal += unitPrice * item.quantity;
        taxAmount += itemTax;
        discount += itemDiscount;

        return {
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice,
          taxAmount: itemTax,
          discount: itemDiscount,
          totalPrice: itemTotal,
        };
      })
    );

    const totalAmount = subtotal + taxAmount - discount;

    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNo(),
        externalOrderNo,
        channel: channel || "MANUAL",
        orderType: orderType || "B2C",
        paymentMode: paymentMode || "PREPAID",
        status: "CREATED",
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        subtotal,
        taxAmount,
        discount,
        totalAmount,
        orderDate: new Date(),
        shipByDate: shipByDate ? new Date(shipByDate) : null,
        promisedDate: promisedDate ? new Date(promisedDate) : null,
        priority: priority || 0,
        tags: tags || [],
        remarks,
        locationId: locationId || session.user.locationAccess?.[0],
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
        Location: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create order" },
      { status: 500 }
    );
  }
}
