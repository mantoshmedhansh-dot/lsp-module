import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate return number
async function generateReturnNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "return" },
    update: { currentValue: { increment: 1 } },
    create: { name: "return", prefix: "RET", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "RET"}${paddedNumber}`;
}

// GET /api/returns - List returns
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { returnNo: { contains: search, mode: "insensitive" } },
        { awbNo: { contains: search, mode: "insensitive" } },
        { Order_Return_orderIdToOrder: { orderNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.return.findMany({
        where,
        include: {
          Order_Return_orderIdToOrder: {
            select: {
              id: true,
              orderNo: true,
              customerName: true,
              channel: true,
            },
          },
          ReturnItem: {
            include: {
              Return: false,
            },
          },
          _count: {
            select: { ReturnItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.return.count({ where }),
    ]);

    // Get counts by type and status
    const [typeCounts, statusCounts] = await Promise.all([
      prisma.return.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
      prisma.return.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const typeCountMap = typeCounts.reduce(
      (acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      returns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      typeCounts: typeCountMap,
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching returns:", error);
    return NextResponse.json(
      { error: "Failed to fetch returns" },
      { status: 500 }
    );
  }
}

// POST /api/returns - Create return
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, orderId, awbNo, reason, remarks, items } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Return type is required" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    // Validate order if provided
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }

    const returnNo = await generateReturnNumber();

    const returnRecord = await prisma.return.create({
      data: {
        returnNo,
        type,
        status: "INITIATED",
        orderId,
        awbNo,
        reason,
        remarks,
        ReturnItem: {
          create: items.map((item: { skuId: string; quantity: number }) => ({
            skuId: item.skuId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        Order_Return_orderIdToOrder: {
          select: {
            id: true,
            orderNo: true,
            customerName: true,
          },
        },
        ReturnItem: true,
      },
    });

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (error) {
    console.error("Error creating return:", error);
    return NextResponse.json(
      { error: "Failed to create return" },
      { status: 500 }
    );
  }
}
