import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// WhatsApp Business API Integration
// Supports Meta Cloud API, Twilio, Gupshup, WATI

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");
    const type = searchParams.get("type");

    if (type === "templates") {
      const configId = searchParams.get("configId");
      if (!configId) {
        return NextResponse.json(
          { success: false, error: "Config ID required" },
          { status: 400 }
        );
      }

      const templates = await prisma.whatsAppTemplate.findMany({
        where: { configId, isActive: true },
        orderBy: { templateName: "asc" },
      });

      return NextResponse.json({ success: true, data: templates });
    }

    if (type === "messages") {
      const configId = searchParams.get("configId");
      const awbNumber = searchParams.get("awbNumber");
      const phone = searchParams.get("phone");

      const where: any = {};
      if (configId) where.configId = configId;
      if (awbNumber) where.awbNumber = awbNumber;
      if (phone) where.recipientPhone = phone;

      const messages = await prisma.whatsAppMessage.findMany({
        where,
        include: {
          template: { select: { templateName: true, category: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return NextResponse.json({ success: true, data: messages });
    }

    // Get WhatsApp configs
    const where: any = {};
    if (clientId) where.clientId = clientId;

    const configs = await prisma.whatsAppConfig.findMany({
      where,
      include: {
        _count: { select: { templates: true, messages: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: { items: configs },
    });
  } catch (error) {
    console.error("Error fetching WhatsApp data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch WhatsApp data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "CREATE_CONFIG": {
        const config = await prisma.whatsAppConfig.create({
          data: {
            clientId: body.clientId,
            businessAccountId: body.businessAccountId,
            phoneNumberId: body.phoneNumberId,
            displayPhoneNumber: body.displayPhoneNumber,
            accessToken: body.accessToken,
            webhookVerifyToken: body.webhookVerifyToken || generateToken(32),
            provider: body.provider || "META",
            defaultLanguage: body.defaultLanguage || "en",
            businessName: body.businessName,
            businessCategory: body.businessCategory,
            webhookUrl: body.webhookUrl,
          },
        });

        return NextResponse.json({ success: true, data: config });
      }

      case "CREATE_TEMPLATE": {
        const template = await prisma.whatsAppTemplate.create({
          data: {
            configId: body.configId,
            templateName: body.templateName,
            category: body.category,
            language: body.language || "en",
            headerType: body.headerType,
            headerContent: body.headerContent,
            bodyContent: body.bodyContent,
            footerContent: body.footerContent,
            buttonType: body.buttonType,
            buttons: body.buttons ? JSON.stringify(body.buttons) : null,
            variableCount: (body.bodyContent.match(/\{\{[0-9]+\}\}/g) || []).length,
            sampleVariables: body.sampleVariables ? JSON.stringify(body.sampleVariables) : null,
            useCase: body.useCase,
            status: "PENDING",
          },
        });

        // In production, submit template to Meta for approval
        // await submitTemplateToMeta(template);

        return NextResponse.json({ success: true, data: template });
      }

      case "SEND_TEMPLATE_MESSAGE": {
        const { configId, templateId, recipientPhone, recipientName, variables, awbNumber, shipmentId } = body;

        const [config, template] = await Promise.all([
          prisma.whatsAppConfig.findUnique({ where: { id: configId } }),
          prisma.whatsAppTemplate.findUnique({ where: { id: templateId } }),
        ]);

        if (!config || !template) {
          return NextResponse.json(
            { success: false, error: "Config or template not found" },
            { status: 404 }
          );
        }

        if (template.status !== "APPROVED") {
          return NextResponse.json(
            { success: false, error: "Template not approved" },
            { status: 400 }
          );
        }

        // Create message record
        const message = await prisma.whatsAppMessage.create({
          data: {
            configId,
            templateId,
            messageType: "TEMPLATE",
            recipientPhone: formatPhoneNumber(recipientPhone),
            recipientName,
            templateName: template.templateName,
            templateVariables: variables ? JSON.stringify(variables) : null,
            awbNumber,
            shipmentId,
            status: "PENDING",
            conversationType: template.category === "MARKETING" ? "MARKETING" : "UTILITY",
          },
        });

        // Send via Meta Cloud API
        try {
          // In production:
          // const response = await fetch(
          //   `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
          //   {
          //     method: "POST",
          //     headers: {
          //       "Authorization": `Bearer ${config.accessToken}`,
          //       "Content-Type": "application/json",
          //     },
          //     body: JSON.stringify({
          //       messaging_product: "whatsapp",
          //       to: formatPhoneNumber(recipientPhone),
          //       type: "template",
          //       template: {
          //         name: template.templateName,
          //         language: { code: template.language },
          //         components: buildTemplateComponents(template, variables),
          //       },
          //     }),
          //   }
          // );

          // Mock successful send
          await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              waMessageId: `wamid.${Date.now()}`,
            },
          });

          return NextResponse.json({ success: true, data: message });
        } catch (error) {
          await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              status: "FAILED",
              errorMessage: (error as Error).message,
            },
          });

          throw error;
        }
      }

      case "SEND_SHIPMENT_UPDATE": {
        // Convenience method to send shipment update notifications
        const { awbNumber, status, recipientPhone, recipientName, configId } = body;

        // Map status to template use case
        const useCaseMap: Record<string, string> = {
          BOOKED: "SHIPMENT_BOOKED",
          PICKED_UP: "SHIPMENT_PICKED",
          IN_TRANSIT: "IN_TRANSIT",
          OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
          DELIVERED: "DELIVERED",
          NDR: "NDR",
          RTO: "RTO",
        };

        const useCase = useCaseMap[status];
        if (!useCase) {
          return NextResponse.json(
            { success: false, error: "No template for this status" },
            { status: 400 }
          );
        }

        const template = await prisma.whatsAppTemplate.findFirst({
          where: {
            configId,
            useCase,
            status: "APPROVED",
            isActive: true,
          },
        });

        if (!template) {
          return NextResponse.json(
            { success: false, error: `No approved template for ${useCase}` },
            { status: 404 }
          );
        }

        // Build variables based on template
        const variables = [recipientName, awbNumber];

        // Create and send message
        const message = await prisma.whatsAppMessage.create({
          data: {
            configId,
            templateId: template.id,
            messageType: "TEMPLATE",
            recipientPhone: formatPhoneNumber(recipientPhone),
            recipientName,
            templateName: template.templateName,
            templateVariables: JSON.stringify(variables),
            awbNumber,
            status: "SENT",
            sentAt: new Date(),
            conversationType: "UTILITY",
            waMessageId: `wamid.${Date.now()}`,
          },
        });

        return NextResponse.json({ success: true, data: message });
      }

      case "WEBHOOK_VERIFY": {
        // Webhook verification for Meta
        const { mode, token, challenge, configId } = body;

        const config = await prisma.whatsAppConfig.findUnique({
          where: { id: configId },
        });

        if (mode === "subscribe" && token === config?.webhookVerifyToken) {
          return NextResponse.json({ success: true, challenge });
        }

        return NextResponse.json(
          { success: false, error: "Verification failed" },
          { status: 403 }
        );
      }

      case "WEBHOOK_EVENT": {
        // Handle incoming webhook events from Meta
        const { entry } = body;

        for (const e of entry || []) {
          for (const change of e.changes || []) {
            const value = change.value;

            // Handle status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                await prisma.whatsAppMessage.updateMany({
                  where: { waMessageId: status.id },
                  data: {
                    status: status.status.toUpperCase(),
                    deliveredAt: status.status === "delivered" ? new Date() : undefined,
                    readAt: status.status === "read" ? new Date() : undefined,
                  },
                });
              }
            }

            // Handle incoming messages
            if (value.messages) {
              for (const msg of value.messages) {
                // Log incoming message
                // Could be used for customer replies, support queries, etc.
              }
            }
          }
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in WhatsApp API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

function formatPhoneNumber(phone: string): string {
  // Ensure phone number is in E.164 format for India
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
}

function generateToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
