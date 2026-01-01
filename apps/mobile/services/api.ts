import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Storage helper that works on both web and native
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async setToken(token: string | null) {
    this.token = token;
  }

  async loadToken() {
    this.token = await storage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<{ user: any }>('/api/auth/me');
  }

  // Tasks
  async getTasks(params?: {
    status?: string;
    type?: string;
    date?: string;
    page?: number;
    pageSize?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());

    const query = searchParams.toString();
    return this.request<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(taskId: string) {
    return this.request<any>(`/api/tasks/${taskId}`);
  }

  async updateTask(taskId: string, data: any) {
    return this.request<any>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async completeTask(
    taskId: string,
    data: {
      podReceiverName?: string;
      podRelation?: string;
      podSignature?: string;
      podPhoto?: string;
      podOtpVerified?: boolean;
      codCollected?: number;
      paymentMode?: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }
  ) {
    return this.request<any>(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async failTask(
    taskId: string,
    data: {
      reason: string;
      notes?: string;
    }
  ) {
    return this.request<any>(`/api/tasks/${taskId}/fail`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFailureReasons(taskId: string, type: 'PICKUP' | 'DELIVERY') {
    return this.request<{ code: string; label: string }[]>(
      `/api/tasks/${taskId}/fail?type=${type}`
    );
  }

  // Scans
  async submitScan(data: {
    awbNumber: string;
    scanType: string;
    hubId?: string;
    tripId?: string;
    consignmentId?: string;
    latitude?: number;
    longitude?: number;
    remarks?: string;
  }) {
    return this.request<any>('/api/scans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitBulkScans(
    scans: Array<{
      awbNumber: string;
      scanType: string;
      hubId?: string;
      tripId?: string;
    }>
  ) {
    return this.request<any>('/api/scans/bulk', {
      method: 'POST',
      body: JSON.stringify({ scans }),
    });
  }

  // Shipments
  async getShipmentByAwb(awbNumber: string) {
    return this.request<any>(`/api/shipments/search?awb=${awbNumber}`);
  }

  async scanShipment(
    shipmentId: string,
    data: {
      scanType: string;
      hubId?: string;
      latitude?: number;
      longitude?: number;
      remarks?: string;
    }
  ) {
    return this.request<any>(`/api/shipments/${shipmentId}/scan`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Trips (for hub operations)
  async getTrips(params?: { status?: string; date?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.date) searchParams.set('date', params.date);
    const query = searchParams.toString();
    return this.request<any[]>(`/api/trips${query ? `?${query}` : ''}`);
  }

  async getTripShipments(tripId: string) {
    return this.request<any[]>(`/api/trips/${tripId}/shipments`);
  }

  // Hub operations
  async getHubStats(hubId: string) {
    return this.request<any>(`/api/hubs/${hubId}/stats`);
  }

  // Route optimization
  async optimizeRoute(data: {
    hubId: string;
    shipmentIds: string[];
    vehicleId?: string;
  }) {
    return this.request<any>('/api/routes/optimize', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Vehicle suggestion
  async suggestVehicle(data: {
    totalWeight: number;
    totalVolume?: number;
    stopCount: number;
  }) {
    return this.request<any>('/api/vehicles/suggest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient(API_URL);
export default api;
