import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";
import { createCreditTransaction, checkCredit } from "@/lib/services/credit-service";

// GET /api/credit - Get credit overview / transactions
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Get transactions
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = customerId;
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.b2BCreditTransaction.findMany({
        where,
        include: {
          Customer: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.b2BCreditTransaction.count({ where }),
    ]);

    // Get credit summary
    const creditEnabledCustomers = await prisma.customer.count({
      where: { creditEnabled: true },
    });

    const creditStats = await prisma.customer.aggregate({
      where: { creditEnabled: true },
      _sum: {
        creditLimit: true,
        creditUsed: true,
        creditAvailable: true,
      },
    });

    const overdueCustomers = await prisma.customer.count({
      where: {
        creditEnabled: true,
        creditStatus: { in: ["EXCEEDED", "ON_HOLD", "BLOCKED"] },
      },
    });

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        creditEnabledCustomers,
        totalCreditLimit: Number(creditStats._sum.creditLimit || 0),
        totalCreditUsed: Number(creditStats._sum.creditUsed || 0),
        totalCreditAvailable: Number(creditStats._sum.creditAvailable || 0),
        overdueCustomers,
        utilizationPercent:
          creditStats._sum.creditLimit && Number(creditStats._sum.creditLimit) > 0
            ? Math.round(
                (Number(creditStats._sum.creditUsed || 0) /
                  Number(creditStats._sum.creditLimit)) *
                  100
              )
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching credit data:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit data" },
      { status: 500 }
    );
  }
}

// POST /api/credit - Create credit transaction
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
    const { customerId, type, amount, orderId, paymentRef, invoiceNo, dueDate, remarks } =
      body;

    if (!customerId || !type || amount === undefined) {
      return NextResponse.json(
        { error: "customerId, type, and amount are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["ORDER_DEBIT", "PAYMENT_CREDIT", "ADJUSTMENT", "REFUND", "WRITE_OFF", "INTEREST_DEBIT", "PAYMENT", "ORDER", "CREDIT_NOTE"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // For order debit, check credit first
    if (type === "ORDER_DEBIT") {
      const creditCheck = await checkCredit(customerId, amount);
      if (!creditCheck.canProceed) {
        return NextResponse.json(
          { error: creditCheck.reason || "Credit check failed" },
          { status: 400 }
        );
      }
    }

    const result = await createCreditTransaction({
      customerId,
      type,
      amount: parseFloat(amount),
      orderId,
      paymentRef,
      invoiceNo,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      remarks,
      createdById: session.user.id!,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating credit transaction:", error);
    return NextResponse.json(
      { error: "Failed to create credit transaction" },
      { status: 500 }
    );
  }
}
