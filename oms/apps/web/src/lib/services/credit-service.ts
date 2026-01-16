import { prisma } from "@oms/database";

export interface CreditCheckResult {
  customerId: string;
  customerName: string;
  creditEnabled: boolean;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
  orderAmount: number;
  canProceed: boolean;
  reason?: string;
  newCreditUsed?: number;
  newCreditAvailable?: number;
}

export interface CreditTransactionInput {
  customerId: string;
  type: "ORDER_DEBIT" | "PAYMENT_CREDIT" | "ADJUSTMENT" | "REFUND" | "WRITE_OFF" | "INTEREST_DEBIT" | "PAYMENT" | "ORDER" | "CREDIT_NOTE";
  amount: number;
  orderId?: string;
  quotationId?: string;
  paymentRef?: string;
  invoiceNo?: string;
  dueDate?: Date;
  remarks?: string;
  createdById: string;
}

// Generate unique transaction number
function generateTransactionNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CRT-${timestamp}-${random}`;
}

// Check if customer has sufficient credit for an order
export async function checkCredit(
  customerId: string,
  orderAmount: number
): Promise<CreditCheckResult> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      creditEnabled: true,
      creditLimit: true,
      creditUsed: true,
      creditAvailable: true,
      creditStatus: true,
    },
  });

  if (!customer) {
    return {
      customerId,
      customerName: "Unknown",
      creditEnabled: false,
      creditLimit: 0,
      creditUsed: 0,
      creditAvailable: 0,
      creditStatus: "BLOCKED",
      orderAmount,
      canProceed: false,
      reason: "Customer not found",
    };
  }

  const creditLimit = Number(customer.creditLimit);
  const creditUsed = Number(customer.creditUsed);
  const creditAvailable = Number(customer.creditAvailable);

  // Credit not enabled - must pay upfront
  if (!customer.creditEnabled) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      creditEnabled: false,
      creditLimit,
      creditUsed,
      creditAvailable,
      creditStatus: customer.creditStatus,
      orderAmount,
      canProceed: true, // Can proceed but will require payment
      reason: "Credit not enabled - payment required",
    };
  }

  // Check credit status
  if (customer.creditStatus === "BLOCKED" || customer.creditStatus === "ON_HOLD") {
    return {
      customerId: customer.id,
      customerName: customer.name,
      creditEnabled: true,
      creditLimit,
      creditUsed,
      creditAvailable,
      creditStatus: customer.creditStatus,
      orderAmount,
      canProceed: false,
      reason: `Credit is ${customer.creditStatus.toLowerCase()}`,
    };
  }

  // Check available credit
  const newCreditUsed = creditUsed + orderAmount;
  const newCreditAvailable = creditLimit - newCreditUsed;

  if (orderAmount > creditAvailable) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      creditEnabled: true,
      creditLimit,
      creditUsed,
      creditAvailable,
      creditStatus: customer.creditStatus,
      orderAmount,
      canProceed: false,
      reason: `Insufficient credit. Available: ${creditAvailable.toFixed(2)}, Required: ${orderAmount.toFixed(2)}`,
      newCreditUsed,
      newCreditAvailable,
    };
  }

  return {
    customerId: customer.id,
    customerName: customer.name,
    creditEnabled: true,
    creditLimit,
    creditUsed,
    creditAvailable,
    creditStatus: customer.creditStatus,
    orderAmount,
    canProceed: true,
    newCreditUsed,
    newCreditAvailable,
  };
}

// Create a credit transaction and update customer balance
export async function createCreditTransaction(
  input: CreditTransactionInput
): Promise<{ success: boolean; transaction?: unknown; error?: string }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get customer's current credit state
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: {
          id: true,
          creditEnabled: true,
          creditLimit: true,
          creditUsed: true,
          creditAvailable: true,
          creditStatus: true,
        },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      const creditLimit = Number(customer.creditLimit);
      const creditUsed = Number(customer.creditUsed);
      const creditAvailable = Number(customer.creditAvailable);

      let newCreditUsed: number;
      let newCreditAvailable: number;
      let newCreditStatus = customer.creditStatus;

      // Calculate new balances based on transaction type
      switch (input.type) {
        case "ORDER_DEBIT":
        case "ORDER":
        case "INTEREST_DEBIT":
          // Using credit for an order or interest charge
          newCreditUsed = creditUsed + input.amount;
          newCreditAvailable = creditLimit - newCreditUsed;
          break;

        case "PAYMENT":
        case "PAYMENT_CREDIT":
        case "CREDIT_NOTE":
        case "REFUND":
        case "WRITE_OFF":
          // Reducing credit used (payments, credits, refunds, write-offs)
          newCreditUsed = Math.max(0, creditUsed - input.amount);
          newCreditAvailable = creditLimit - newCreditUsed;
          break;

        case "ADJUSTMENT":
          // Direct adjustment (can be positive or negative)
          newCreditUsed = creditUsed + input.amount;
          newCreditAvailable = creditLimit - newCreditUsed;
          break;

        default:
          throw new Error("Invalid transaction type");
      }

      // Validate new balances
      if (newCreditUsed < 0) {
        throw new Error("Credit used cannot be negative");
      }

      if (input.type === "ORDER_DEBIT" && newCreditAvailable < 0) {
        throw new Error("Insufficient credit available");
      }

      // Update credit status based on usage
      if (newCreditUsed > creditLimit) {
        newCreditStatus = "EXCEEDED";
      } else if (newCreditAvailable <= 0) {
        newCreditStatus = "EXCEEDED";
      } else if (newCreditStatus === "EXCEEDED" && newCreditAvailable > 0) {
        newCreditStatus = "AVAILABLE";
      }

      // Create transaction record
      const transaction = await tx.b2BCreditTransaction.create({
        data: {
          transactionNo: generateTransactionNo(),
          type: input.type,
          customerId: input.customerId,
          amount: input.amount,
          balanceBefore: creditUsed,
          balanceAfter: newCreditUsed,
          orderId: input.orderId,
          quotationId: input.quotationId,
          paymentRef: input.paymentRef,
          invoiceNo: input.invoiceNo,
          dueDate: input.dueDate,
          remarks: input.remarks,
          createdById: input.createdById,
        },
      });

      // Update customer credit
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          creditUsed: newCreditUsed,
          creditAvailable: newCreditAvailable,
          creditStatus: newCreditStatus,
        },
      });

      return transaction;
    });

    return { success: true, transaction: result };
  } catch (error) {
    console.error("Credit transaction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

// Get customer credit summary
export async function getCustomerCreditSummary(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      code: true,
      name: true,
      creditEnabled: true,
      creditLimit: true,
      creditUsed: true,
      creditAvailable: true,
      creditStatus: true,
      paymentTermType: true,
      paymentTermDays: true,
      dunningEnabled: true,
      dunningLevel: true,
      lastDunningDate: true,
    },
  });

  if (!customer) return null;

  // Get recent transactions
  const transactions = await prisma.b2BCreditTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Get aging buckets
  const overdueTransactions = await prisma.b2BCreditTransaction.findMany({
    where: {
      customerId,
      type: "ORDER_DEBIT",
      dueDate: { lt: new Date() },
    },
    select: {
      amount: true,
      dueDate: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const aging = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };

  for (const tx of overdueTransactions) {
    if (!tx.dueDate) continue;
    const daysOverdue = Math.floor(
      (now.getTime() - tx.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const amount = Number(tx.amount);

    if (daysOverdue <= 0) {
      aging.current += amount;
    } else if (daysOverdue <= 30) {
      aging.days1to30 += amount;
    } else if (daysOverdue <= 60) {
      aging.days31to60 += amount;
    } else if (daysOverdue <= 90) {
      aging.days61to90 += amount;
    } else {
      aging.over90 += amount;
    }
  }

  return {
    customer: {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      creditUsed: Number(customer.creditUsed),
      creditAvailable: Number(customer.creditAvailable),
    },
    transactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
    })),
    aging,
    totalOverdue: aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.over90,
  };
}

// Update customer credit limit
export async function updateCreditLimit(
  customerId: string,
  newLimit: number,
  updatedById: string,
  remarks?: string
) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { creditLimit: true, creditUsed: true },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const creditUsed = Number(customer.creditUsed);
    const newAvailable = newLimit - creditUsed;
    const newStatus = newAvailable < 0 ? "EXCEEDED" : "AVAILABLE";

    // Create adjustment transaction for audit
    await tx.b2BCreditTransaction.create({
      data: {
        transactionNo: generateTransactionNo(),
        type: "ADJUSTMENT",
        customerId,
        amount: 0, // No balance change, just limit change
        balanceBefore: creditUsed,
        balanceAfter: creditUsed,
        remarks: remarks || `Credit limit changed from ${customer.creditLimit} to ${newLimit}`,
        createdById: updatedById,
      },
    });

    // Update customer
    return tx.customer.update({
      where: { id: customerId },
      data: {
        creditLimit: newLimit,
        creditAvailable: newAvailable,
        creditStatus: newStatus,
      },
    });
  });
}
