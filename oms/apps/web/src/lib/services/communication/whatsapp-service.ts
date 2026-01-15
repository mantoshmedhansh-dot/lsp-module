// WhatsApp Business API Service
// Supports Meta WhatsApp Cloud API

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResponse,
  MessageStatus,
} from './types';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
}

export class WhatsAppService implements CommunicationProvider {
  name = 'WhatsApp Business API';
  type = 'WHATSAPP' as const;

  private config: WhatsAppConfig;

  constructor(config?: Partial<WhatsAppConfig>) {
    this.config = {
      phoneNumberId: config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
      businessAccountId: config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to);

      let payload: Record<string, unknown>;

      if (request.templateName) {
        // Send template message
        payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: request.templateName,
            language: {
              code: request.language || 'en',
            },
            components: this.buildTemplateComponents(request.variables),
          },
        };
      } else if (request.content) {
        // Send text message
        payload = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: {
            body: request.content,
            preview_url: false,
          },
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          error: 'Either templateName or content is required',
        };
      }

      const response = await fetch(
        `${WHATSAPP_API_URL}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok && data.messages?.[0]?.id) {
        return {
          success: true,
          messageId: data.messages[0].id,
          providerMessageId: data.messages[0].id,
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.error?.message || 'Failed to send WhatsApp message',
        errorCode: data.error?.code?.toString(),
      };
    } catch (error) {
      console.error('WhatsApp send error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    // Note: WhatsApp uses webhooks for status updates
    // This is a placeholder - actual implementation would query your database
    // where webhook updates are stored
    return {
      messageId,
      status: 'PENDING',
    };
  }

  async sendInteractiveMessage(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>
  ): Promise<SendMessageResponse> {
    try {
      const phone = this.formatPhoneNumber(to);

      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: body,
          },
          action: {
            buttons: buttons.slice(0, 3).map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title.substring(0, 20), // Max 20 chars
              },
            })),
          },
        },
      };

      const response = await fetch(
        `${WHATSAPP_API_URL}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok && data.messages?.[0]?.id) {
        return {
          success: true,
          messageId: data.messages[0].id,
          providerMessageId: data.messages[0].id,
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.error?.message || 'Failed to send interactive message',
      };
    } catch (error) {
      console.error('WhatsApp interactive message error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Send NDR resolution options
  async sendNDRResolutionMessage(
    to: string,
    orderNo: string,
    ndrReason: string
  ): Promise<SendMessageResponse> {
    const body = `Hi! Your order #${orderNo} couldn't be delivered.\n\nReason: ${ndrReason}\n\nPlease select an option:`;

    const buttons = [
      { id: 'reschedule', title: 'Reschedule Delivery' },
      { id: 'update_address', title: 'Update Address' },
      { id: 'call_me', title: 'Call Me' },
    ];

    return this.sendInteractiveMessage(to, body, buttons);
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Add India country code if not present
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    return cleaned;
  }

  private buildTemplateComponents(
    variables?: Record<string, string>
  ): Array<{ type: string; parameters: Array<{ type: string; text: string }> }> {
    if (!variables || Object.keys(variables).length === 0) {
      return [];
    }

    const parameters = Object.values(variables).map((value) => ({
      type: 'text',
      text: value,
    }));

    return [
      {
        type: 'body',
        parameters,
      },
    ];
  }
}

// Singleton instance
let whatsappService: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappService) {
    whatsappService = new WhatsAppService();
  }
  return whatsappService;
}
