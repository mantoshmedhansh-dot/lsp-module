// Communication Services Index
// Unified exports for all communication channels

export * from './types';
export { WhatsAppService, getWhatsAppService } from './whatsapp-service';
export { SMSService, getSMSService } from './sms-service';
export { EmailService, getEmailService } from './email-service';
export { VoiceService, getVoiceService } from './voice-service';

import type { OutreachChannel, SendMessageRequest, SendMessageResponse } from './types';
import { getWhatsAppService } from './whatsapp-service';
import { getSMSService } from './sms-service';
import { getEmailService } from './email-service';
import { getVoiceService } from './voice-service';

// Unified communication service
export class CommunicationService {
  private static instance: CommunicationService;

  static getInstance(): CommunicationService {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService();
    }
    return CommunicationService.instance;
  }

  async sendMessage(
    channel: OutreachChannel,
    request: SendMessageRequest
  ): Promise<SendMessageResponse> {
    switch (channel) {
      case 'WHATSAPP':
        return getWhatsAppService().sendMessage(request);
      case 'SMS':
        return getSMSService().sendMessage(request);
      case 'EMAIL':
        return getEmailService().sendMessage(request);
      case 'AI_VOICE':
      case 'IVR':
        // Voice calls use initiateCall, not sendMessage
        return {
          success: false,
          status: 'FAILED',
          error: 'Use initiateVoiceCall for voice channels',
        };
      case 'MANUAL_CALL':
        return {
          success: false,
          status: 'FAILED',
          error: 'Manual calls cannot be sent programmatically',
        };
      default:
        return {
          success: false,
          status: 'FAILED',
          error: `Unknown channel: ${channel}`,
        };
    }
  }

  async initiateVoiceCall(
    to: string,
    script: string,
    language: string = 'en'
  ): Promise<{ success: boolean; callId?: string; error?: string }> {
    const voiceService = getVoiceService();
    const result = await voiceService.initiateCall({
      to,
      script,
      language,
    });

    return {
      success: result.success,
      callId: result.callId,
      error: result.error,
    };
  }

  async sendNDRResolution(
    channel: OutreachChannel,
    to: string,
    email: string | null,
    orderNo: string,
    reason: string,
    language: string = 'en'
  ): Promise<SendMessageResponse> {
    switch (channel) {
      case 'WHATSAPP':
        return getWhatsAppService().sendNDRResolutionMessage(to, orderNo, reason);

      case 'SMS':
        return getSMSService().sendNDRSMS(to, orderNo, reason);

      case 'EMAIL':
        if (!email) {
          return {
            success: false,
            status: 'FAILED',
            error: 'Email address required for EMAIL channel',
          };
        }
        return getEmailService().sendTemplatedEmail(
          email,
          'NDR_NOTIFICATION',
          { orderNo, reason, customerName: 'Customer' },
          `Delivery Update for Order #${orderNo}`
        );

      case 'AI_VOICE':
        const voiceResult = await getVoiceService().initiateNDRCall(
          to,
          orderNo,
          reason,
          language
        );
        return {
          success: voiceResult.success,
          messageId: voiceResult.callId,
          providerMessageId: voiceResult.callId,
          status: voiceResult.success ? 'SENT' : 'FAILED',
          error: voiceResult.error,
        };

      default:
        return {
          success: false,
          status: 'FAILED',
          error: `Channel ${channel} not supported for NDR resolution`,
        };
    }
  }

  // Check if within working hours for outreach
  isWithinWorkingHours(
    workingHours: { start: string; end: string } = { start: '09:00', end: '21:00' }
  ): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  // Get channel priority for fallback
  getChannelPriority(channel: OutreachChannel): number {
    const priorities: Record<OutreachChannel, number> = {
      'WHATSAPP': 1,
      'AI_VOICE': 2,
      'SMS': 3,
      'IVR': 4,
      'EMAIL': 5,
      'MANUAL_CALL': 6,
    };
    return priorities[channel] || 99;
  }
}

// Singleton export
export function getCommunicationService(): CommunicationService {
  return CommunicationService.getInstance();
}
