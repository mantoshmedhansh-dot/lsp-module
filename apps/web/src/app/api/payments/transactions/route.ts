import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import crypto from "crypto";

// GET - List payment transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentGatewayId = searchParams.get("paymentGatewayId");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (paymentGatewayId) where.paymentGatewayId = paymentGatewayId;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include: {
          paymentGateway: {
            select: { id: true, gatewayName: true, displayName: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    // Get summary by status
    const [pending, processing, completed, failed, refunded] = await Promise.all([
      prisma.paymentTransaction.count({ where: { ...where, status: "PENDING" } }),
      prisma.paymentTransaction.count({ where: { ...where, status: "PROCESSING" } }),
      prisma.paymentTransaction.count({ where: { ...where, status: "SUCCESS" } }),
      prisma.paymentTransaction.count({ where: { ...where, status: "FAILED" } }),
      prisma.paymentTransaction.count({ where: { ...where, status: "REFUNDED" } }),
    ]);

    // Calculate totals
    const totals = await prisma.paymentTransaction.aggregate({
      where: { ...where, status: "SUCCESS" },
      _sum: { amount: true, convenienceFee: true, gstOnFee: true, totalAmount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary: { pending, processing, completed, failed, refunded },
        totals: {
          amount: totals._sum?.amount || 0,
          fees: totals._sum?.convenienceFee || 0,
          tax: totals._sum?.gstOnFee || 0,
          settled: totals._sum?.totalAmount || 0,
          count: totals._count,
        },
      },
    });
  } catch (error) {
    console.error("Payment Transaction GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST - Initiate payment transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentGatewayId,
      invoiceId,
      referenceType = "INVOICE",
      referenceId,
      amount,
      currency = "INR",
      paymentMethod = "UPI",
      customerName,
      customerEmail,
      customerPhone,
      notes,
    } = body;

    // Validate required fields
    if (!paymentGatewayId || !amount || !customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { success: false, error: "Gateway ID, amount, and customer details are required" },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Get gateway configuration
    const gateway = await prisma.paymentGateway.findUnique({
      where: { id: paymentGatewayId },
    });

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: "Payment gateway not found" },
        { status: 404 }
      );
    }

    if (!gateway.isActive) {
      return NextResponse.json(
        { success: false, error: "Payment gateway is not active" },
        { status: 400 }
      );
    }

    // Check amount limits
    if (amount < gateway.minimumAmount || amount > gateway.maximumAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount must be between Rs. ${gateway.minimumAmount} and Rs. ${gateway.maximumAmount}`,
        },
        { status: 400 }
      );
    }

    // Calculate fees
    const convenienceFee = (amount * gateway.transactionFeePercent) / 100 + gateway.flatFeePerTxn;
    const gstOnFee = convenienceFee * 0.18; // 18% GST on payment gateway fees
    const totalAmount = amount + convenienceFee + gstOnFee;

    // Generate transaction ID
    const transactionId = `TXN${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const orderId = `ORD${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Create transaction
    const transaction = await prisma.paymentTransaction.create({
      data: {
        paymentGatewayId,
        transactionId,
        gatewayOrderId: orderId,
        orderId,
        invoiceId,
        referenceType,
        referenceId: referenceId || invoiceId || orderId,
        amount,
        currency,
        convenienceFee,
        gstOnFee,
        totalAmount,
        paymentMethod,
        status: "INITIATED",
        customerName,
        customerEmail,
        customerPhone,
        notes,
      },
    });

    // Generate payment link (simulated - in production, call gateway API)
    let paymentUrl = "";
    let gatewayOrderId = "";

    if (gateway.gatewayType === "RAZORPAY") {
      gatewayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      paymentUrl = `https://checkout.razorpay.com/v1/checkout.js?order_id=${gatewayOrderId}`;
    } else if (gateway.gatewayType === "PAYU") {
      gatewayOrderId = `PAYU${Date.now()}`;
      paymentUrl = `${gateway.mode === "LIVE" ? "https://secure.payu.in" : "https://sandboxsecure.payu.in"}/_payment`;
    } else if (gateway.gatewayType === "PHONEPE") {
      gatewayOrderId = `PP${Date.now()}`;
      paymentUrl = `https://mercury-t2.phonepe.com/transact/pg`;
    }

    // Update with gateway order ID
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        gatewayOrderId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...transaction,
        gatewayOrderId,
        paymentUrl,
        gatewayConfig: {
          type: gateway.gatewayType,
          mode: gateway.mode,
          merchantId: gateway.merchantId,
        },
      },
      message: "Payment initiated successfully",
    });
  } catch (error) {
    console.error("Payment Transaction POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate payment" },
      { status: 500 }
    );
  }
}

// PATCH - Update transaction status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, transactionId: txnId, ...data } = body;

    // Find transaction
    const whereClause = id ? { id } : txnId ? { transactionId: txnId } : null;
    if (!whereClause) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    const transaction = await prisma.paymentTransaction.findFirst({
      where: whereClause,
      include: { paymentGateway: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (action === "VERIFY") {
      // Verify payment status with gateway (simulated)
      const isSuccess = Math.random() > 0.1; // 90% success rate for simulation

      const updated = await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: isSuccess ? "SUCCESS" : "FAILED",
          statusCode: isSuccess ? "00" : "99",
          statusMessage: isSuccess ? "Payment successful" : "Payment failed",
          gatewayPaymentId: isSuccess ? `pay_${crypto.randomBytes(8).toString("hex")}` : null,
          completedAt: isSuccess ? new Date() : null,
          failureReason: isSuccess ? null : "Payment verification failed",
          failedAt: isSuccess ? null : new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: isSuccess ? "Payment verified successfully" : "Payment verification failed",
      });
    }

    if (action === "REFUND") {
      if (transaction.status !== "SUCCESS") {
        return NextResponse.json(
          { success: false, error: "Can only refund successful transactions" },
          { status: 400 }
        );
      }

      const { refundAmount, reason } = data;
      const amountToRefund = refundAmount || transaction.amount;

      if (amountToRefund > transaction.amount) {
        return NextResponse.json(
          { success: false, error: "Refund amount cannot exceed transaction amount" },
          { status: 400 }
        );
      }

      const refundId = `REF${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      const updated = await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: amountToRefund === transaction.amount ? "REFUNDED" : "PARTIAL_REFUND",
          refundId,
          refundAmount: amountToRefund,
          refundReason: reason,
          refundedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Refund of Rs. ${amountToRefund} initiated`,
      });
    }

    if (action === "CANCEL") {
      if (!["INITIATED", "PENDING"].includes(transaction.status)) {
        return NextResponse.json(
          { success: false, error: "Can only cancel pending transactions" },
          { status: 400 }
        );
      }

      const updated = await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "CANCELLED",
          failureReason: data.reason || "Cancelled by user",
          failedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Transaction cancelled",
      });
    }

    // Update gateway response
    if (data.gatewayPaymentId) {
      const updated = await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          gatewayPaymentId: data.gatewayPaymentId,
          statusCode: data.statusCode,
          statusMessage: data.statusMessage,
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Transaction updated",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Payment Transaction PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
