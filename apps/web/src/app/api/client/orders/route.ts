import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const where: any = {
      clientId: client.id,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { awbNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    if (fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(fromDate) };
    }

    if (toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(toDate) };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          warehouse: {
            select: { id: true, name: true, code: true },
          },
          partner: {
            select: { id: true, name: true, code: true },
          },
          events: {
            orderBy: { eventTime: "desc" },
            take: 1,
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: orders,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Client orders error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      warehouseId,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      deliveryPincode,
      deliveryCity,
      deliveryState,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      itemDescription,
      itemValue,
      itemQuantity,
      itemSku,
      paymentMode,
      codAmount,
      clientOrderId,
      notes,
    } = body;

    // Validate required fields
    if (!customerName || !customerPhone || !deliveryAddress || !deliveryPincode || !weightKg || !itemDescription) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get warehouse for origin pincode
    let originPincode = "";
    if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId, clientId: client.id },
      });
      if (warehouse) {
        originPincode = warehouse.pincode;
      }
    }

    // Generate order number
    const orderCount = await prisma.order.count({ where: { clientId: client.id } });
    const orderNumber = `CJD${Date.now().toString(36).toUpperCase()}${(orderCount + 1).toString().padStart(4, "0")}`;

    // Calculate volumetric weight
    let volumetricWeight = null;
    if (lengthCm && widthCm && heightCm) {
      volumetricWeight = (lengthCm * widthCm * heightCm) / 5000;
    }

    const chargeableWeight = volumetricWeight
      ? Math.max(weightKg, volumetricWeight)
      : weightKg;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        clientId: client.id,
        warehouseId,
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        deliveryPincode,
        deliveryCity: deliveryCity || "",
        deliveryState: deliveryState || "",
        originPincode,
        weightKg,
        lengthCm,
        widthCm,
        heightCm,
        volumetricWeight,
        chargeableWeight,
        itemDescription,
        itemValue: itemValue || 0,
        itemQuantity: itemQuantity || 1,
        itemSku,
        paymentMode: paymentMode || "PREPAID",
        codAmount: paymentMode === "COD" ? codAmount || 0 : 0,
        clientOrderId,
        notes,
        status: "CREATED",
      },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Create initial event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        status: "CREATED",
        statusText: "Order created",
        source: "CLIENT_PORTAL",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
