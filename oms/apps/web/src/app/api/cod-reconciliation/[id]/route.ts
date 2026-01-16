import { NextRequest, NextResponse } from "next/server";
import { prisma, CODReconciliationStatus, CODTransactionType } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/cod-reconciliation/[id] - Get reconciliation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const reconciliation = await prisma.cODReconciliation.findUnique({
      where: { id },
      include: {
        CODTransaction: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!reconciliation) {
      return NextResponse.json({ error: "Reconciliation not found" }, { status: 404 });
    }

    return NextResponse.json(reconciliation);
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reconciliation" },
      { status: 500 }
    );
  }
}

// PATCH /api/cod-reconciliation/[id] - Update reconciliation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, transactions, receivedAmount, remittanceNo, bankRef, remarks } = body;

    const reconciliation = await prisma.cODReconciliation.findUnique({
      where: { id },
      include: { CODTransaction: true },
    });

    if (!reconciliation) {
      return NextResponse.json({ error: "Reconciliation not found" }, { status: 404 });
    }

    switch (action) {
      case "update_collected": {
        // CODReconciliationStatus: PENDING, IN_PROGRESS, RECONCILED, DISPUTED, CLOSED
        if (["CLOSED", "DISPUTED"].includes(reconciliation.status)) {
          return NextResponse.json(
            { error: "Cannot update closed or disputed reconciliation" },
            { status: 400 }
          );
        }

        if (!transactions || !Array.isArray(transactions)) {
          return NextResponse.json(
            { error: "Transactions array is required" },
            { status: 400 }
          );
        }

        // Update transaction amounts
        let totalCollected = 0;
        for (const tx of transactions) {
          const { transactionId, amount: txAmount, remarks: txRemarks } = tx;

          const existingTx = reconciliation.CODTransaction.find((t) => t.id === transactionId);
          if (!existingTx) continue;

          await prisma.cODTransaction.update({
            where: { id: transactionId },
            data: {
              amount: txAmount,
              type: txAmount > 0 ? "COLLECTION" as CODTransactionType : "DEDUCTION" as CODTransactionType,
              remarks: txRemarks,
            },
          });

          totalCollected += txAmount;
        }

        const expectedAmount = reconciliation.expectedAmount.toNumber();
        const variance = totalCollected - expectedAmount;

        const updated = await prisma.cODReconciliation.update({
          where: { id },
          data: {
            collectedAmount: totalCollected,
            variance,
            status: variance === 0
              ? "RECONCILED" as CODReconciliationStatus
              : "IN_PROGRESS" as CODReconciliationStatus,
            remarks,
          },
          include: {
            CODTransaction: true,
          },
        });

        return NextResponse.json(updated);
      }

      case "approve": {
        if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!["RECONCILED", "IN_PROGRESS"].includes(reconciliation.status)) {
          return NextResponse.json(
            { error: "Reconciliation must be reconciled or in progress to approve" },
            { status: 400 }
          );
        }

        const updated = await prisma.cODReconciliation.update({
          where: { id },
          data: {
            status: "CLOSED" as CODReconciliationStatus,
            approvedBy: session.user.id,
            approvedAt: new Date(),
            remarks,
          },
        });

        return NextResponse.json(updated);
      }

      case "add_adjustment": {
        const { amount, reason } = body;

        if (amount === undefined || !reason) {
          return NextResponse.json(
            { error: "Amount and reason are required" },
            { status: 400 }
          );
        }

        // Generate transaction number
        const txCount = reconciliation.CODTransaction.length + 1;
        const transactionNo = `${reconciliation.reconciliationNo}-ADJ-${String(txCount).padStart(3, "0")}`;

        // Create adjustment transaction
        await prisma.cODTransaction.create({
          data: {
            transactionNo,
            reconciliationId: id,
            amount,
            type: amount > 0 ? "ADJUSTMENT" as CODTransactionType : "DEDUCTION" as CODTransactionType,
            remarks: reason,
            transactionDate: new Date(),
          },
        });

        // Recalculate totals
        const allTransactions = await prisma.cODTransaction.findMany({
          where: { reconciliationId: id },
        });

        const totalCollected = allTransactions.reduce(
          (sum, t) => sum + t.amount.toNumber(),
          0
        );
        const expectedAmount = reconciliation.expectedAmount.toNumber();

        const updated = await prisma.cODReconciliation.update({
          where: { id },
          data: {
            collectedAmount: totalCollected,
            variance: totalCollected - expectedAmount,
          },
          include: {
            CODTransaction: true,
          },
        });

        return NextResponse.json(updated);
      }

      case "dispute": {
        if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updated = await prisma.cODReconciliation.update({
          where: { id },
          data: {
            status: "DISPUTED" as CODReconciliationStatus,
            remarks,
          },
        });

        return NextResponse.json(updated);
      }

      default:
        // Simple field update
        const updateData: Record<string, unknown> = {};
        if (body.collectedAmount !== undefined) updateData.collectedAmount = body.collectedAmount;
        if (body.remittedAmount !== undefined) updateData.remittedAmount = body.remittedAmount;
        if (remarks !== undefined) updateData.remarks = remarks;

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const result = await prisma.cODReconciliation.update({
          where: { id },
          data: updateData,
        });

        return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Error updating reconciliation:", error);
    return NextResponse.json(
      { error: "Failed to update reconciliation" },
      { status: 500 }
    );
  }
}
