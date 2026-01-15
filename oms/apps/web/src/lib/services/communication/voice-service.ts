// AI Voice Service
// Supports Exotel (India) and Twilio (International)
// Includes AI-powered conversation capabilities

import type {
  VoiceProvider,
  SendMessageRequest,
  SendMessageResponse,
  VoiceCallRequest,
  VoiceCallResponse,
  MessageStatus,
} from './types';

type VoiceProviderType = 'EXOTEL' | 'TWILIO' | 'KNOWLARITY';

interface VoiceConfig {
  provider: VoiceProviderType;
  // Exotel config
  exotelApiKey?: string;
  exotelApiToken?: string;
  exotelSid?: string;
  exotelCallerId?: string;
  // Twilio config
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  // Knowlarity config
  knowlarityApiKey?: string;
  knowlarityNumber?: string;
  // AI Voice config
  aiVoiceEnabled?: boolean;
  aiVoiceLanguages?: string[];
  defaultLanguage?: string;
}

// AI Voice conversation scripts for NDR resolution
const NDR_VOICE_SCRIPTS = {
  en: {
    greeting: "Hello, this is an automated call from CJDQuick regarding your recent order.",
    orderIntro: "Your order number {{orderNo}} couldn't be delivered because {{reason}}.",
    askAction: "Please say 'reschedule' to arrange a new delivery time, 'address' to update your address, or 'cancel' to cancel the order.",
    confirmReschedule: "I will schedule a redelivery for you. What time slot works best? Morning, afternoon, or evening?",
    confirmAddress: "Please provide your updated address after the beep.",
    thankYou: "Thank you. Your request has been noted. You will receive a confirmation shortly. Goodbye!",
    notUnderstood: "I'm sorry, I didn't understand. Please say 'reschedule', 'address', or 'cancel'.",
    transferAgent: "Let me connect you to a customer service agent. Please hold.",
  },
  hi: {
    greeting: "नमस्ते, यह CJDQuick की ओर से आपके हाल के ऑर्डर के बारे में एक स्वचालित कॉल है।",
    orderIntro: "आपका ऑर्डर नंबर {{orderNo}} डिलीवर नहीं हो सका क्योंकि {{reason}}।",
    askAction: "कृपया नई डिलीवरी के लिए 'reschedule' बोलें, पता बदलने के लिए 'address' बोलें, या ऑर्डर रद्द करने के लिए 'cancel' बोलें।",
    confirmReschedule: "मैं आपके लिए री-डिलीवरी शेड्यूल करूंगा। कौन सा समय अच्छा रहेगा? सुबह, दोपहर, या शाम?",
    confirmAddress: "कृपया बीप के बाद अपना नया पता बताएं।",
    thankYou: "धन्यवाद। आपका अनुरोध नोट कर लिया गया है। आपको जल्द ही पुष्टि मिल जाएगी। अलविदा!",
    notUnderstood: "क्षमा करें, मुझे समझ नहीं आया। कृपया 'reschedule', 'address', या 'cancel' बोलें।",
    transferAgent: "मैं आपको ग्राहक सेवा एजेंट से जोड़ रहा हूं। कृपया प्रतीक्षा करें।",
  },
};

const NDR_REASON_TRANSLATIONS = {
  en: {
    CUSTOMER_NOT_AVAILABLE: "you were not available at the delivery address",
    WRONG_ADDRESS: "the address provided was incorrect",
    CUSTOMER_REFUSED: "the delivery was refused",
    INCOMPLETE_ADDRESS: "the address was incomplete",
    FUTURE_DELIVERY_REQUESTED: "you requested future delivery",
    COD_NOT_READY: "the COD amount was not ready",
    PHONE_NOT_REACHABLE: "we couldn't reach you by phone",
    PREMISES_CLOSED: "the premises were closed",
  },
  hi: {
    CUSTOMER_NOT_AVAILABLE: "आप डिलीवरी पते पर उपलब्ध नहीं थे",
    WRONG_ADDRESS: "दिया गया पता गलत था",
    CUSTOMER_REFUSED: "डिलीवरी स्वीकार नहीं की गई",
    INCOMPLETE_ADDRESS: "पता अधूरा था",
    FUTURE_DELIVERY_REQUESTED: "आपने भविष्य में डिलीवरी का अनुरोध किया",
    COD_NOT_READY: "COD राशि तैयार नहीं थी",
    PHONE_NOT_REACHABLE: "हम फोन पर आपसे संपर्क नहीं कर सके",
    PREMISES_CLOSED: "परिसर बंद था",
  },
};

export class VoiceService implements VoiceProvider {
  name = 'AI Voice Service';
  type = 'AI_VOICE' as const;

  private config: VoiceConfig;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = {
      provider: (config?.provider || process.env.VOICE_PROVIDER || 'EXOTEL') as VoiceProviderType,
      exotelApiKey: config?.exotelApiKey || process.env.EXOTEL_API_KEY,
      exotelApiToken: config?.exotelApiToken || process.env.EXOTEL_API_TOKEN,
      exotelSid: config?.exotelSid || process.env.EXOTEL_SID,
      exotelCallerId: config?.exotelCallerId || process.env.EXOTEL_CALLER_ID,
      twilioAccountSid: config?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: config?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: config?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER,
      knowlarityApiKey: config?.knowlarityApiKey || process.env.KNOWLARITY_API_KEY,
      knowlarityNumber: config?.knowlarityNumber || process.env.KNOWLARITY_NUMBER,
      aiVoiceEnabled: config?.aiVoiceEnabled ?? true,
      aiVoiceLanguages: config?.aiVoiceLanguages || ['en', 'hi'],
      defaultLanguage: config?.defaultLanguage || 'en',
    };
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // For voice, we initiate a call instead of sending a message
    const callResult = await this.initiateCall({
      to: request.to,
      script: request.content,
      language: request.language,
      variables: request.variables,
    });

    return {
      success: callResult.success,
      messageId: callResult.callId,
      providerMessageId: callResult.callId,
      status: callResult.success ? 'SENT' : 'FAILED',
      error: callResult.error,
    };
  }

  async initiateCall(request: VoiceCallRequest): Promise<VoiceCallResponse> {
    if (this.config.provider === 'EXOTEL') {
      return this.initiateExotelCall(request);
    } else if (this.config.provider === 'TWILIO') {
      return this.initiateTwilioCall(request);
    } else {
      return this.initiateKnowlarityCall(request);
    }
  }

  private async initiateExotelCall(request: VoiceCallRequest): Promise<VoiceCallResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to);
      const callerId = request.callerId || this.config.exotelCallerId;

      // Exotel API for outbound calls
      const url = `https://api.exotel.com/v1/Accounts/${this.config.exotelSid}/Calls/connect`;

      const formData = new URLSearchParams();
      formData.append('From', phone);
      formData.append('CallerId', callerId || '');
      formData.append('CallType', 'trans'); // Transactional call

      // If using Exotel's App (IVR flow)
      if (request.script) {
        formData.append('Url', `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/exotel-flow`);
        formData.append('CustomField', JSON.stringify({
          script: request.script,
          language: request.language,
          variables: request.variables,
        }));
      }

      if (request.recordCall) {
        formData.append('Record', 'true');
      }

      const credentials = Buffer.from(
        `${this.config.exotelApiKey}:${this.config.exotelApiToken}`
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

      if (response.ok && data.Call?.Sid) {
        return {
          success: true,
          callId: data.Call.Sid,
          status: 'INITIATED',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.RestException?.Message || 'Failed to initiate Exotel call',
      };
    } catch (error) {
      console.error('Exotel call error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async initiateTwilioCall(request: VoiceCallRequest): Promise<VoiceCallResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to, true);

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Calls.json`;

      const formData = new URLSearchParams();
      formData.append('To', phone);
      formData.append('From', request.callerId || this.config.twilioPhoneNumber || '');

      // Use TwiML for voice flow
      if (request.script) {
        const twiml = this.generateTwiML(request.script, request.language || 'en');
        formData.append('Twiml', twiml);
      } else {
        formData.append('Url', `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/twilio-flow`);
      }

      if (request.recordCall) {
        formData.append('Record', 'true');
      }

      if (request.maxDuration) {
        formData.append('Timeout', Math.floor(request.maxDuration / 60).toString());
      }

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
          callId: data.sid,
          status: this.mapTwilioStatus(data.status),
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.message || 'Failed to initiate Twilio call',
      };
    } catch (error) {
      console.error('Twilio call error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async initiateKnowlarityCall(request: VoiceCallRequest): Promise<VoiceCallResponse> {
    try {
      const phone = this.formatPhoneNumber(request.to);

      // Knowlarity Click to Call API
      const url = 'https://kpi.knowlarity.com/Basic/v1/account/call/makecall';

      const payload = {
        k_number: this.config.knowlarityNumber,
        agent_number: request.callerId || this.config.knowlarityNumber,
        customer_number: phone,
        caller_id: this.config.knowlarityNumber,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.config.knowlarityApiKey || '',
          'Content-Type': 'application/json',
          'x-]api-key': this.config.knowlarityApiKey || '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          callId: data.call_id,
          status: 'INITIATED',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.message || 'Failed to initiate Knowlarity call',
      };
    } catch (error) {
      console.error('Knowlarity call error:', error);
      return {
        success: false,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCallStatus(callId: string): Promise<VoiceCallResponse> {
    if (this.config.provider === 'TWILIO') {
      return this.getTwilioCallStatus(callId);
    } else if (this.config.provider === 'EXOTEL') {
      return this.getExotelCallStatus(callId);
    }
    return {
      success: true,
      callId,
      status: 'IN_PROGRESS',
    };
  }

  private async getTwilioCallStatus(callId: string): Promise<VoiceCallResponse> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Calls/${callId}.json`;

      const credentials = Buffer.from(
        `${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`
      ).toString('base64');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const data = await response.json();

      return {
        success: true,
        callId,
        status: this.mapTwilioStatus(data.status),
        duration: data.duration ? parseInt(data.duration) : undefined,
      };
    } catch {
      return {
        success: false,
        callId,
        status: 'FAILED',
      };
    }
  }

  private async getExotelCallStatus(callId: string): Promise<VoiceCallResponse> {
    try {
      const url = `https://api.exotel.com/v1/Accounts/${this.config.exotelSid}/Calls/${callId}`;

      const credentials = Buffer.from(
        `${this.config.exotelApiKey}:${this.config.exotelApiToken}`
      ).toString('base64');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const data = await response.json();

      const statusMap: Record<string, VoiceCallResponse['status']> = {
        queued: 'INITIATED',
        ringing: 'RINGING',
        'in-progress': 'IN_PROGRESS',
        completed: 'COMPLETED',
        failed: 'FAILED',
        busy: 'BUSY',
        'no-answer': 'NO_ANSWER',
      };

      return {
        success: true,
        callId,
        status: statusMap[data.Call?.Status] || 'IN_PROGRESS',
        duration: data.Call?.Duration ? parseInt(data.Call.Duration) : undefined,
        recordingUrl: data.Call?.RecordingUrl,
      };
    } catch {
      return {
        success: false,
        callId,
        status: 'FAILED',
      };
    }
  }

  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    const callStatus = await this.getCallStatus(messageId);
    return {
      messageId,
      status: callStatus.status === 'COMPLETED' ? 'DELIVERED' : 'PENDING',
    };
  }

  // Generate TwiML for voice flow
  private generateTwiML(script: string, language: string): string {
    const voice = language === 'hi' ? 'Polly.Aditi' : 'Polly.Raveena';
    return `
      <Response>
        <Say voice="${voice}" language="${language === 'hi' ? 'hi-IN' : 'en-IN'}">
          ${script}
        </Say>
      </Response>
    `;
  }

  // Generate AI voice script for NDR resolution
  generateNDRScript(
    orderNo: string,
    reason: string,
    language: string = 'en'
  ): string {
    const scripts = NDR_VOICE_SCRIPTS[language as keyof typeof NDR_VOICE_SCRIPTS] || NDR_VOICE_SCRIPTS.en;
    const reasons = NDR_REASON_TRANSLATIONS[language as keyof typeof NDR_REASON_TRANSLATIONS] || NDR_REASON_TRANSLATIONS.en;

    const reasonText = reasons[reason as keyof typeof reasons] || reason;

    let script = scripts.greeting + ' ';
    script += scripts.orderIntro.replace('{{orderNo}}', orderNo).replace('{{reason}}', reasonText) + ' ';
    script += scripts.askAction;

    return script;
  }

  // Initiate NDR resolution call
  async initiateNDRCall(
    phone: string,
    orderNo: string,
    reason: string,
    language: string = 'en'
  ): Promise<VoiceCallResponse> {
    const script = this.generateNDRScript(orderNo, reason, language);

    return this.initiateCall({
      to: phone,
      script,
      language,
      variables: {
        orderNo,
        reason,
      },
      recordCall: true,
      maxDuration: 300, // 5 minutes max
    });
  }

  private formatPhoneNumber(phone: string, includePrefix = false): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return includePrefix ? '+' + cleaned : cleaned;
  }

  private mapTwilioStatus(status: string): VoiceCallResponse['status'] {
    const statusMap: Record<string, VoiceCallResponse['status']> = {
      queued: 'INITIATED',
      ringing: 'RINGING',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      failed: 'FAILED',
      busy: 'BUSY',
      'no-answer': 'NO_ANSWER',
      canceled: 'FAILED',
    };
    return statusMap[status] || 'IN_PROGRESS';
  }
}

// Singleton instance
let voiceService: VoiceService | null = null;

export function getVoiceService(): VoiceService {
  if (!voiceService) {
    voiceService = new VoiceService();
  }
  return voiceService;
}
