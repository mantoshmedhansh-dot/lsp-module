// API Client for FastAPI Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cjdquick-api-vr4w.onrender.com';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class APIClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token') || this.token;
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const result = await this.request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', result.token);
    }
    this.token = result.token;
    return result;
  }

  async logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    this.token = null;
  }

  // Users
  async getUsers(params?: { page?: number; pageSize?: number; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.search) searchParams.append('search', params.search);
    return this.request<any[]>(`/api/users?${searchParams}`);
  }

  async createUser(data: any) {
    return this.request<any>('/api/users', { method: 'POST', body: data });
  }

  async updateUser(id: string, data: any) {
    return this.request<any>(`/api/users/${id}`, { method: 'PATCH', body: data });
  }

  async deleteUser(id: string) {
    return this.request<any>(`/api/users/${id}`, { method: 'DELETE' });
  }

  // Orders
  async getOrders(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    channel?: string;
    search?: string;
    locationId?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.status) searchParams.append('status', params.status);
    if (params?.channel) searchParams.append('channel', params.channel);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.locationId) searchParams.append('locationId', params.locationId);
    return this.request<any[]>(`/api/orders?${searchParams}`);
  }

  async getOrder(id: string) {
    return this.request<any>(`/api/orders/${id}`);
  }

  async createOrder(data: any) {
    return this.request<any>('/api/orders', { method: 'POST', body: data });
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request<any>(`/api/orders/${id}/status?new_status=${status}`, { method: 'PATCH' });
  }

  async getOrderCounts(locationId?: string) {
    const params = locationId ? `?locationId=${locationId}` : '';
    return this.request<Record<string, number>>(`/api/orders/count${params}`);
  }

  // SKUs
  async getSKUs(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    brand?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.search) searchParams.append('search', params.search);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.brand) searchParams.append('brand', params.brand);
    return this.request<any[]>(`/api/skus?${searchParams}`);
  }

  async getSKU(id: string) {
    return this.request<any>(`/api/skus/${id}`);
  }

  async createSKU(data: any) {
    return this.request<any>('/api/skus', { method: 'POST', body: data });
  }

  async updateSKU(id: string, data: any) {
    return this.request<any>(`/api/skus/${id}`, { method: 'PATCH', body: data });
  }

  // Inventory
  async getInventory(params?: {
    page?: number;
    pageSize?: number;
    locationId?: string;
    skuId?: string;
    lowStock?: boolean;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.locationId) searchParams.append('locationId', params.locationId);
    if (params?.skuId) searchParams.append('skuId', params.skuId);
    if (params?.lowStock) searchParams.append('lowStock', 'true');
    return this.request<any[]>(`/api/inventory?${searchParams}`);
  }

  async getInventorySummary(locationId?: string) {
    const params = locationId ? `?locationId=${locationId}` : '';
    return this.request<any>(`/api/inventory/summary${params}`);
  }

  async adjustInventory(data: any) {
    return this.request<any>('/api/inventory/adjustments', { method: 'POST', body: data });
  }

  async moveInventory(data: any) {
    return this.request<any>('/api/inventory/move', { method: 'POST', body: data });
  }

  // Locations
  async getLocations(params?: { page?: number; pageSize?: number; type?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.type) searchParams.append('type', params.type);
    return this.request<any[]>(`/api/locations?${searchParams}`);
  }

  async getLocation(id: string) {
    return this.request<any>(`/api/locations/${id}`);
  }

  async createLocation(data: any) {
    return this.request<any>('/api/locations', { method: 'POST', body: data });
  }

  // Brands
  async getBrands(params?: { page?: number; pageSize?: number; search?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.search) searchParams.append('search', params.search);
    return this.request<any[]>(`/api/brands?${searchParams}`);
  }

  async getBrand(id: string) {
    return this.request<any>(`/api/brands/${id}`);
  }

  async createBrand(data: any) {
    return this.request<any>('/api/brands', { method: 'POST', body: data });
  }

  async updateBrand(id: string, data: any) {
    return this.request<any>(`/api/brands/${id}`, { method: 'PATCH', body: data });
  }

  async deleteBrand(id: string) {
    return this.request<any>(`/api/brands/${id}`, { method: 'DELETE' });
  }

  // Dashboard
  async getDashboard(locationId?: string) {
    const params = locationId ? `?locationId=${locationId}` : '';
    return this.request<any>(`/api/dashboard${params}`);
  }

  async getAnalytics(params?: { locationId?: string; period?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.locationId) searchParams.append('locationId', params.locationId);
    if (params?.period) searchParams.append('period', params.period);
    return this.request<any>(`/api/dashboard/analytics?${searchParams}`);
  }
}

export const apiClient = new APIClient(API_BASE_URL);
export default apiClient;
