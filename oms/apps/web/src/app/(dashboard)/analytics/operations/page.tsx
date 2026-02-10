"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercentage } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  RefreshCw,
  Target,
  Truck,
} from "lucide-react";

// Status color mapping for order status badges
const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-cyan-100 text-cyan-800",
  ALLOCATED: "bg-yellow-100 text-yellow-800",
  PICKING: "bg-orange-100 text-orange-800",
  PACKED: "bg-purple-100 text-purple-800",
  MANIFESTED: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-green-100 text-green-800",
  IN_TRANSIT: "bg-teal-100 text-teal-800",
  OUT_FOR_DELIVERY: "bg-lime-100 text-lime-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  RTO: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: "New",
  CONFIRMED: "Confirmed",
  ALLOCATED: "Allocated",
  PICKING: "Picking",
  PACKED: "Packed",
  MANIFESTED: "Manifested",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RTO: "RTO",
  CANCELLED: "Cancelled",
};

/**
 * Compute hours difference between two ISO date strings.
 * Returns 0 if either date is missing or invalid.
 */
function hoursBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.abs(db.getTime() - da.getTime()) / (1000 * 60 * 60);
}

export default function OperationsAnalyticsPage() {
  // --- Fetch order data ---
  const {
    data: ordersRaw,
    isLoading: isLoadingOrders,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["operations-analytics-orders"],
    queryFn: async () => {
      const res = await fetch("/api/v1/orders?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const json = await res.json();
      return Array.isArray(json) ? json : json?.items || json?.data || [];
    },
  });

  // --- Fetch shipment data ---
  const {
    data: shipmentsRaw,
    isLoading: isLoadingShipments,
    error: shipmentsError,
    refetch: refetchShipments,
  } = useQuery({
    queryKey: ["operations-analytics-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch shipments");
      const json = await res.json();
      return Array.isArray(json) ? json : json?.items || json?.data || [];
    },
  });

  const isLoading = isLoadingOrders || isLoadingShipments;
  const hasError = ordersError || shipmentsError;

  const orders: Record<string, any>[] = ordersRaw || [];
  const shipments: Record<string, any>[] = shipmentsRaw || [];

  // =========================================================================
  // ORDER AGGREGATIONS
  // =========================================================================

  // Orders by status (count per status)
  const ordersByStatus: Record<string, number> = {};
  for (const order of orders) {
    const status = order.status || "UNKNOWN";
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
  }

  const totalOrders = orders.length;

  // Fulfillment rate: orders that reached SHIPPED or beyond / total
  const shippedStatuses = new Set([
    "SHIPPED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ]);
  const shippedCount = orders.filter((o) => shippedStatuses.has(o.status)).length;
  const fulfillmentRate = totalOrders > 0 ? (shippedCount / totalOrders) * 100 : 0;

  // Average processing time: hours from createdAt to shippedAt (for shipped orders)
  let totalProcessingHours = 0;
  let processedOrderCount = 0;
  for (const order of orders) {
    if (shippedStatuses.has(order.status) && order.createdAt && order.shippedAt) {
      const hours = hoursBetween(order.createdAt, order.shippedAt);
      if (hours > 0) {
        totalProcessingHours += hours;
        processedOrderCount++;
      }
    }
  }
  const avgProcessingTimeHours =
    processedOrderCount > 0 ? totalProcessingHours / processedOrderCount : 0;

  // =========================================================================
  // SHIPMENT AGGREGATIONS
  // =========================================================================

  const totalShipments = shipments.length;

  // Delivery success rate: DELIVERED shipments / total shipments
  const deliveredShipments = shipments.filter(
    (s) => s.status === "DELIVERED"
  ).length;
  const deliverySuccessRate =
    totalShipments > 0 ? (deliveredShipments / totalShipments) * 100 : 0;

  // Average delivery time: hours from shippedAt to deliveredAt
  let totalDeliveryHours = 0;
  let deliveredCount = 0;
  for (const shipment of shipments) {
    if (shipment.status === "DELIVERED" && shipment.shippedAt && shipment.deliveredAt) {
      const hours = hoursBetween(shipment.shippedAt, shipment.deliveredAt);
      if (hours > 0) {
        totalDeliveryHours += hours;
        deliveredCount++;
      }
    }
  }
  const avgDeliveryTimeHours =
    deliveredCount > 0 ? totalDeliveryHours / deliveredCount : 0;

  // Sort status entries by count descending
  const statusEntries = Object.entries(ordersByStatus).sort(
    ([, a], [, b]) => b - a
  );

  const handleRefresh = () => {
    refetchOrders();
    refetchShipments();
  };

  // Format hours into a human-readable string
  const formatHours = (hours: number): string => {
    if (hours === 0) return "--";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations Analytics</h1>
          <p className="text-muted-foreground">
            Monitor fulfillment efficiency and operational KPIs from live data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {hasError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">
                Error loading analytics data
              </h3>
              <p className="text-sm text-red-600">
                {ordersError instanceof Error
                  ? ordersError.message
                  : shipmentsError instanceof Error
                    ? shipmentsError.message
                    : "An unexpected error occurred"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(totalOrders)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(shippedCount)} shipped
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Fulfillment Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {totalOrders > 0 ? formatPercentage(fulfillmentRate) : "--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Shipped / Total orders
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Avg Processing Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatHours(avgProcessingTimeHours)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Order created to shipped
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Delivery Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {totalShipments > 0
                    ? formatPercentage(deliverySuccessRate)
                    : "--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(deliveredShipments)} of{" "}
                  {formatNumber(totalShipments)} shipments delivered
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shipment Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Avg Delivery Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatHours(avgDeliveryTimeHours)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From shipped to delivered ({formatNumber(deliveredCount)}{" "}
                  shipments)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Shipments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(totalShipments)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(deliveredShipments)} delivered,{" "}
                  {formatNumber(totalShipments - deliveredShipments)} in progress
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status Distribution</CardTitle>
          <CardDescription>
            Breakdown of orders by current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : statusEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Order Data</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Order status distribution will appear here once orders are available
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {statusEntries.map(([status, count]) => {
                const colorClass =
                  STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
                const label = STATUS_LABELS[status] || status;
                const pct =
                  totalOrders > 0
                    ? ((count / totalOrders) * 100).toFixed(1)
                    : "0";

                return (
                  <Card key={status} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant="outline"
                        className={colorClass}
                      >
                        {label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatNumber(count)}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                      <div
                        className={`h-1.5 rounded-full ${
                          STATUS_COLORS[status]
                            ? STATUS_COLORS[status].split(" ")[0].replace("100", "500")
                            : "bg-gray-500"
                        }`}
                        style={{
                          width: `${totalOrders > 0 ? (count / totalOrders) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
