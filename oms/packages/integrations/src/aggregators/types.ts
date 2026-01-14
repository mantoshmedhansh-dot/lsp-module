/**
 * Types for Logistics Aggregator Integrations
 *
 * Aggregators like ClickPost, Shiprocket provide unified APIs
 * to manage multiple courier partners through a single integration.
 */

import {
  CreateShipmentRequest,
  CreateShipmentResponse,
  TrackingResponse,
  CancelShipmentRequest,
  CancelShipmentResponse,
  RateCalculationRequest,
  RateCalculationResponse,
  PincodeServiceability,
} from '../transporters/types';

export interface AggregatorCredentials {
  apiKey: string;
  username?: string;
  password?: string;
  accountId?: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
}

export interface CourierPartner {
  code: string;
  name: string;
  displayName?: string;
  logo?: string;
  isActive: boolean;
  supportsCOD: boolean;
  supportsReverse: boolean;
  avgDeliveryDays?: number;
}

export interface CourierRecommendation {
  courierCode: string;
  courierName: string;
  score: number;
  estimatedDeliveryDays: number;
  estimatedCost: number;
  rating?: number;
  reasons?: string[];
}

export interface RecommendCourierRequest {
  pickupPincode: string;
  deliveryPincode: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  paymentMode: 'PREPAID' | 'COD';
  codAmount?: number;
  orderValue?: number;
  deliveryType?: 'FORWARD' | 'REVERSE';
  priority?: 'COST' | 'SPEED' | 'RELIABILITY';
}

export interface RecommendCourierResponse {
  success: boolean;
  recommendations?: CourierRecommendation[];
  selectedCourier?: CourierRecommendation;
  error?: string;
}

export interface BulkTrackingRequest {
  awbNumbers: string[];
}

export interface BulkTrackingResponse {
  success: boolean;
  results?: {
    awbNo: string;
    tracking?: TrackingResponse;
    error?: string;
  }[];
  error?: string;
}

export interface NDRDetails {
  awbNo: string;
  ndrType: string;
  ndrReason: string;
  attemptCount: number;
  lastAttemptDate: Date;
  customerRemarks?: string;
  agentRemarks?: string;
  rescheduleDate?: Date;
  newAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
}

export interface NDRActionRequest {
  awbNo: string;
  action: 'REATTEMPT' | 'RTO' | 'ADDRESS_UPDATE' | 'RESCHEDULE';
  rescheduleDate?: Date;
  newAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  remarks?: string;
}

export interface NDRActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ManifestRequest {
  courierCode: string;
  awbNumbers: string[];
  pickupDate?: Date;
  pickupSlot?: string;
}

export interface ManifestResponse {
  success: boolean;
  manifestId?: string;
  manifestUrl?: string;
  pickupScheduled?: boolean;
  pickupDate?: Date;
  error?: string;
}

export interface WebhookEvent {
  eventType: string;
  awbNo: string;
  courierCode: string;
  status: string;
  statusCode?: string;
  timestamp: Date;
  location?: string;
  remarks?: string;
  rawPayload: unknown;
}

/**
 * Interface that all logistics aggregators must implement
 */
export interface IAggregatorIntegration {
  name: string;
  code: string;

  // Authentication
  authenticate(): Promise<boolean>;

  // Courier management
  getCourierPartners(): Promise<{ success: boolean; partners?: CourierPartner[]; error?: string }>;

  // Courier recommendation
  recommendCourier(request: RecommendCourierRequest): Promise<RecommendCourierResponse>;

  // Shipment operations
  createShipment(request: CreateShipmentRequest, courierCode?: string): Promise<CreateShipmentResponse>;
  trackShipment(awbNo: string): Promise<TrackingResponse>;
  bulkTrack(request: BulkTrackingRequest): Promise<BulkTrackingResponse>;
  cancelShipment(request: CancelShipmentRequest): Promise<CancelShipmentResponse>;

  // Rate & serviceability
  calculateRates(request: RateCalculationRequest): Promise<RateCalculationResponse>;
  checkServiceability(pincode: string, courierCode?: string): Promise<PincodeServiceability[]>;

  // NDR management
  getNDRList?(): Promise<{ success: boolean; ndrList?: NDRDetails[]; error?: string }>;
  takeNDRAction?(request: NDRActionRequest): Promise<NDRActionResponse>;

  // Manifest & pickup
  createManifest?(request: ManifestRequest): Promise<ManifestResponse>;
  schedulePickup?(request: ManifestRequest): Promise<ManifestResponse>;

  // Labels & documents
  generateLabel(awbNo: string): Promise<{ success: boolean; labelUrl?: string; error?: string }>;
  generateInvoice?(awbNo: string): Promise<{ success: boolean; invoiceUrl?: string; error?: string }>;

  // Webhooks
  verifyWebhook?(payload: string, signature: string): boolean;
  parseWebhookEvent?(payload: unknown): WebhookEvent | null;
}
