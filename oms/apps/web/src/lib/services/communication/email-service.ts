// Email Service
// Supports SendGrid and AWS SES

import type {
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResponse,
  MessageStatus,
} from './types';

type EmailProvider = 'SENDGRID' | 'SES' | 'NODEMAILER';

interface EmailConfig {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  // SendGrid
  sendgridApiKey?: string;
  // AWS SES
  sesRegion?: string;
  sesAccessKeyId?: string;
  sesSecretAccessKey?: string;
  // SMTP/Nodemailer
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

interface EmailRequest extends SendMessageRequest {
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    type: string;
  }>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export class EmailService implements CommunicationProvider {
  name = 'Email Service';
  type = 'EMAIL' as const;

  private config: EmailConfig;

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      provider: (config?.provider || process.env.EMAIL_PROVIDER || 'SENDGRID') as EmailProvider,
      fromEmail: config?.fromEmail || process.env.EMAIL_FROM || 'noreply@cjdquick.com',
      fromName: config?.fromName || process.env.EMAIL_FROM_NAME || 'CJDQuick OMS',
      sendgridApiKey: config?.sendgridApiKey || process.env.SENDGRID_API_KEY,
      sesRegion: config?.sesRegion || process.env.AWS_REGION || 'ap-south-1',
      sesAccessKeyId: config?.sesAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
      sesSecretAccessKey: config?.sesSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      smtpHost: config?.smtpHost || process.env.SMTP_HOST,
      smtpPort: config?.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: config?.smtpUser || process.env.SMTP_USER,
      smtpPassword: config?.smtpPassword || process.env.SMTP_PASSWORD,
    };
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const emailRequest: EmailRequest = {
      ...request,
      subject: request.subject || 'Notification from CJDQuick',
    };

    if (this.config.provider === 'SENDGRID') {
      return this.sendViaSendGrid(emailRequest);
    } else if (this.config.provider === 'SES') {
      return this.sendViaSES(emailRequest);
    } else {
      return this.sendViaSMTP(emailRequest);
    }
  }

  private async sendViaSendGrid(request: EmailRequest): Promise<SendMessageResponse> {
    try {
      const url = 'https://api.sendgrid.com/v3/mail/send';

      const payload: Record<string, unknown> = {
        personalizations: [
          {
            to: [{ email: request.to }],
            cc: request.cc?.map((email) => ({ email })),
            bcc: request.bcc?.map((email) => ({ email })),
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: request.subject,
        content: [],
      };

      // Add content
      const content = payload.content as Array<{ type: string; value: string }>;
      if (request.textContent || request.content) {
        content.push({
          type: 'text/plain',
          value: request.textContent || request.content || '',
        });
      }
      if (request.htmlContent) {
        content.push({
          type: 'text/html',
          value: request.htmlContent,
        });
      }

      // Add reply-to if specified
      if (request.replyTo) {
        payload.reply_to = { email: request.replyTo };
      }

      // Add attachments if any
      if (request.attachments?.length) {
        payload.attachments = request.attachments.map((att) => ({
          content: att.content,
          filename: att.filename,
          type: att.type,
          disposition: 'attachment',
        }));
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 202) {
        const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
        return {
          success: true,
          messageId,
          providerMessageId: messageId,
          status: 'SENT',
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        status: 'FAILED',
        error: errorData.errors?.[0]?.message || 'Failed to send email via SendGrid',
        errorCode: response.status.toString(),
      };
    } catch (error) {
      console.error('SendGrid send error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendViaSES(request: EmailRequest): Promise<SendMessageResponse> {
    try {
      // AWS SES v2 API
      const url = `https://email.${this.config.sesRegion}.amazonaws.com/v2/email/outbound-emails`;

      const payload = {
        Destination: {
          ToAddresses: [request.to],
          CcAddresses: request.cc || [],
          BccAddresses: request.bcc || [],
        },
        Content: {
          Simple: {
            Subject: {
              Data: request.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Text: request.textContent || request.content ? {
                Data: request.textContent || request.content,
                Charset: 'UTF-8',
              } : undefined,
              Html: request.htmlContent ? {
                Data: request.htmlContent,
                Charset: 'UTF-8',
              } : undefined,
            },
          },
        },
        FromEmailAddress: `${this.config.fromName} <${this.config.fromEmail}>`,
        ReplyToAddresses: request.replyTo ? [request.replyTo] : undefined,
      };

      // Note: In production, use AWS SDK with proper signing
      // This is a simplified version
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // AWS Signature would be added here in production
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.MessageId) {
        return {
          success: true,
          messageId: data.MessageId,
          providerMessageId: data.MessageId,
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.message || 'Failed to send email via SES',
      };
    } catch (error) {
      console.error('SES send error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendViaSMTP(request: EmailRequest): Promise<SendMessageResponse> {
    // For SMTP, we would use nodemailer in a server environment
    // This is a placeholder for the API route to handle
    console.log('SMTP email would be sent:', request);
    return {
      success: true,
      messageId: `smtp_${Date.now()}`,
      status: 'QUEUED',
    };
  }

  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    // Email providers typically use webhooks for status updates
    return {
      messageId,
      status: 'SENT', // Emails are generally fire-and-forget
    };
  }

  // Helper method to send templated emails
  async sendTemplatedEmail(
    to: string,
    templateName: string,
    variables: Record<string, string>,
    subject: string
  ): Promise<SendMessageResponse> {
    // Load template from database or file system
    // For now, use inline templates
    const templates: Record<string, { html: string; text: string }> = {
      NDR_NOTIFICATION: {
        html: `
          <h2>Delivery Update for Order #{{orderNo}}</h2>
          <p>Hi {{customerName}},</p>
          <p>We attempted to deliver your order but were unable to complete the delivery.</p>
          <p><strong>Reason:</strong> {{reason}}</p>
          <p>Please click the link below to reschedule or update your address:</p>
          <p><a href="{{actionLink}}">Reschedule Delivery</a></p>
          <p>Best regards,<br>CJDQuick Team</p>
        `,
        text: `Delivery Update for Order #{{orderNo}}\n\nHi {{customerName}},\n\nWe attempted to deliver your order but were unable to complete the delivery.\n\nReason: {{reason}}\n\nPlease reply to this email to reschedule.\n\nBest regards,\nCJDQuick Team`,
      },
      DELAY_ALERT: {
        html: `
          <h2>Delivery Update for Order #{{orderNo}}</h2>
          <p>Hi {{customerName}},</p>
          <p>Your order might be slightly delayed due to {{reason}}.</p>
          <p><strong>New Expected Delivery:</strong> {{newETA}}</p>
          <p>We apologize for any inconvenience and are working to get your order to you as soon as possible.</p>
          <p><a href="{{trackingLink}}">Track Your Order</a></p>
          <p>Best regards,<br>CJDQuick Team</p>
        `,
        text: `Delivery Update for Order #{{orderNo}}\n\nHi {{customerName}},\n\nYour order might be slightly delayed due to {{reason}}.\n\nNew Expected Delivery: {{newETA}}\n\nTrack your order: {{trackingLink}}\n\nBest regards,\nCJDQuick Team`,
      },
      DELIVERED: {
        html: `
          <h2>Your Order Has Been Delivered!</h2>
          <p>Hi {{customerName}},</p>
          <p>Great news! Your order #{{orderNo}} has been successfully delivered.</p>
          <p>We hope you love your purchase!</p>
          <p><a href="{{feedbackLink}}">Share Your Feedback</a></p>
          <p>Thank you for shopping with us!</p>
          <p>Best regards,<br>CJDQuick Team</p>
        `,
        text: `Your Order Has Been Delivered!\n\nHi {{customerName}},\n\nGreat news! Your order #{{orderNo}} has been successfully delivered.\n\nShare your feedback: {{feedbackLink}}\n\nThank you for shopping with us!\n\nBest regards,\nCJDQuick Team`,
      },
    };

    const template = templates[templateName];
    if (!template) {
      return {
        success: false,
        status: 'FAILED',
        error: `Template not found: ${templateName}`,
      };
    }

    // Replace variables in template
    let htmlContent = template.html;
    let textContent = template.text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlContent = htmlContent.replace(regex, value);
      textContent = textContent.replace(regex, value);
    }

    return this.sendMessage({
      to,
      subject,
      content: textContent,
      htmlContent,
    } as EmailRequest);
  }
}

// Singleton instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}
