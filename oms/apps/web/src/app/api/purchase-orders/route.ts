import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate PO number
async function generatePONumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "purchase_order" },
    update: { currentValue: { increment: 1 } },
    create: { name: "purchase_order", prefix: "PO", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "PO"}${paddedNumber}`;
}

// GET /api/purchase-orders - List purchase orders
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const vendorId = searchParams.get("vendorId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (search) {
      where.OR = [
        { poNo: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          Vendor: {
            select: { id: true, code: true, name: true },
          },
          _count: {
            select: { POItem: true, Inbound: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.purchaseOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      purchaseOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create purchase order
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, expectedDate, remarks, items } = body;

    if (!vendorId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Vendor and items are required" },
        { status: 400 }
      );
    }

    // Validate vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const processedItems = items.map((item: {
      skuId: string;
      orderedQty: number;
      unitPrice: number;
      taxRate?: number;
    }) => {
      const itemTotal = item.orderedQty * item.unitPrice;
      const itemTax = itemTotal * ((item.taxRate || 0) / 100);
      subtotal += itemTotal;
      taxAmount += itemTax;

      return {
        skuId: item.skuId,
        orderedQty: item.orderedQty,
        unitPrice: item.unitPrice,
        taxAmount: itemTax,
        totalPrice: itemTotal + itemTax,
      };
    });

    const totalAmount = subtotal + taxAmount;
    const poNo = await generatePONumber();

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNo,
        vendorId,
        status: "DRAFT",
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        remarks,
        subtotal,
        taxAmount,
        totalAmount,
        POItem: {
          create: processedItems,
        },
      },
      include: {
        Vendor: true,
        POItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json(purchaseOrder, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json(
      { error: "Failed to create purchase order" },
      { status: 500 }
    );
  }
}
