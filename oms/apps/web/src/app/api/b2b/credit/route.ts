import { NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/b2b/credit - Get B2B customer credit information
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: "B2B customer account not found" },
        { status: 404 }
      );
    }

    // Get recent transactions
    const transactions = await prisma.creditTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Calculate overdue amount (orders with payment terms past due)
    const overdueOrders = await prisma.order.findMany({
      where: {
        customerId: customer.id,
        paymentMode: "CREDIT",
        paymentStatus: { in: ["PENDING", "PARTIAL"] },
        createdAt: {
          lt: new Date(Date.now() - getDaysFromPaymentTerms(customer.paymentTerms || "NET_30") * 24 * 60 * 60 * 1000),
        },
      },
      select: { totalAmount: true },
    });

    const overdueAmount = overdueOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0
    );

    // Get last payment
    const lastPayment = await prisma.creditTransaction.findFirst({
      where: {
        customerId: customer.id,
        type: "PAYMENT",
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      credit: {
        creditLimit: Number(customer.creditLimit || 0),
        creditUsed: Number(customer.creditUsed || 0),
        creditAvailable: Number(customer.creditAvailable || 0),
        status: customer.creditStatus || "AVAILABLE",
        paymentTerms: customer.paymentTerms || "NET_30",
        overdueAmount,
        lastPaymentDate: lastPayment?.createdAt.toISOString().split("T")[0] || null,
        lastPaymentAmount: lastPayment ? Number(lastPayment.amount) : 0,
      },
      transactions: transactions.map((txn) => ({
        id: txn.id,
        date: txn.createdAt.toISOString().split("T")[0],
        type: txn.type,
        reference: txn.reference,
        amount: txn.type === "PAYMENT" || txn.type === "CREDIT_NOTE"
          ? Number(txn.amount)
          : -Number(txn.amount),
        balance: Number(txn.balanceAfter),
      })),
    });
  } catch (error) {
    console.error("Error fetching B2B credit:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit information" },
      { status: 500 }
    );
  }
}

function getDaysFromPaymentTerms(terms: string): number {
  const termMap: Record<string, number> = {
    IMMEDIATE: 0,
    NET_7: 7,
    NET_15: 15,
    NET_30: 30,
    NET_45: 45,
    NET_60: 60,
    NET_90: 90,
  };
  return termMap[terms] || 30;
}
