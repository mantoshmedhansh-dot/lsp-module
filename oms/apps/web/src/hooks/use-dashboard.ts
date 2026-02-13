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
 * Optimized with longer cache time and background refetch
 */
export function useDashboardStats(params: DashboardStatsParams = {}) {
  return useQuery({
    queryKey: dashboardKeys.stats(params),
    queryFn: () => fetchDashboardStats(params),
    staleTime: 2 * 60 * 1000, // 2 minutes - data is cached on backend too
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes (reduced from 2min)
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    placeholderData: (prev: DashboardStats | undefined) => prev, // Keep old data during refetch
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
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
    staleTime: 2 * 60 * 1000, // 2 minutes - analytics don't change frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
}
