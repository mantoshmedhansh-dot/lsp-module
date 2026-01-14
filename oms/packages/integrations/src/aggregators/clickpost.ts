/**
 * ClickPost Logistics Aggregator Integration
 *
 * ClickPost provides unified API for multiple courier partners including:
 * - Delhivery, BlueDart, DTDC, Ekart, Shadowfax, XpressBees, Ecom Express
 * - Automatic courier recommendation and allocation
 * - NDR management, tracking, and analytics
 *
 * API Documentation: https://developers.clickpost.ai/docs
 */

import crypto from 'crypto';
import { HttpClient, createHttpClient } from '../http-client';
import {
  CreateShipmentRequest,
  CreateShipmentResponse,
  TrackingResponse,
  TrackingEvent,
  CancelShipmentRequest,
  CancelShipmentResponse,
  RateCalculationRequest,
  RateCalculationResponse,
  PincodeServiceability,
} from '../transporters/types';
import {
  IAggregatorIntegration,
  AggregatorCredentials,
  CourierPartner,
  RecommendCourierRequest,
  RecommendCourierResponse,
  CourierRecommendation,
  BulkTrackingRequest,
  BulkTrackingResponse,
  NDRDetails,
  NDRActionRequest,
  NDRActionResponse,
  ManifestRequest,
  ManifestResponse,
  WebhookEvent,
} from './types';

// ClickPost courier codes mapping
const COURIER_CODE_MAP: Record<string, string> = {
  'delhivery': 'Delhivery',
  'bluedart': 'BlueDart',
  'dtdc': 'DTDC',
  'ekart': 'Ekart',
  'shadowfax': 'Shadowfax',
  'xpressbees': 'XpressBees',
  'ecomexpress': 'Ecom Express',
  'fedex': 'FedEx',
  'aramex': 'Aramex',
  'gati': 'Gati',
  'firstflight': 'First Flight',
  'spoton': 'SpotOn',
  'trackon': 'Trackon',
};

// ClickPost status code mapping to standard statuses
const STATUS_MAP: Record<number, string> = {
  1: 'ORDER_PLACED',
  2: 'MANIFESTED',
  3: 'PICKUP_SCHEDULED',
  4: 'PICKED_UP',
  5: 'IN_TRANSIT',
  6: 'OUT_FOR_DELIVERY',
  7: 'DELIVERED',
  8: 'RTO_INITIATED',
  9: 'RTO_IN_TRANSIT',
  10: 'RTO_DELIVERED',
  11: 'CANCELLED',
  12: 'NDR',
  13: 'LOST',
  14: 'DAMAGED',
  15: 'PICKUP_FAILED',
};

interface ClickPostOrder {
  waybill: string;
  reference_number: string;
  courier_partner_id: number;
  courier_name: string;
  label_url?: string;
  invoice_url?: string;
}

interface ClickPostTrackingStatus {
  clickpost_status_code: number;
  clickpost_status_description: string;
  clickpost_status_bucket: string;
  location: string;
  timestamp: string;
  remark: string;
}

interface ClickPostNDR {
  waybill: string;
  ndr_type: string;
  ndr_reason: string;
  attempt_count: number;
  last_attempt_date: string;
  customer_remark?: string;
  courier_remark?: string;
}

export class ClickPostIntegration implements IAggregatorIntegration {
  name = 'ClickPost';
  code = 'CLICKPOST';

  private client: HttpClient;
  private credentials: AggregatorCredentials;
  private isAuthenticated = false;

  constructor(credentials: AggregatorCredentials) {
    this.credentials = credentials;

    const baseURL = credentials.environment === 'sandbox'
      ? 'https://sandbox.clickpost.in/api/v1'
      : 'https://api.clickpost.in/api/v1';

    this.client = createHttpClient({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': credentials.apiKey,
      },
    });
  }

  async authenticate(): Promise<boolean> {
    try {
      // Test authentication by fetching courier partners
      const response = await this.client.get<{
        meta: { success: boolean };
        result: unknown[];
      }>('/courier-partners/');

      this.isAuthenticated = response.success && response.data?.meta?.success === true;
      return this.isAuthenticated;
    } catch (error) {
      console.error('ClickPost authentication failed:', error);
      return false;
    }
  }

  async getCourierPartners(): Promise<{ success: boolean; partners?: CourierPartner[]; error?: string }> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: {
          id: number;
          name: string;
          display_name: string;
          logo_url?: string;
          is_active: boolean;
          supports_cod: boolean;
          supports_reverse: boolean;
          avg_delivery_days?: number;
        }[];
      }>('/courier-partners/');

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.error || 'Failed to fetch courier partners',
        };
      }

      const partners: CourierPartner[] = response.data.result.map((cp) => ({
        code: cp.name.toLowerCase().replace(/\s+/g, '_'),
        name: cp.name,
        displayName: cp.display_name,
        logo: cp.logo_url,
        isActive: cp.is_active,
        supportsCOD: cp.supports_cod,
        supportsReverse: cp.supports_reverse,
        avgDeliveryDays: cp.avg_delivery_days,
      }));

      return { success: true, partners };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async recommendCourier(request: RecommendCourierRequest): Promise<RecommendCourierResponse> {
    try {
      const payload = {
        pickup_pincode: request.pickupPincode,
        drop_pincode: request.deliveryPincode,
        weight: request.weight * 1000, // Convert kg to grams
        length: request.length || 10,
        breadth: request.width || 10,
        height: request.height || 10,
        cod: request.paymentMode === 'COD' ? 1 : 0,
        order_value: request.orderValue || request.codAmount || 0,
        delivery_type: request.deliveryType === 'REVERSE' ? 'reverse' : 'forward',
      };

      const response = await this.client.post<{
        meta: { success: boolean };
        result: {
          courier_partner_id: number;
          courier_name: string;
          score: number;
          estimated_delivery_days: number;
          estimated_cost: number;
          rating?: number;
          reasons?: string[];
        }[];
      }>('/courier-recommendation/', payload);

      if (!response.success || !response.data?.meta?.success || !response.data.result?.length) {
        return {
          success: false,
          error: response.error || 'No courier recommendations available',
        };
      }

      const recommendations: CourierRecommendation[] = response.data.result.map((r) => ({
        courierCode: r.courier_name.toLowerCase().replace(/\s+/g, '_'),
        courierName: COURIER_CODE_MAP[r.courier_name.toLowerCase()] || r.courier_name,
        score: r.score,
        estimatedDeliveryDays: r.estimated_delivery_days,
        estimatedCost: r.estimated_cost,
        rating: r.rating,
        reasons: r.reasons,
      }));

      // Sort by priority preference
      if (request.priority === 'COST') {
        recommendations.sort((a, b) => a.estimatedCost - b.estimatedCost);
      } else if (request.priority === 'SPEED') {
        recommendations.sort((a, b) => a.estimatedDeliveryDays - b.estimatedDeliveryDays);
      }
      // Default is RELIABILITY which is based on score

      return {
        success: true,
        recommendations,
        selectedCourier: recommendations[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createShipment(request: CreateShipmentRequest, courierCode?: string): Promise<CreateShipmentResponse> {
    try {
      // If no courier specified, get recommendation first
      let selectedCourier = courierCode;
      if (!selectedCourier) {
        const recommendation = await this.recommendCourier({
          pickupPincode: request.pickupAddress.pincode,
          deliveryPincode: request.deliveryAddress.pincode,
          weight: request.weight,
          length: request.length,
          width: request.width,
          height: request.height,
          paymentMode: request.paymentMode,
          codAmount: request.codAmount,
          orderValue: request.invoiceValue,
          deliveryType: request.deliveryType,
        });

        if (!recommendation.success || !recommendation.selectedCourier) {
          return {
            success: false,
            error: recommendation.error || 'No suitable courier found',
          };
        }

        selectedCourier = recommendation.selectedCourier.courierCode;
      }

      const payload = {
        pickup_name: request.pickupAddress.name,
        pickup_phone: request.pickupAddress.phone,
        pickup_address: request.pickupAddress.addressLine1,
        pickup_address_2: request.pickupAddress.addressLine2 || '',
        pickup_city: request.pickupAddress.city,
        pickup_state: request.pickupAddress.state,
        pickup_pincode: request.pickupAddress.pincode,
        pickup_country: request.pickupAddress.country || 'India',

        drop_name: request.deliveryAddress.name,
        drop_phone: request.deliveryAddress.phone,
        drop_email: request.deliveryAddress.email || '',
        drop_address: request.deliveryAddress.addressLine1,
        drop_address_2: request.deliveryAddress.addressLine2 || '',
        drop_city: request.deliveryAddress.city,
        drop_state: request.deliveryAddress.state,
        drop_pincode: request.deliveryAddress.pincode,
        drop_country: request.deliveryAddress.country || 'India',

        order_type: request.deliveryType === 'REVERSE' ? 'REVERSE' : 'PREPAID',
        payment_mode: request.paymentMode,
        cod_amount: request.paymentMode === 'COD' ? request.codAmount || 0 : 0,

        reference_number: request.orderNo,
        invoice_number: request.invoiceNo || request.orderNo,
        invoice_value: request.invoiceValue,
        invoice_date: (request.invoiceDate || new Date()).toISOString().split('T')[0],

        weight: request.weight * 1000, // Convert kg to grams
        length: request.length || 10,
        breadth: request.width || 10,
        height: request.height || 10,

        items: request.items.map((item) => ({
          sku: item.skuCode,
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          hsn: item.hsn || '',
        })),

        courier_partner: selectedCourier,
        additional: {
          remarks: request.remarks || '',
        },
      };

      const response = await this.client.post<{
        meta: { success: boolean; message?: string };
        result: ClickPostOrder;
      }>('/create-order/', payload);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.data?.meta?.message || response.error || 'Failed to create shipment',
        };
      }

      const order = response.data.result;

      return {
        success: true,
        awbNo: order.waybill,
        courierName: COURIER_CODE_MAP[order.courier_name?.toLowerCase()] || order.courier_name,
        shipmentId: order.reference_number,
        labelUrl: order.label_url,
        invoiceUrl: order.invoice_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async trackShipment(awbNo: string): Promise<TrackingResponse> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: {
          waybill: string;
          latest_status: ClickPostTrackingStatus;
          scans: ClickPostTrackingStatus[];
          delivered_date?: string;
          delivered_to?: string;
        };
      }>(`/tracking/?waybill=${awbNo}`);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          awbNo,
          error: response.error || 'Failed to track shipment',
        };
      }

      const tracking = response.data.result;
      const latestStatus = tracking.latest_status;

      const events: TrackingEvent[] = (tracking.scans || []).map((scan) => ({
        status: STATUS_MAP[scan.clickpost_status_code] || scan.clickpost_status_description,
        statusCode: scan.clickpost_status_code.toString(),
        location: scan.location,
        timestamp: new Date(scan.timestamp),
        remarks: scan.remark,
      }));

      return {
        success: true,
        awbNo,
        currentStatus: STATUS_MAP[latestStatus.clickpost_status_code] || latestStatus.clickpost_status_description,
        currentStatusCode: latestStatus.clickpost_status_code.toString(),
        deliveredAt: tracking.delivered_date ? new Date(tracking.delivered_date) : undefined,
        deliveredTo: tracking.delivered_to,
        events,
      };
    } catch (error) {
      return {
        success: false,
        awbNo,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async bulkTrack(request: BulkTrackingRequest): Promise<BulkTrackingResponse> {
    try {
      const results = await Promise.all(
        request.awbNumbers.map(async (awbNo) => {
          try {
            const tracking = await this.trackShipment(awbNo);
            return { awbNo, tracking };
          } catch (error) {
            return {
              awbNo,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      return {
        success: true,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<CancelShipmentResponse> {
    try {
      const response = await this.client.post<{
        meta: { success: boolean; message?: string };
      }>('/cancel-order/', {
        waybill: request.awbNo,
        cancellation_reason: request.reason || 'Customer request',
      });

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.data?.meta?.message || response.error || 'Failed to cancel shipment',
        };
      }

      return {
        success: true,
        message: 'Shipment cancelled successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async calculateRates(request: RateCalculationRequest): Promise<RateCalculationResponse> {
    try {
      const payload = {
        pickup_pincode: request.pickupPincode,
        drop_pincode: request.deliveryPincode,
        weight: request.weight * 1000, // Convert kg to grams
        length: request.length || 10,
        breadth: request.width || 10,
        height: request.height || 10,
        cod: request.paymentMode === 'COD' ? 1 : 0,
        cod_amount: request.codAmount || 0,
      };

      const response = await this.client.post<{
        meta: { success: boolean };
        result: {
          courier_partner_id: number;
          courier_name: string;
          rate: number;
          cod_charges?: number;
          fuel_surcharge?: number;
          total_rate: number;
          estimated_delivery_days?: number;
        }[];
      }>('/rate-calculator/', payload);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.error || 'Failed to calculate rates',
        };
      }

      const rates = response.data.result.map((r) => ({
        courierCode: r.courier_name.toLowerCase().replace(/\s+/g, '_'),
        courierName: COURIER_CODE_MAP[r.courier_name.toLowerCase()] || r.courier_name,
        rate: r.rate,
        codCharges: r.cod_charges,
        fuelSurcharge: r.fuel_surcharge,
        totalRate: r.total_rate,
        estimatedDays: r.estimated_delivery_days,
      }));

      return {
        success: true,
        rates,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkServiceability(pincode: string, courierCode?: string): Promise<PincodeServiceability[]> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: {
          courier_partner_id: number;
          courier_name: string;
          cod_available: boolean;
          prepaid_available: boolean;
          estimated_delivery_days?: number;
        }[];
      }>(`/serviceability/?pincode=${pincode}${courierCode ? `&courier=${courierCode}` : ''}`);

      if (!response.success || !response.data?.meta?.success) {
        return [];
      }

      return response.data.result.map((r) => ({
        pincode,
        serviceable: r.prepaid_available || r.cod_available,
        codAvailable: r.cod_available,
        prepaidAvailable: r.prepaid_available,
        estimatedDays: r.estimated_delivery_days,
        courierCodes: [r.courier_name.toLowerCase().replace(/\s+/g, '_')],
      }));
    } catch {
      return [];
    }
  }

  async getNDRList(): Promise<{ success: boolean; ndrList?: NDRDetails[]; error?: string }> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: ClickPostNDR[];
      }>('/ndr/');

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.error || 'Failed to fetch NDR list',
        };
      }

      const ndrList: NDRDetails[] = response.data.result.map((ndr) => ({
        awbNo: ndr.waybill,
        ndrType: ndr.ndr_type,
        ndrReason: ndr.ndr_reason,
        attemptCount: ndr.attempt_count,
        lastAttemptDate: new Date(ndr.last_attempt_date),
        customerRemarks: ndr.customer_remark,
        agentRemarks: ndr.courier_remark,
      }));

      return { success: true, ndrList };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async takeNDRAction(request: NDRActionRequest): Promise<NDRActionResponse> {
    try {
      const actionMap: Record<string, string> = {
        'REATTEMPT': 'reattempt',
        'RTO': 'rto',
        'ADDRESS_UPDATE': 'address_update',
        'RESCHEDULE': 'reschedule',
      };

      const payload: Record<string, unknown> = {
        waybill: request.awbNo,
        action: actionMap[request.action] || request.action.toLowerCase(),
        remark: request.remarks || '',
      };

      if (request.rescheduleDate) {
        payload.reschedule_date = request.rescheduleDate.toISOString().split('T')[0];
      }

      if (request.newAddress) {
        payload.new_address = {
          address: request.newAddress.addressLine1,
          address_2: request.newAddress.addressLine2 || '',
          city: request.newAddress.city,
          state: request.newAddress.state,
          pincode: request.newAddress.pincode,
          phone: request.newAddress.phone,
        };
      }

      const response = await this.client.post<{
        meta: { success: boolean; message?: string };
      }>('/ndr/action/', payload);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.data?.meta?.message || response.error || 'Failed to process NDR action',
        };
      }

      return {
        success: true,
        message: response.data.meta.message || 'NDR action processed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createManifest(request: ManifestRequest): Promise<ManifestResponse> {
    try {
      const payload = {
        courier_partner: request.courierCode,
        waybills: request.awbNumbers,
        pickup_date: request.pickupDate?.toISOString().split('T')[0] ||
          new Date().toISOString().split('T')[0],
        pickup_slot: request.pickupSlot || '10:00-18:00',
      };

      const response = await this.client.post<{
        meta: { success: boolean; message?: string };
        result: {
          manifest_id: string;
          manifest_url?: string;
          pickup_scheduled: boolean;
          pickup_date?: string;
        };
      }>('/manifest/', payload);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.data?.meta?.message || response.error || 'Failed to create manifest',
        };
      }

      const manifest = response.data.result;

      return {
        success: true,
        manifestId: manifest.manifest_id,
        manifestUrl: manifest.manifest_url,
        pickupScheduled: manifest.pickup_scheduled,
        pickupDate: manifest.pickup_date ? new Date(manifest.pickup_date) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async schedulePickup(request: ManifestRequest): Promise<ManifestResponse> {
    // ClickPost combines manifest and pickup scheduling
    return this.createManifest(request);
  }

  async generateLabel(awbNo: string): Promise<{ success: boolean; labelUrl?: string; error?: string }> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: { label_url: string };
      }>(`/label/?waybill=${awbNo}`);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.error || 'Failed to generate label',
        };
      }

      return {
        success: true,
        labelUrl: response.data.result.label_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async generateInvoice(awbNo: string): Promise<{ success: boolean; invoiceUrl?: string; error?: string }> {
    try {
      const response = await this.client.get<{
        meta: { success: boolean };
        result: { invoice_url: string };
      }>(`/invoice/?waybill=${awbNo}`);

      if (!response.success || !response.data?.meta?.success) {
        return {
          success: false,
          error: response.error || 'Failed to generate invoice',
        };
      }

      return {
        success: true,
        invoiceUrl: response.data.result.invoice_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.credentials.webhookSecret) {
      console.warn('Webhook secret not configured');
      return false;
    }

    const hmac = crypto
      .createHmac('sha256', this.credentials.webhookSecret)
      .update(payload)
      .digest('hex');

    return hmac === signature;
  }

  parseWebhookEvent(payload: unknown): WebhookEvent | null {
    try {
      const data = payload as {
        event_type: string;
        waybill: string;
        courier_partner: string;
        clickpost_status_code: number;
        clickpost_status_description: string;
        timestamp: string;
        location?: string;
        remark?: string;
      };

      return {
        eventType: data.event_type,
        awbNo: data.waybill,
        courierCode: data.courier_partner?.toLowerCase().replace(/\s+/g, '_'),
        status: STATUS_MAP[data.clickpost_status_code] || data.clickpost_status_description,
        statusCode: data.clickpost_status_code.toString(),
        timestamp: new Date(data.timestamp),
        location: data.location,
        remarks: data.remark,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }
}

// Factory function
export function createClickPostIntegration(credentials: AggregatorCredentials): ClickPostIntegration {
  return new ClickPostIntegration(credentials);
}
