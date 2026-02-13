/**
 * Dashboard React Query Hooks
 *
 * Type-safe data fetching for dashboard statistics
 * using the V1 API endpoints and TanStack Query.
 */

import { useQuery } from "@tanstack/react-query";

// Types for dashboard data
export interface DashboardStats {
  summary: {
    totalOrders: number;
    todayOrders: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    totalInventory: number;
    totalSKUs: number;
  };
  ordersByStatus: Record<string, number>;
  recentActivity: unknown[];
}

export interface DashboardAnalytics {
  period: string;
  orderTrend: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}

export interface DashboardStatsParams {
  locationId?: string;
  days?: number;
}

export interface DashboardAnalyticsParams {
  locationId?: string;
  period?: "day" | "week" | "month" | "year";
}

// Query keys for cache management
export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (params?: DashboardStatsParams) =>
    [...dashboardKeys.all, "stats", params] as const,
  analytics: (params?: DashboardAnalyticsParams) =>
    [...dashboardKeys.all, "analytics", params] as const,
};

/**
 * Fetch dashboard stats from V1 API
 */
async function fetchDashboardStats(params: DashboardStatsParams = {}): Promise<DashboardStats> {
  const searchParams = new URLSearchParams();
  if (params.locationId) {
    searchParams.set("locationId", params.locationId);
  }
  if (params.days) {
    searchParams.set("days", String(params.days));
  }

  const url = `/api/v1/dashboard${searchParams.toString() ? `?${searchParams}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Dashboard stats fetch failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch dashboard analytics from V1 API
 */
async function fetchDashboardAnalytics(params: DashboardAnalyticsParams = {}): Promise<DashboardAnalytics> {
  const searchParams = new URLSearchParams();
  if (params.locationId) {
    searchParams.set("locationId", params.locationId);
  }
  if (params.period) {
    searchParams.set("period", params.period);
  }

  const url = `/api/v1/dashboard/analytics${searchParams.toString() ? `?${searchParams}` : ""}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Dashboard analytics fetch failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Hook to fetch dashboard statistics
 * Optimized with longer cache time and background refetch
 */
export function useDashboardStats(params: DashboardStatsParams = {}) {
  return useQuery({
    queryKey: dashboardKeys.stats(params),
    queryFn: () => fetchDashboardStats(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes
    refetchOnWindowFocus: false,
    placeholderData: (prev: DashboardStats | undefined) => prev,
    retry: 2,
    retryDelay: 10000, // Wait 10s before retry
  });
}

/**
 * Hook to fetch dashboard analytics data
 * Optimized with longer cache time
 */
export function useDashboardAnalytics(params: DashboardAnalyticsParams = {}) {
  return useQuery({
    queryKey: dashboardKeys.analytics(params),
    queryFn: () => fetchDashboardAnalytics(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    placeholderData: (prev: DashboardAnalytics | undefined) => prev,
    retry: 1,
    retryDelay: 5000,
  });
}
