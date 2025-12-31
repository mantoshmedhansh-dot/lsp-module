import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { createOrderSchema } from "@/lib/validations";
import {
  generateOrderNumber,
  calculateVolumetricWeight,
  calculateChargeableWeight,
} from "@/lib/partner-selection";
import { getDemoContext } from "@/lib/demo-context";

// GET /api/orders - List orders
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");
    const stage = searchParams.get("stage");

    // TODO: Get clientId from session
    const clientId = searchParams.get("clientId");

    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    // Filter by stage
    if (stage) {
      const stageStatuses: Record<string, string[]> = {
        manifestation: ["CREATED", "PARTNER_ASSIGNED", "AWB_GENERATED"],
        pick: ["PICKUP_SCHEDULED", "PICKUP_PENDING", "PICKED"],
        pack: ["PACKING", "PACKED", "LABELLED"],
        dispatch: ["READY_TO_DISPATCH", "DISPATCHED", "HANDED_OVER"],
        delivery: ["IN_TRANSIT", "OUT_FOR_DELIVERY"],
        pod: ["DELIVERED"],
      };
      if (stageStatuses[stage]) {
        where.status = { in: stageStatuses[stage] };
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          partner: {
            select: {
              code: true,
              displayName: true,
            },
          },
          warehouse: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: "Failed to fetch orders" } },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const body = await request.json();
    const validated = createOrderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0].message,
            details: validated.error.errors,
          },
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Get demo client for local development
    const demoContext = await getDemoContext();
    const clientId = demoContext.id;

    // Calculate volumetric and chargeable weight
    let volumetricWeight: number | null = null;
    let chargeableWeight = data.weightKg;

    if (data.lengthCm && data.widthCm && data.heightCm) {
      volumetricWeight = calculateVolumetricWeight(
        data.lengthCm,
        data.widthCm,
        data.heightCm
      );
      chargeableWeight = calculateChargeableWeight(data.weightKg, volumetricWeight);
    }

    // Create the order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        clientId,
        warehouseId: data.warehouseId,

        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        deliveryAddress: data.deliveryAddress,
        deliveryPincode: data.deliveryPincode,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,

        originPincode: data.originPincode,

        weightKg: data.weightKg,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        volumetricWeight,
        chargeableWeight,

        itemDescription: data.itemDescription,
        itemValue: data.itemValue,
        itemQuantity: data.itemQuantity,
        itemSku: data.itemSku,

        paymentMode: data.paymentMode,
        codAmount: data.paymentMode === "COD" ? data.codAmount : 0,

        clientOrderId: data.clientOrderId,
        notes: data.notes,

        status: "CREATED",
      },
    });

    // Create initial event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        status: "CREATED",
        statusText: "Order created",
        source: "SYSTEM",
        eventTime: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { success: false, error: { code: "CREATE_ERROR", message: "Failed to create order" } },
      { status: 500 }
    );
  }
}
