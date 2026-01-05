import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Default SMS templates for common shipment events
const DEFAULT_SMS_TEMPLATES = [
  {
    code: "SMS_SHIPMENT_BOOKED",
    name: "Shipment Booked Confirmation",
    channel: "SMS",
    triggerEvent: "SHIPMENT_BOOKED",
    recipientType: "CONSIGNEE",
    body: "Dear {{consignee_name}}, your shipment {{awb}} has been booked and will be picked up soon. Track: {{tracking_url}} - CJDarcl Quick",
    delayMinutes: 0,
  },
  {
    code: "SMS_PICKED_UP",
    name: "Picked Up Notification",
    channel: "SMS",
    triggerEvent: "PICKED_UP",
    recipientType: "CONSIGNEE",
    body: "Your shipment {{awb}} has been picked up and is on its way to you. Expected delivery: {{expected_delivery}}. Track: {{tracking_url}} - CJDarcl Quick",
    delayMinutes: 0,
  },
  {
    code: "SMS_OUT_FOR_DELIVERY",
    name: "Out for Delivery",
    channel: "SMS",
    triggerEvent: "OUT_FOR_DELIVERY",
    recipientType: "CONSIGNEE",
    body: "Good news! Your shipment {{awb}} is out for delivery today. Keep your phone handy. Track: {{tracking_url}} - CJDarcl Quick",
    delayMinutes: 0,
  },
  {
    code: "SMS_DELIVERED",
    name: "Delivered Confirmation",
    channel: "SMS",
    triggerEvent: "DELIVERED",
    recipientType: "CONSIGNEE",
    body: "Your shipment {{awb}} has been delivered successfully. Thank you for choosing CJDarcl Quick!",
    delayMinutes: 0,
  },
  {
    code: "SMS_DELIVERY_FAILED",
    name: "Delivery Failed",
    channel: "SMS",
    triggerEvent: "DELIVERY_FAILED",
    recipientType: "CONSIGNEE",
    body: "We couldn't deliver {{awb}} today. Reason: {{failure_reason}}. We'll reattempt on {{next_attempt_date}}. Track: {{tracking_url}} - CJDarcl Quick",
    delayMinutes: 0,
  },
];

// Default WhatsApp templates
const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    code: "WA_SHIPMENT_BOOKED",
    name: "WhatsApp Booking Confirmation",
    channel: "WHATSAPP",
    triggerEvent: "SHIPMENT_BOOKED",
    recipientType: "CONSIGNEE",
    body: "Hello {{consignee_name}}! Your shipment has been booked.\n\nAWB: {{awb}}\nFrom: {{origin}}\nTo: {{destination}}\n\nTrack your shipment: {{tracking_url}}\n\n- CJDarcl Quick Logistics",
    delayMinutes: 0,
  },
  {
    code: "WA_OUT_FOR_DELIVERY",
    name: "WhatsApp Out for Delivery",
    channel: "WHATSAPP",
    triggerEvent: "OUT_FOR_DELIVERY",
    recipientType: "CONSIGNEE",
    body: "Hello {{consignee_name}}!\n\nGreat news! Your shipment {{awb}} is out for delivery today.\n\nDelivery Agent: {{delivery_agent}}\nContact: {{delivery_phone}}\n\nPlease keep your phone handy.\n\nTrack: {{tracking_url}}",
    delayMinutes: 0,
  },
  {
    code: "WA_DELIVERED",
    name: "WhatsApp Delivered",
    channel: "WHATSAPP",
    triggerEvent: "DELIVERED",
    recipientType: "CONSIGNEE",
    body: "Hello {{consignee_name}}!\n\nYour shipment {{awb}} has been delivered successfully.\n\nReceived by: {{receiver_name}}\nTime: {{delivery_time}}\n\nThank you for choosing CJDarcl Quick! We'd love your feedback.",
    delayMinutes: 0,
  },
];

// POST - Seed default templates
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel"); // SMS, WHATSAPP, or ALL

    let templates: typeof DEFAULT_SMS_TEMPLATES = [];

    if (!channel || channel === "ALL") {
      templates = [...DEFAULT_SMS_TEMPLATES, ...DEFAULT_WHATSAPP_TEMPLATES];
    } else if (channel === "SMS") {
      templates = DEFAULT_SMS_TEMPLATES;
    } else if (channel === "WHATSAPP") {
      templates = DEFAULT_WHATSAPP_TEMPLATES;
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const template of templates) {
      try {
        // Check if template already exists
        const existing = await prisma.notificationTemplate.findUnique({
          where: { code: template.code },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Get available variables based on trigger event
        const availableVars = getAvailableVars(template.triggerEvent);

        await prisma.notificationTemplate.create({
          data: {
            code: template.code,
            name: template.name,
            channel: template.channel,
            triggerEvent: template.triggerEvent,
            recipientType: template.recipientType,
            body: template.body,
            isActive: true,
            availableVars: JSON.stringify(availableVars),
            delayMinutes: template.delayMinutes,
          },
        });

        results.created++;
      } catch (err: any) {
        results.errors.push(`${template.code}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Created ${results.created} templates, skipped ${results.skipped} existing`,
    });
  } catch (error) {
    console.error("Seed Templates Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed templates" },
      { status: 500 }
    );
  }
}

function getAvailableVars(triggerEvent: string): string[] {
  const baseVars = ["{{awb}}", "{{client_name}}", "{{consignee_name}}", "{{consignee_phone}}", "{{tracking_url}}"];

  const eventVars: Record<string, string[]> = {
    SHIPMENT_BOOKED: [...baseVars, "{{origin}}", "{{destination}}", "{{expected_delivery}}"],
    PICKUP_SCHEDULED: [...baseVars, "{{pickup_date}}", "{{pickup_time}}", "{{pickup_address}}"],
    PICKED_UP: [...baseVars, "{{pickup_time}}", "{{expected_delivery}}"],
    IN_TRANSIT: [...baseVars, "{{current_location}}", "{{expected_delivery}}"],
    OUT_FOR_DELIVERY: [...baseVars, "{{delivery_agent}}", "{{delivery_phone}}", "{{otp}}"],
    DELIVERED: [...baseVars, "{{delivery_time}}", "{{receiver_name}}", "{{pod_link}}"],
    DELIVERY_FAILED: [...baseVars, "{{failure_reason}}", "{{next_attempt_date}}"],
    RTO_INITIATED: [...baseVars, "{{rto_reason}}"],
    NDR_CREATED: [...baseVars, "{{ndr_reason}}", "{{reattempt_date}}"],
    COD_COLLECTED: [...baseVars, "{{cod_amount}}", "{{payment_mode}}"],
  };

  return eventVars[triggerEvent] || baseVars;
}

// GET - List available default templates
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      smsTemplates: DEFAULT_SMS_TEMPLATES.map((t) => ({
        code: t.code,
        name: t.name,
        triggerEvent: t.triggerEvent,
      })),
      whatsappTemplates: DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({
        code: t.code,
        name: t.name,
        triggerEvent: t.triggerEvent,
      })),
    },
  });
}
