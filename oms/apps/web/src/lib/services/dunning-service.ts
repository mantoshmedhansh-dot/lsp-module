import { prisma } from "@oms/database";

export interface DunningConfig {
  levels: number[];  // Days overdue for each level [7, 15, 30]
  actions: {
    level: number;
    action: "EMAIL" | "SMS" | "BLOCK_ORDERS" | "CREDIT_HOLD";
    template?: string;
  }[];
}

export interface OverdueCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  email: string | null;
  phone: string;
  totalOverdue: number;
  oldestDueDate: Date;
  daysOverdue: number;
  dunningLevel: number;
  lastDunningDate: Date | null;
  transactions: {
    id: string;
    invoiceNo: string | null;
    amount: number;
    dueDate: Date;
    daysOverdue: number;
  }[];
}

// Get all customers with overdue payments
export async function getOverdueCustomers(): Promise<OverdueCustomer[]> {
  const now = new Date();

  // Get customers with credit and dunning enabled
  const customers = await prisma.customer.findMany({
    where: {
      creditEnabled: true,
      dunningEnabled: true,
      creditUsed: { gt: 0 },
    },
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      dunningLevel: true,
      lastDunningDate: true,
      dunningDays: true,
    },
  });

  const overdueCustomers: OverdueCustomer[] = [];

  for (const customer of customers) {
    // Get overdue transactions
    const transactions = await prisma.b2BCreditTransaction.findMany({
      where: {
        customerId: customer.id,
        type: "ORDER_DEBIT",
        dueDate: { lt: now },
      },
      select: {
        id: true,
        invoiceNo: true,
        amount: true,
        dueDate: true,
      },
    });

    if (transactions.length === 0) continue;

    // Calculate totals and days overdue
    let totalOverdue = 0;
    let oldestDueDate = now;

    const enrichedTransactions = transactions
      .filter((tx) => tx.dueDate)
      .map((tx) => {
        const dueDate = tx.dueDate!;
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalOverdue += Number(tx.amount);
        if (dueDate < oldestDueDate) oldestDueDate = dueDate;

        return {
          id: tx.id,
          invoiceNo: tx.invoiceNo,
          amount: Number(tx.amount),
          dueDate,
          daysOverdue,
        };
      })
      .filter((tx) => tx.daysOverdue > 0);

    if (enrichedTransactions.length === 0) continue;

    const maxDaysOverdue = Math.max(...enrichedTransactions.map((t) => t.daysOverdue));

    overdueCustomers.push({
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      totalOverdue,
      oldestDueDate,
      daysOverdue: maxDaysOverdue,
      dunningLevel: customer.dunningLevel,
      lastDunningDate: customer.lastDunningDate,
      transactions: enrichedTransactions,
    });
  }

  // Sort by days overdue descending
  overdueCustomers.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return overdueCustomers;
}

// Calculate dunning level based on days overdue
export function calculateDunningLevel(
  daysOverdue: number,
  dunningDays: number[] = [7, 15, 30]
): number {
  let level = 0;
  for (let i = 0; i < dunningDays.length; i++) {
    if (daysOverdue >= dunningDays[i]) {
      level = i + 1;
    }
  }
  return level;
}

// Process dunning for a customer
export async function processDunning(
  customerId: string,
  action: "NOTIFY" | "ESCALATE" | "BLOCK"
): Promise<{ success: boolean; message: string; newLevel?: number }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dunningLevel: true,
        dunningDays: true,
        creditStatus: true,
      },
    });

    if (!customer) {
      return { success: false, message: "Customer not found" };
    }

    const overdueCustomers = await getOverdueCustomers();
    const overdueData = overdueCustomers.find((c) => c.customerId === customerId);

    if (!overdueData) {
      return { success: false, message: "No overdue amounts found" };
    }

    const newLevel = calculateDunningLevel(
      overdueData.daysOverdue,
      customer.dunningDays
    );

    switch (action) {
      case "NOTIFY":
        // In production, this would send email/SMS
        console.log(
          `[DUNNING] Notifying ${customer.name} (${customer.email || customer.phone}) about ${overdueData.totalOverdue} overdue`
        );
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            lastDunningDate: new Date(),
            dunningLevel: newLevel,
          },
        });
        return {
          success: true,
          message: `Notification sent to ${customer.email || customer.phone}`,
          newLevel,
        };

      case "ESCALATE":
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            dunningLevel: Math.min(newLevel + 1, 5),
            lastDunningDate: new Date(),
          },
        });
        return {
          success: true,
          message: `Escalated to level ${newLevel + 1}`,
          newLevel: newLevel + 1,
        };

      case "BLOCK":
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            creditStatus: "BLOCKED",
            dunningLevel: 5,
            lastDunningDate: new Date(),
          },
        });
        return {
          success: true,
          message: "Customer credit blocked",
          newLevel: 5,
        };

      default:
        return { success: false, message: "Invalid action" };
    }
  } catch (error) {
    console.error("Dunning process error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Dunning process failed",
    };
  }
}

// Run automated dunning process
export async function runAutomatedDunning(): Promise<{
  processed: number;
  notified: number;
  escalated: number;
  blocked: number;
}> {
  const results = {
    processed: 0,
    notified: 0,
    escalated: 0,
    blocked: 0,
  };

  try {
    const overdueCustomers = await getOverdueCustomers();

    for (const customer of overdueCustomers) {
      results.processed++;

      // Get customer's dunning config
      const customerData = await prisma.customer.findUnique({
        where: { id: customer.customerId },
        select: {
          dunningDays: true,
          dunningLevel: true,
          lastDunningDate: true,
        },
      });

      if (!customerData) continue;

      const expectedLevel = calculateDunningLevel(
        customer.daysOverdue,
        customerData.dunningDays
      );

      // Check if we need to take action
      const daysSinceLastDunning = customerData.lastDunningDate
        ? Math.floor(
            (Date.now() - customerData.lastDunningDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 999;

      // Only act if 7+ days since last dunning action
      if (daysSinceLastDunning < 7) continue;

      if (expectedLevel > customerData.dunningLevel) {
        // Need to escalate
        if (expectedLevel >= 3) {
          await processDunning(customer.customerId, "BLOCK");
          results.blocked++;
        } else {
          await processDunning(customer.customerId, "ESCALATE");
          results.escalated++;
        }
      } else {
        // Send reminder
        await processDunning(customer.customerId, "NOTIFY");
        results.notified++;
      }
    }

    return results;
  } catch (error) {
    console.error("Automated dunning error:", error);
    return results;
  }
}

// Get dunning summary
export async function getDunningSummary() {
  const overdueCustomers = await getOverdueCustomers();

  const summary = {
    totalOverdueCustomers: overdueCustomers.length,
    totalOverdueAmount: overdueCustomers.reduce((sum, c) => sum + c.totalOverdue, 0),
    byLevel: {
      level0: overdueCustomers.filter((c) => c.dunningLevel === 0).length,
      level1: overdueCustomers.filter((c) => c.dunningLevel === 1).length,
      level2: overdueCustomers.filter((c) => c.dunningLevel === 2).length,
      level3Plus: overdueCustomers.filter((c) => c.dunningLevel >= 3).length,
    },
    byAging: {
      days1to30: overdueCustomers.filter((c) => c.daysOverdue <= 30).length,
      days31to60: overdueCustomers.filter(
        (c) => c.daysOverdue > 30 && c.daysOverdue <= 60
      ).length,
      days61to90: overdueCustomers.filter(
        (c) => c.daysOverdue > 60 && c.daysOverdue <= 90
      ).length,
      over90: overdueCustomers.filter((c) => c.daysOverdue > 90).length,
    },
  };

  return {
    summary,
    customers: overdueCustomers.slice(0, 50), // Top 50 overdue
  };
}
