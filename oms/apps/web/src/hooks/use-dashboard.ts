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

  const url = `/api/v1/dashboard${searchParams.toString() ? `?${searchParams}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Dashboard stats fetch failed: ${response.status}`);
  }

  return response.json();
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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Dashboard analytics fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats(params: DashboardStatsParams = {}) {
  return useQuery({
    queryKey: dashboardKeys.stats(params),
    queryFn: () => fetchDashboardStats(params),
    staleTime: 30 * 1000, // 30 seconds - dashboard should be relatively fresh
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Hook to fetch dashboard analytics data
 */
export function useDashboardAnalytics(params: DashboardAnalyticsParams = {}) {
  return useQuery({
    queryKey: dashboardKeys.analytics(params),
    queryFn: () => fetchDashboardAnalytics(params),
    staleTime: 60 * 1000, // 1 minute
  });
}
