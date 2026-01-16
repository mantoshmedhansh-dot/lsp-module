import { NextRequest, NextResponse } from "next/server";
import { prisma, CODReconciliationStatus, CODTransactionType } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/cod-reconciliation - List COD reconciliations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const transporterId = searchParams.get("transporterId") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status as CODReconciliationStatus;
    }

    if (transporterId) {
      where.transporterId = transporterId;
    }

    if (fromDate || toDate) {
      where.reconciliationDate = {};
      if (fromDate) {
        (where.reconciliationDate as Record<string, Date>).gte = new Date(fromDate);
      }
      if (toDate) {
        (where.reconciliationDate as Record<string, Date>).lte = new Date(toDate);
      }
    }

    const [reconciliations, total] = await Promise.all([
      prisma.cODReconciliation.findMany({
        where,
        include: {
          _count: { select: { CODTransaction: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.cODReconciliation.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.cODReconciliation.aggregate({
      where,
      _sum: {
        expectedAmount: true,
        collectedAmount: true,
        remittedAmount: true,
        variance: true,
      },
      _count: { _all: true },
    });

    return NextResponse.json({
      data: reconciliations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalExpected: stats._sum?.expectedAmount || 0,
        totalCollected: stats._sum?.collectedAmount || 0,
        totalRemitted: stats._sum?.remittedAmount || 0,
        totalVariance: stats._sum?.variance || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching COD reconciliations:", error);
    return NextResponse.json(
      { error: "Failed to fetch COD reconciliations" },
      { status: 500 }
    );
  }
}

// POST /api/cod-reconciliation - Create COD reconciliation
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
    const {
      transporterId,
      locationId,
      companyId,
      reconciliationDate,
      periodFrom,
      periodTo,
      deliveryIds,
      remarks,
    } = body;

    if (!locationId || !companyId || !deliveryIds || !Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      return NextResponse.json(
        { error: "Location, company, and delivery IDs are required" },
        { status: 400 }
      );
    }

    // Get deliveries with COD amounts
    const deliveries = await prisma.delivery.findMany({
      where: {
        id: { in: deliveryIds },
        transporterId,
        Order: {
          paymentMode: "COD",
        },
      },
      include: {
        Order: {
          select: {
            id: true,
            orderNo: true,
            totalAmount: true,
            codCharges: true,
          },
        },
      },
    });

    if (deliveries.length === 0) {
      return NextResponse.json(
        { error: "No valid COD deliveries found" },
        { status: 400 }
      );
    }

    // Calculate expected amount
    const expectedAmount = deliveries.reduce((sum, d) => {
      return sum + (d.Order.totalAmount?.toNumber() || 0);
    }, 0);

    // Generate reconciliation number
    const sequence = await prisma.sequence.upsert({
      where: { name: "cod_reconciliation" },
      update: { currentValue: { increment: 1 } },
      create: { name: "cod_reconciliation", prefix: "COD", currentValue: 1 },
    });

    const reconciliationNo = `COD${String(sequence.currentValue).padStart(6, "0")}`;

    const now = new Date();
    const defaultPeriodFrom = periodFrom ? new Date(periodFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultPeriodTo = periodTo ? new Date(periodTo) : now;

    // Create reconciliation with transactions
    const reconciliation = await prisma.cODReconciliation.create({
      data: {
        reconciliationNo,
        transporterId,
        locationId,
        companyId,
        reconciliationDate: reconciliationDate ? new Date(reconciliationDate) : now,
        periodFrom: defaultPeriodFrom,
        periodTo: defaultPeriodTo,
        expectedAmount,
        collectedAmount: 0,
        remittedAmount: 0,
        variance: -expectedAmount,
        totalOrders: deliveries.length,
        deliveredOrders: deliveries.length,
        pendingOrders: 0,
        remarks,
        CODTransaction: {
          create: deliveries.map((d, idx) => ({
            transactionNo: `${reconciliationNo}-${String(idx + 1).padStart(3, "0")}`,
            deliveryId: d.id,
            orderId: d.Order.id,
            awbNo: d.awbNo,
            amount: d.Order.totalAmount?.toNumber() || 0,
            type: "COLLECTION" as CODTransactionType,
            transactionDate: now,
          })),
        },
      },
      include: {
        CODTransaction: true,
        _count: { select: { CODTransaction: true } },
      },
    });

    return NextResponse.json(reconciliation, { status: 201 });
  } catch (error) {
    console.error("Error creating COD reconciliation:", error);
    return NextResponse.json(
      { error: "Failed to create COD reconciliation" },
      { status: 500 }
    );
  }
}
