import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// Helper to generate inbound number
async function generateInboundNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "inbound" },
    update: { currentValue: { increment: 1 } },
    create: { name: "inbound", prefix: "IN", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "IN"}${paddedNumber}`;
}

// Helper to generate GRN number
async function generateGRNNumber(): Promise<string> {
  const sequence = await prisma.sequence.upsert({
    where: { name: "grn" },
    update: { currentValue: { increment: 1 } },
    create: { name: "grn", prefix: "GRN", currentValue: 1, paddingLength: 6 },
  });

  const paddedNumber = String(sequence.currentValue).padStart(sequence.paddingLength, "0");
  return `${sequence.prefix || "GRN"}${paddedNumber}`;
}

// GET /api/inbounds - List inbounds
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
    const locationId = searchParams.get("locationId") || "";
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

    // Filter by location access
    if (locationId) {
      where.locationId = locationId;
    } else if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    if (search) {
      where.OR = [
        { inboundNo: { contains: search, mode: "insensitive" } },
        { grnNo: { contains: search, mode: "insensitive" } },
        { purchaseOrder: { poNo: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [inbounds, total] = await Promise.all([
      prisma.inbound.findMany({
        where,
        include: {
          Location: {
            select: { id: true, code: true, name: true },
          },
          User: {
            select: { id: true, name: true },
          },
          PurchaseOrder: {
            select: {
              id: true,
              poNo: true,
              Vendor: { select: { id: true, code: true, name: true } },
            },
          },
          _count: {
            select: { InboundItem: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inbound.count({ where }),
    ]);

    // Get status and type counts
    const [statusCounts, typeCounts] = await Promise.all([
      prisma.inbound.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.inbound.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
    ]);

    const statusCountMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    const typeCountMap = typeCounts.reduce(
      (acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      inbounds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statusCounts: statusCountMap,
      typeCounts: typeCountMap,
    });
  } catch (error) {
    console.error("Error fetching inbounds:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbounds" },
      { status: 500 }
    );
  }
}

// POST /api/inbounds - Create inbound
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, purchaseOrderId, locationId, remarks, items } = body;

    if (!type || !locationId) {
      return NextResponse.json(
        { error: "Type and location are required" },
        { status: 400 }
      );
    }

    // Validate PO if provided
    let purchaseOrder = null;
    if (purchaseOrderId) {
      purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { POItem: true },
      });

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: "Purchase order not found" },
          { status: 404 }
        );
      }

      if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status)) {
        return NextResponse.json(
          { error: "Purchase order is not available for receiving" },
          { status: 400 }
        );
      }
    }

    const inboundNo = await generateInboundNumber();
    const grnNo = await generateGRNNumber();

    // Prepare items
    let inboundItems = items;
    if (!items || items.length === 0) {
      // If no items provided and PO exists, use PO items
      if (purchaseOrder) {
        inboundItems = purchaseOrder.POItem.map((item) => ({
          skuId: item.skuId,
          expectedQty: item.orderedQty - item.receivedQty,
          receivedQty: 0,
        }));
      } else {
        return NextResponse.json(
          { error: "Items are required" },
          { status: 400 }
        );
      }
    }

    const inbound = await prisma.inbound.create({
      data: {
        inboundNo,
        type,
        status: "PENDING",
        purchaseOrderId,
        locationId,
        receivedById: session.user.id!,
        grnNo,
        remarks,
        InboundItem: {
          create: inboundItems.map((item: {
            skuId: string;
            expectedQty?: number;
            receivedQty: number;
            batchNo?: string;
            expiryDate?: string;
            mfgDate?: string;
            mrp?: number;
            serialNumbers?: string[];
          }) => ({
            skuId: item.skuId,
            expectedQty: item.expectedQty,
            receivedQty: item.receivedQty || 0,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
            mrp: item.mrp,
            serialNumbers: item.serialNumbers || [],
          })),
        },
      },
      include: {
        Location: true,
        User: { select: { id: true, name: true } },
        PurchaseOrder: {
          include: {
            Vendor: { select: { id: true, code: true, name: true } },
          },
        },
        InboundItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true, barcodes: true },
            },
          },
        },
      },
    });

    return NextResponse.json(inbound, { status: 201 });
  } catch (error) {
    console.error("Error creating inbound:", error);
    return NextResponse.json(
      { error: "Failed to create inbound" },
      { status: 500 }
    );
  }
}
