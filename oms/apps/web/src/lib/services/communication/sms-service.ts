// SMS Service
// Supports MSG91 (India) and Twilio (International)

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResponse,
  MessageStatus,
} from './types';

type SMSProvider = 'MSG91' | 'TWILIO';

interface SMSConfig {
  provider: SMSProvider;
  // MSG91 config
  msg91AuthKey?: string;
  msg91SenderId?: string;
  msg91TemplateId?: string;
  // Twilio config
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export class SMSService implements CommunicationProvider {
  name = 'SMS Service';
  type = 'SMS' as const;

  private config: SMSConfig;

  constructor(config?: Partial<SMSConfig>) {
    this.config = {
      provider: (config?.provider || process.env.SMS_PROVIDER || 'MSG91') as SMSProvider,
      msg91AuthKey: config?.msg91AuthKey || process.env.MSG91_AUTH_KEY,
      msg91SenderId: config?.msg91SenderId || process.env.MSG91_SENDER_ID || 'CJDQCK',
      msg91TemplateId: config?.msg91TemplateId || process.env.MSG91_TEMPLATE_ID,
      twilioAccountSid: config?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: config?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: config?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER,
    };
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    if (this.config.provider === 'MSG91') {
      return this.sendViaMSG91(request);
    } else {
      return this.sendViaTwilio(request);
    }
  }

  private async sendViaMSG91(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to);

      // MSG91 Flow API for template-based SMS
      const url = 'https://control.msg91.com/api/v5/flow/';

      const payload = {
        template_id: request.templateId || this.config.msg91TemplateId,
        sender: this.config.msg91SenderId,
        short_url: '0',
        mobiles: phone,
        ...request.variables, // Variables for template
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authkey': this.config.msg91AuthKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.type === 'success') {
        return {
          success: true,
          messageId: data.request_id,
          providerMessageId: data.request_id,
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.message || 'Failed to send SMS via MSG91',
        errorCode: data.code,
      };
    } catch (error) {
      console.error('MSG91 send error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendViaTwilio(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to, true); // Include + prefix

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Messages.json`;

      const formData = new URLSearchParams();
      formData.append('To', phone);
      formData.append('From', this.config.twilioPhoneNumber || '');
      formData.append('Body', request.content || '');

      const credentials = Buffer.from(
        `${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`
      ).toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.sid) {
        return {
          success: true,
          messageId: data.sid,
          providerMessageId: data.sid,
          status: data.status === 'queued' ? 'QUEUED' : 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.message || 'Failed to send SMS via Twilio',
        errorCode: data.code?.toString(),
      };
    } catch (error) {
      console.error('Twilio send error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    if (this.config.provider === 'TWILIO') {
      return this.getTwilioMessageStatus(messageId);
    }
    // MSG91 uses webhooks for status updates
    return {
      messageId,
      status: 'PENDING',
    };
  }

  private async getTwilioMessageStatus(messageId: string): Promise<MessageStatus> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Messages/${messageId}.json`;

      const credentials = Buffer.from(
        `${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`
      ).toString('base64');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const data = await response.json();

      const statusMap: Record<string, MessageStatus['status']> = {
        queued: 'PENDING',
        sending: 'PENDING',
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
        undelivered: 'FAILED',
      };

      return {
        messageId,
        status: statusMap[data.status] || 'PENDING',
        deliveredAt: data.date_sent ? new Date(data.date_sent) : undefined,
        error: data.error_message,
      };
    } catch {
      return {
        messageId,
        status: 'PENDING',
      };
    }
  }

  private formatPhoneNumber(phone: string, includePrefix = false): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Add India country code if 10 digits
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    return includePrefix ? '+' + cleaned : cleaned;
  }

  // Quick send for NDR notifications
  async sendNDRSMS(
    to: string,
    orderNo: string,
    message: string
  ): Promise<SendMessageResponse> {
    return this.sendMessage({
      to,
      content: `Order #${orderNo}: ${message}. Reply HELP for assistance.`,
      variables: {
        orderNo,
        message,
      },
    });
  }
}

// Singleton instance
let smsService: SMSService | null = null;

export function getSMSService(): SMSService {
  if (!smsService) {
    smsService = new SMSService();
  }
  return smsService;
}
