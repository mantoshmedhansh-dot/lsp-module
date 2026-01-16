import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";
import { getCommunicationService } from "@/lib/services/communication";
import { DEFAULT_PROACTIVE_CONFIG } from "@/lib/services/communication/types";

// Message templates for different triggers
const TRIGGER_TEMPLATES: Record<string, {
  whatsapp: string;
  sms: string;
  email: { subject: string; template: string };
}> = {
  ORDER_CONFIRMED: {
    whatsapp: "Hi {{customerName}}! Your order #{{orderNo}} has been confirmed. We'll notify you once it's shipped. Track: {{trackingUrl}}",
    sms: "Order #{{orderNo}} confirmed! Track: {{trackingUrl}}",
    email: {
      subject: "Order #{{orderNo}} Confirmed",
      template: "DELIVERED", // Use delivered template as placeholder
    },
  },
  SHIPPED: {
    whatsapp: "Great news {{customerName}}! Your order #{{orderNo}} has been shipped via {{courierName}}. AWB: {{awbNo}}. Expected delivery: {{eta}}. Track: {{trackingUrl}}",
    sms: "Order #{{orderNo}} shipped! AWB: {{awbNo}}, ETA: {{eta}}. Track: {{trackingUrl}}",
    email: {
      subject: "Your Order #{{orderNo}} is On The Way!",
      template: "DELIVERED",
    },
  },
  OUT_FOR_DELIVERY: {
    whatsapp: "Hi {{customerName}}! Your order #{{orderNo}} is out for delivery today. Our delivery partner will reach you shortly. Please keep your phone reachable.",
    sms: "Order #{{orderNo}} is out for delivery today! Keep your phone handy.",
    email: {
      subject: "Out for Delivery: Order #{{orderNo}}",
      template: "DELIVERED",
    },
  },
  DELAY_PREDICTED: {
    whatsapp: "Hi {{customerName}}, we noticed your order #{{orderNo}} might be slightly delayed due to {{reason}}. New expected delivery: {{newEta}}. We apologize for the inconvenience.",
    sms: "Order #{{orderNo}} may be delayed. New ETA: {{newEta}}. Sorry for inconvenience.",
    email: {
      subject: "Delivery Update for Order #{{orderNo}}",
      template: "DELAY_ALERT",
    },
  },
  SLA_BREACH_RISK: {
    whatsapp: "Hi {{customerName}}, your order #{{orderNo}} delivery is taking longer than expected. Our team is prioritizing it. We'll update you soon.",
    sms: "Order #{{orderNo}} delayed. Team is on it. Updates coming soon.",
    email: {
      subject: "Delivery Delay Notice: Order #{{orderNo}}",
      template: "DELAY_ALERT",
    },
  },
  DELIVERED: {
    whatsapp: "Your order #{{orderNo}} has been delivered! Thank you for shopping with us. We hope you love your purchase! Leave a review: {{feedbackUrl}}",
    sms: "Order #{{orderNo}} delivered! Rate your experience: {{feedbackUrl}}",
    email: {
      subject: "Your Order #{{orderNo}} Has Been Delivered!",
      template: "DELIVERED",
    },
  },
  FEEDBACK_REQUEST: {
    whatsapp: "Hi {{customerName}}! How was your experience with order #{{orderNo}}? We'd love to hear your feedback: {{feedbackUrl}}",
    sms: "Rate your order #{{orderNo}} experience: {{feedbackUrl}}",
    email: {
      subject: "How was your experience with Order #{{orderNo}}?",
      template: "DELIVERED",
    },
  },
};

// POST /api/proactive-communication/trigger - Trigger proactive communication for an event
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      orderId,
      deliveryId,
      trigger,
      variables = {},
      channels, // Optional: override default channels
      sendImmediately = true,
    } = body;

    // Validate required fields
    if (!orderId || !trigger) {
      return NextResponse.json(
        { error: "Missing required fields: orderId and trigger" },
        { status: 400 }
      );
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Delivery: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            Transporter: true,
          },
        },
        Location: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if trigger is enabled in config
    const triggerConfig = DEFAULT_PROACTIVE_CONFIG.triggers[trigger];
    if (!triggerConfig?.enabled) {
      return NextResponse.json(
        { error: `Trigger ${trigger} is not enabled` },
        { status: 400 }
      );
    }

    // Get channels to use
    const channelsToUse = channels || triggerConfig.channels;

    // Check throttling - max communications per day per customer
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCommunications = await prisma.proactiveCommunication.count({
      where: {
        customerPhone: order.customerPhone,
        createdAt: { gte: today },
        status: { in: ["SENT", "DELIVERED", "SCHEDULED", "PENDING"] },
      },
    });

    if (todayCommunications >= DEFAULT_PROACTIVE_CONFIG.throttling.maxPerDay) {
      return NextResponse.json({
        success: false,
        message: "Max daily communications reached for this customer",
        throttled: true,
      });
    }

    // Check quiet hours
    const commService = getCommunicationService();
    const isWorkingHours = commService.isWithinWorkingHours(
      DEFAULT_PROACTIVE_CONFIG.throttling.quietHours
    );

    // Prepare variables
    const messageVariables: Record<string, string> = {
      customerName: order.customerName,
      orderNo: order.orderNo,
      awbNo: order.Delivery[0]?.awbNo || "",
      courierName: order.Delivery[0]?.Transporter?.name || "our delivery partner",
      eta: order.promisedDate
        ? new Date(order.promisedDate).toLocaleDateString()
        : "soon",
      trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/track/${order.orderNo}`,
      feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/feedback/${order.orderNo}`,
      ...variables,
    };

    const templates = TRIGGER_TEMPLATES[trigger];
    if (!templates) {
      return NextResponse.json(
        { error: `No templates found for trigger: ${trigger}` },
        { status: 400 }
      );
    }

    // Create communications for each channel
    const results: Array<{ channel: string; success: boolean; communicationId?: string; error?: string }> = [];

    for (const channel of channelsToUse) {
      let content: string;

      switch (channel) {
        case "WHATSAPP":
          content = templates.whatsapp;
          break;
        case "SMS":
          content = templates.sms;
          break;
        case "EMAIL":
          content = templates.email.subject;
          break;
        default:
          continue;
      }

      // Replace variables in content
      for (const [key, value] of Object.entries(messageVariables)) {
        content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
      }

      // Determine scheduled time
      let scheduledFor: Date | null = null;
      if (!sendImmediately || !isWorkingHours) {
        scheduledFor = new Date();
        if (!isWorkingHours) {
          // Schedule for next morning
          scheduledFor.setDate(scheduledFor.getDate() + 1);
          scheduledFor.setHours(9, 0, 0, 0);
        }
      }

      try {
        // Create communication record
        const communication = await prisma.proactiveCommunication.create({
          data: {
            orderId,
            deliveryId: deliveryId || order.Delivery[0]?.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            trigger: trigger as "ORDER_CONFIRMED" | "ORDER_SHIPPED" | "OUT_FOR_DELIVERY" | "DELAY_PREDICTED" | "SLA_BREACH_RISK" | "DELIVERY_ATTEMPTED" | "DELIVERED" | "FEEDBACK_REQUEST" | "CUSTOM",
            channel: channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "MANUAL_CALL" | "IVR",
            content,
            variables: messageVariables,
            scheduledFor,
            priority: triggerConfig.priority,
            status: scheduledFor ? "SCHEDULED" : "PENDING",
            companyId: order.Location.companyId,
          },
        });

        // Send immediately if not scheduled
        if (!scheduledFor && sendImmediately) {
          const sendResult = await commService.sendMessage(
            channel as "WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE" | "MANUAL_CALL" | "IVR",
            {
              to: channel === "EMAIL"
                ? order.customerEmail || order.customerPhone
                : order.customerPhone,
              content,
              variables: messageVariables,
            }
          );

          await prisma.proactiveCommunication.update({
            where: { id: communication.id },
            data: {
              status: sendResult.success ? "SENT" : "FAILED",
              sentAt: sendResult.success ? new Date() : null,
              providerMessageId: sendResult.providerMessageId,
              errorMessage: sendResult.error,
            },
          });

          results.push({
            channel,
            success: sendResult.success,
            communicationId: communication.id,
            error: sendResult.error,
          });
        } else {
          results.push({
            channel,
            success: true,
            communicationId: communication.id,
          });
        }
      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log AI action
    await prisma.aIActionLog.create({
      data: {
        entityType: "Order",
        entityId: orderId,
        actionType: "PROACTIVE_TRIGGER",
        actionDetails: {
          trigger,
          channels: channelsToUse,
          results,
          isWorkingHours,
        },
        status: results.some((r) => r.success) ? "SUCCESS" : "FAILED",
        companyId: order.Location.companyId,
      },
    });

    return NextResponse.json({
      success: results.some((r) => r.success),
      trigger,
      results,
      message: `Triggered ${trigger} for ${results.length} channels`,
    });
  } catch (error) {
    console.error("Error triggering proactive communication:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger communication" },
      { status: 500 }
    );
  }
}
