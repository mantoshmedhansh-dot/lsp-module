import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";
import { getWhatsAppService } from "@/lib/services/communication/whatsapp-service";
import { getSMSService } from "@/lib/services/communication/sms-service";
import { getEmailService } from "@/lib/services/communication/email-service";
import { getVoiceService } from "@/lib/services/communication/voice-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/ndr/[id]/outreach - Initiate outreach for an NDR
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      channel,
      templateId,
      customMessage,
      language = "en",
      priority = 5,
    } = body;

    // Validate required fields
    if (!channel) {
      return NextResponse.json(
        { error: "Missing required field: channel" },
        { status: 400 }
      );
    }

    // Valid channels
    const validChannels = ["WHATSAPP", "SMS", "EMAIL", "AI_VOICE", "IVR"];
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { error: `Invalid channel. Must be one of: ${validChannels.join(", ")}` },
        { status: 400 }
      );
    }

    // Find NDR with order details
    const ndr = await prisma.nDR.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            shippingAddress: true,
            paymentMode: true,
            totalAmount: true,
          },
        },
        delivery: {
          select: {
            id: true,
            awbNo: true,
            transporter: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!ndr) {
      return NextResponse.json({ error: "NDR not found" }, { status: 404 });
    }

    // Count existing outreach attempts for this NDR
    const existingAttempts = await prisma.nDROutreach.count({
      where: { ndrId: id },
    });

    // Prepare message content and variables
    const order = ndr.order;
    const variables: Record<string, string> = {
      customerName: order.customerName,
      orderNo: order.orderNo,
      awbNo: ndr.delivery?.awbNo || "",
      reason: ndr.aiClassification || ndr.reason,
      courierName: ndr.delivery?.transporter?.name || "our delivery partner",
    };

    let messageContent = customMessage || "";
    let result: { success: boolean; messageId?: string; providerMessageId?: string; status: string; error?: string };

    // Send message based on channel
    switch (channel) {
      case "WHATSAPP": {
        const whatsappService = getWhatsAppService();

        if (customMessage) {
          result = await whatsappService.sendMessage({
            to: order.customerPhone,
            content: customMessage,
            variables,
          });
        } else {
          // Use interactive message with buttons
          result = await whatsappService.sendNDRResolutionMessage(
            order.customerPhone,
            order.orderNo,
            ndr.aiClassification || ndr.reason
          );
        }

        messageContent = messageContent || `NDR resolution message for order #${order.orderNo}`;
        break;
      }

      case "SMS": {
        const smsService = getSMSService();

        const smsContent = customMessage ||
          `Hi ${order.customerName}, your order #${order.orderNo} couldn't be delivered (${ndr.aiClassification || ndr.reason}). Reply 1 to reschedule, 2 to update address, or 3 for callback.`;

        result = await smsService.sendMessage({
          to: order.customerPhone,
          content: smsContent,
          templateId,
          variables,
        });

        messageContent = smsContent;
        break;
      }

      case "EMAIL": {
        const emailService = getEmailService();

        if (!order.customerEmail) {
          return NextResponse.json(
            { error: "Customer email not available" },
            { status: 400 }
          );
        }

        result = await emailService.sendTemplatedEmail(
          order.customerEmail,
          "NDR_NOTIFICATION",
          {
            ...variables,
            actionLink: `${process.env.NEXT_PUBLIC_APP_URL}/track/${order.orderNo}`,
          },
          `Delivery Update for Order #${order.orderNo}`
        );

        messageContent = `NDR email sent to ${order.customerEmail}`;
        break;
      }

      case "AI_VOICE":
      case "IVR": {
        const voiceService = getVoiceService();

        const callResult = await voiceService.initiateNDRCall(
          order.customerPhone,
          order.orderNo,
          ndr.aiClassification || ndr.reason,
          language
        );

        result = {
          success: callResult.success,
          messageId: callResult.callId,
          providerMessageId: callResult.callId,
          status: callResult.status,
          error: callResult.error,
        };

        messageContent = `AI Voice call initiated for NDR resolution`;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Channel not supported yet" },
          { status: 400 }
        );
    }

    // Create outreach record
    const outreach = await prisma.nDROutreach.create({
      data: {
        ndrId: id,
        channel: channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "IVR" | "MANUAL_CALL",
        attemptNumber: existingAttempts + 1,
        templateId,
        messageContent,
        status: result.success ? "SENT" : "FAILED",
        sentAt: result.success ? new Date() : null,
        providerMessageId: result.providerMessageId,
        errorCode: result.error ? "SEND_FAILED" : undefined,
        errorMessage: result.error,
      },
    });

    // Update NDR status to CONTACTED if first successful outreach
    if (result.success && ndr.status === "OPEN") {
      await prisma.nDR.update({
        where: { id },
        data: { status: "CONTACTED" },
      });
    }

    // Log AI action
    await prisma.aIActionLog.create({
      data: {
        entityType: "NDR",
        entityId: id,
        ndrId: id,
        actionType: "OUTREACH_ATTEMPT",
        actionDetails: {
          channel,
          attemptNumber: existingAttempts + 1,
          success: result.success,
          providerMessageId: result.providerMessageId,
          error: result.error,
        },
        status: result.success ? "SUCCESS" : "FAILED",
        errorMessage: result.error,
        companyId: ndr.companyId,
      },
    });

    return NextResponse.json({
      success: result.success,
      outreach,
      message: result.success
        ? `Outreach sent via ${channel}`
        : `Failed to send outreach: ${result.error}`,
    });
  } catch (error) {
    console.error("Error initiating outreach:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate outreach" },
      { status: 500 }
    );
  }
}

// GET /api/ndr/[id]/outreach - Get outreach history for an NDR
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const outreachAttempts = await prisma.nDROutreach.findMany({
      where: { ndrId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      attempts: outreachAttempts,
      total: outreachAttempts.length,
    });
  } catch (error) {
    console.error("Error fetching outreach history:", error);
    return NextResponse.json(
      { error: "Failed to fetch outreach history" },
      { status: 500 }
    );
  }
}
