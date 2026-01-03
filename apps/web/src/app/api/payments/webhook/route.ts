import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import crypto from "crypto";

// Verify Razorpay signature
function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

// POST - Handle payment gateway webhooks
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gatewayId = searchParams.get("gatewayId");

    if (!gatewayId) {
      return NextResponse.json(
        { success: false, error: "Gateway ID is required" },
        { status: 400 }
      );
    }

    const gateway = await prisma.paymentGateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: "Gateway not found" },
        { status: 404 }
      );
    }

    const rawBody = await request.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch {
      // Handle form-encoded data (PayU style)
      body = Object.fromEntries(new URLSearchParams(rawBody));
    }

    // Log the webhook
    const webhookLog = await prisma.paymentWebhookLog.create({
      data: {
        paymentGatewayId: gatewayId,
        eventType: body.event || body.status || "UNKNOWN",
        eventId: body.id || body.event_id,
        payload: rawBody,
        status: "PROCESSING",
      },
    });

    let transaction = null;
    let updateData: any = {};
    let isValid = true;

    if (gateway.gatewayType === "RAZORPAY") {
      const event = body.event;
      const payload = body.payload?.payment?.entity;

      if (!payload) {
        await updateWebhookLog(webhookLog.id, "FAILED", "Invalid payload structure");
        return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
      }

      // Find transaction
      transaction = await prisma.paymentTransaction.findFirst({
        where: { gatewayOrderId: payload.order_id },
      });

      if (!transaction) {
        await updateWebhookLog(webhookLog.id, "FAILED", "Transaction not found");
        return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
      }

      // Verify signature
      const signature = request.headers.get("x-razorpay-signature");
      if (signature && gateway.webhookSecret) {
        const expectedSig = crypto
          .createHmac("sha256", gateway.webhookSecret)
          .update(rawBody)
          .digest("hex");
        isValid = expectedSig === signature;
      }

      // Process event
      switch (event) {
        case "payment.captured":
          updateData = {
            status: "SUCCESS",
            gatewayPaymentId: payload.id,
            statusCode: "00",
            statusMessage: "Payment captured",
            completedAt: new Date(),
          };
          break;
        case "payment.failed":
          updateData = {
            status: "FAILED",
            statusCode: payload.error_code,
            statusMessage: payload.error_description || "Payment failed",
            failureReason: payload.error_description || "Payment failed",
            failedAt: new Date(),
          };
          break;
        case "refund.created":
          const refundEntity = body.payload?.refund?.entity;
          updateData = {
            status: "REFUNDED",
            refundId: refundEntity?.id,
            refundAmount: refundEntity?.amount / 100,
            refundedAt: new Date(),
          };
          break;
      }

      await prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { transactionId: transaction.transactionId },
      });
    } else if (gateway.gatewayType === "PAYU") {
      // Find transaction by txnid
      transaction = await prisma.paymentTransaction.findFirst({
        where: { orderId: body.txnid },
      });

      if (!transaction) {
        await updateWebhookLog(webhookLog.id, "FAILED", "Transaction not found");
        return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
      }

      if (body.status === "success") {
        updateData = {
          status: "SUCCESS",
          gatewayPaymentId: body.mihpayid,
          statusCode: "00",
          statusMessage: "Payment successful",
          completedAt: new Date(),
        };
      } else {
        updateData = {
          status: "FAILED",
          statusCode: body.Error_code,
          statusMessage: body.Error_Message || "Payment failed",
          failureReason: body.Error_Message || "Payment failed",
          failedAt: new Date(),
        };
      }

      await prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { transactionId: transaction.transactionId },
      });
    } else if (gateway.gatewayType === "PHONEPE") {
      const decodedResponse = body.response
        ? Buffer.from(body.response, "base64").toString()
        : null;
      const responseData = decodedResponse ? JSON.parse(decodedResponse) : body;

      // Find transaction
      transaction = await prisma.paymentTransaction.findFirst({
        where: { orderId: responseData.data?.merchantTransactionId },
      });

      if (!transaction) {
        await updateWebhookLog(webhookLog.id, "FAILED", "Transaction not found");
        return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
      }

      if (responseData.code === "PAYMENT_SUCCESS") {
        updateData = {
          status: "SUCCESS",
          gatewayPaymentId: responseData.data?.transactionId,
          statusCode: "00",
          statusMessage: "Payment successful",
          completedAt: new Date(),
        };
      } else {
        updateData = {
          status: "FAILED",
          statusCode: responseData.code,
          statusMessage: responseData.message || "Payment failed",
          failureReason: responseData.message || "Payment failed",
          failedAt: new Date(),
        };
      }

      await prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { transactionId: transaction.transactionId },
      });
    } else if (gateway.gatewayType === "CCAVENUE") {
      transaction = await prisma.paymentTransaction.findFirst({
        where: { orderId: body.order_id },
      });

      if (!transaction) {
        await updateWebhookLog(webhookLog.id, "FAILED", "Transaction not found");
        return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
      }

      if (body.order_status === "Success") {
        updateData = {
          status: "SUCCESS",
          gatewayPaymentId: body.tracking_id,
          statusCode: "00",
          statusMessage: "Payment successful",
          completedAt: new Date(),
        };
      } else {
        updateData = {
          status: "FAILED",
          statusCode: body.status_code,
          statusMessage: body.failure_message || "Payment failed",
          failureReason: body.failure_message || "Payment failed",
          failedAt: new Date(),
        };
      }

      await prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { transactionId: transaction.transactionId },
      });
    } else {
      await updateWebhookLog(webhookLog.id, "FAILED", "Unsupported gateway type");
      return NextResponse.json(
        { success: false, error: "Unsupported gateway type" },
        { status: 400 }
      );
    }

    if (!isValid) {
      await updateWebhookLog(webhookLog.id, "FAILED", "Signature verification failed");
      await prisma.paymentWebhookLog.update({
        where: { id: webhookLog.id },
        data: { isSignatureValid: false },
      });
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Update transaction
    if (transaction && Object.keys(updateData).length > 0) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: updateData,
      });
    }

    await updateWebhookLog(webhookLog.id, "PROCESSED", null);

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Payment Webhook Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

async function updateWebhookLog(id: string, status: string, error: string | null) {
  await prisma.paymentWebhookLog.update({
    where: { id },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: error,
    },
  });
}

// GET - List webhook logs (for debugging)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentGatewayId = searchParams.get("paymentGatewayId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (paymentGatewayId) where.paymentGatewayId = paymentGatewayId;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.paymentWebhookLog.findMany({
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
      prisma.paymentWebhookLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Webhook Log GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch webhook logs" },
      { status: 500 }
    );
  }
}
