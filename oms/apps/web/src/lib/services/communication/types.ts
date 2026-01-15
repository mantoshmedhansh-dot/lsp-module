// Communication Service Types

export type OutreachChannel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'AI_VOICE' | 'MANUAL_CALL' | 'IVR';

export interface SendMessageRequest {
  to: string; // Phone number or email
  templateId?: string;
  templateName?: string;
  variables?: Record<string, string>;
  content?: string; // For custom messages
  subject?: string; // For email
  language?: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  error?: string;
  errorCode?: string;
}

export interface VoiceCallRequest {
  to: string;
  callerId?: string;
  script?: string; // AI voice script
  language?: string;
  variables?: Record<string, string>;
  maxDuration?: number; // in seconds
  recordCall?: boolean;
}

export interface VoiceCallResponse {
  success: boolean;
  callId?: string;
  status: 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER' | 'BUSY';
  duration?: number;
  recordingUrl?: string;
  transcription?: string;
  error?: string;
}

export interface MessageStatus {
  messageId: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  deliveredAt?: Date;
  readAt?: Date;
  error?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  example?: { body_text?: string[][] };
}

export interface CommunicationProvider {
  name: string;
  type: OutreachChannel;
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getMessageStatus?(messageId: string): Promise<MessageStatus>;
}

export interface VoiceProvider extends CommunicationProvider {
  initiateCall(request: VoiceCallRequest): Promise<VoiceCallResponse>;
  getCallStatus?(callId: string): Promise<VoiceCallResponse>;
}

// NDR-specific types
export interface NDROutreachConfig {
  maxAttempts: number;
  attemptIntervals: number[]; // minutes after NDR
  channels: OutreachChannel[];
  workingHours: { start: string; end: string };
  languages: string[];
  escalationThreshold: number;
  sentimentEscalation: boolean;
}

export const DEFAULT_NDR_OUTREACH_CONFIG: NDROutreachConfig = {
  maxAttempts: 3,
  attemptIntervals: [60, 120, 240], // 1hr, 2hr, 4hr after NDR
  channels: ['WHATSAPP', 'AI_VOICE', 'SMS'],
  workingHours: { start: '09:00', end: '21:00' },
  languages: ['en', 'hi'],
  escalationThreshold: 2,
  sentimentEscalation: true,
};

// Proactive Communication types
export interface ProactiveCommunicationConfig {
  triggers: {
    [key: string]: {
      enabled: boolean;
      channels: OutreachChannel[];
      timing: string; // e.g., "T-24h" for 24 hours before
      priority: number;
    };
  };
  throttling: {
    maxPerDay: number;
    quietHours: { start: string; end: string };
    consolidation: boolean;
  };
}

export const DEFAULT_PROACTIVE_CONFIG: ProactiveCommunicationConfig = {
  triggers: {
    DELAY_PREDICTED: {
      enabled: true,
      channels: ['WHATSAPP', 'EMAIL'],
      timing: 'T-24h',
      priority: 2,
    },
    SLA_BREACH_RISK: {
      enabled: true,
      channels: ['WHATSAPP'],
      timing: 'IMMEDIATE',
      priority: 1,
    },
    OUT_FOR_DELIVERY: {
      enabled: true,
      channels: ['WHATSAPP', 'SMS'],
      timing: 'IMMEDIATE',
      priority: 3,
    },
    DELIVERED: {
      enabled: true,
      channels: ['WHATSAPP'],
      timing: 'T+30m',
      priority: 5,
    },
  },
  throttling: {
    maxPerDay: 3,
    quietHours: { start: '22:00', end: '08:00' },
    consolidation: true,
  },
};
