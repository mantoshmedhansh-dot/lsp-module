"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Truck,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Eye,
  ChevronRight,
  Activity,
  Target,
  Gauge,
  AlertCircle,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { formatDistanceToNow } from "date-fns";
import MapView from "./components/MapView";
import AlertCenter from "./components/AlertCenter";
import FilterBar from "./components/FilterBar";

interface Filters {
  clientId: string | null;
  fulfillmentMode: string | null;
}

// Fetch control tower overview data with filters
async function fetchOverview(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.fulfillmentMode) params.set("fulfillmentMode", filters.fulfillmentMode);

  const url = `/api/control-tower/overview${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch overview");
  return res.json();
}

// Fetch shipments for the grid with filters
async function fetchShipments(filters: Filters) {
  const params = new URLSearchParams({
    pageSize: "50",
    status: "IN_TRANSIT,IN_HUB,OUT_FOR_DELIVERY,WITH_PARTNER",
  });
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.fulfillmentMode) params.set("fulfillmentMode", filters.fulfillmentMode);

  const res = await fetch(`/api/shipments?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch shipments");
  return res.json();
}

// KPI Card Component
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  onClick?: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            {trend !== undefined && trend !== 0 && (
              <div className={`flex items-center mt-1 text-xs ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
                {trend > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                <span>{Math.abs(trend)}% vs last hour</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Risk Badge Component
function RiskBadge({ risk, score }: { risk: string; score?: number }) {
  const colors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800 border-red-200",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
    LOW: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[risk] || colors.LOW}`}>
      {risk}
      {score !== undefined && <span className="ml-1">({score})</span>}
    </span>
  );
}

// Live Indicator Component
function LiveIndicator({ isRefetching }: { isRefetching: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {isRefetching ? (
        <RefreshCw className="h-3 w-3 animate-spin text-primary-500" />
      ) : (
        <>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </>
      )}
    </span>
  );
}

// Status Badge for Shipments
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    IN_TRANSIT: "bg-blue-100 text-blue-800",
    IN_HUB: "bg-purple-100 text-purple-800",
    OUT_FOR_DELIVERY: "bg-amber-100 text-amber-800",
    WITH_PARTNER: "bg-cyan-100 text-cyan-800",
    DELIVERED: "bg-green-100 text-green-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    BOOKED: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ControlTowerPage() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filter state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedFulfillmentMode, setSelectedFulfillmentMode] = useState<string | null>(null);

  const filters: Filters = {
    clientId: selectedClientId,
    fulfillmentMode: selectedFulfillmentMode,
  };

  // Fetch overview data with polling and filters
  const {
    data: overviewData,
    isLoading: overviewLoading,
    isRefetching: overviewRefetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["control-tower", "overview", filters],
    queryFn: () => fetchOverview(filters),
    refetchInterval: autoRefresh ? 30000 : false, // 30 seconds
    staleTime: 25000,
  });

  // Fetch shipments for the grid with filters
  const {
    data: shipmentsData,
    isLoading: shipmentsLoading,
    refetch: refetchShipments,
  } = useQuery({
    queryKey: ["control-tower", "shipments", filters],
    queryFn: () => fetchShipments(filters),
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 25000,
  });

  // Update lastUpdated when data changes
  useEffect(() => {
    if (overviewData) {
      setLastUpdated(new Date());
    }
  }, [overviewData]);

  const kpis = overviewData?.data?.kpis || {};
  const trends = overviewData?.data?.trends || {};
  const summary = overviewData?.data?.summary || {};
  const fulfillmentBreakdown = overviewData?.data?.fulfillmentBreakdown || {};
  const activeFilters = overviewData?.data?.filters || {};
  const shipments = shipmentsData?.data?.items || [];

  // Refresh all data
  const handleRefresh = () => {
    refetchOverview();
    refetchShipments();
  };

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <p className="ml-3 text-lg text-gray-600">Loading Control Tower...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="h-7 w-7 text-primary-600" />
            Control Tower
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time network visibility and predictive monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <LiveIndicator isRefetching={overviewRefetching} />
            <span>Updated {formatDistanceToNow(lastUpdated)} ago</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Auto: ON" : "Auto: OFF"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 mr-2 ${overviewRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        selectedClientId={selectedClientId}
        selectedFulfillmentMode={selectedFulfillmentMode}
        onClientChange={setSelectedClientId}
        onFulfillmentModeChange={setSelectedFulfillmentMode}
      />

      {/* KPI Cards - Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard
          title="Active Shipments"
          value={kpis.activeShipments || 0}
          icon={Package}
          color="bg-blue-100 text-blue-600"
          trend={trends.shipmentsChange}
        />
        <KPICard
          title="In Transit"
          value={kpis.inTransit || 0}
          icon={Truck}
          color="bg-indigo-100 text-indigo-600"
        />
        <KPICard
          title="At Risk (HIGH)"
          value={kpis.atRiskHigh || 0}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600"
          subtitle="Needs attention"
        />
        <KPICard
          title="Delayed >2hrs"
          value={kpis.delayedOver2Hours || 0}
          icon={Clock}
          color="bg-amber-100 text-amber-600"
          trend={trends.delayedChange}
        />
        <KPICard
          title="On-Time Delivery"
          value={`${kpis.onTimeDeliveryPercent || 0}%`}
          icon={Target}
          color="bg-green-100 text-green-600"
          subtitle="Last 24 hours"
        />
        <KPICard
          title="Hub Utilization"
          value={`${kpis.networkHubUtilization || 0}%`}
          icon={Building2}
          color="bg-purple-100 text-purple-600"
          trend={trends.utilizationChange}
        />
        <KPICard
          title="Fleet Utilization"
          value={`${kpis.fleetUtilization || 0}%`}
          icon={Gauge}
          color="bg-cyan-100 text-cyan-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Center - Left Column */}
        <Card className="lg:col-span-1">
          <div className="p-5 h-[500px]">
            <AlertCenter autoRefresh={autoRefresh} compact />
          </div>
        </Card>

        {/* Network Map - Right Column (2 cols) */}
        <Card className="lg:col-span-2">
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              Network Map
            </h2>
            <div className="h-[420px]">
              <MapView autoRefresh={autoRefresh} />
            </div>
          </div>
        </Card>
      </div>

      {/* Exception Panel */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Exception Panel - At Risk Shipments
            </h2>
            <Link href="/admin/shipments?risk=HIGH,MEDIUM">
              <Button variant="outline" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {shipments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p>No at-risk shipments</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {shipments.slice(0, 4).map((shipment: any) => {
                // Calculate simple risk based on expected delivery
                const expectedDate = shipment.expectedDeliveryDate
                  ? new Date(shipment.expectedDeliveryDate)
                  : null;
                const now = new Date();
                const hoursRemaining = expectedDate
                  ? (expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60)
                  : 999;
                const risk =
                  hoursRemaining < 0 ? "HIGH" : hoursRemaining < 12 ? "MEDIUM" : "LOW";
                const riskScore =
                  risk === "HIGH" ? 85 : risk === "MEDIUM" ? 55 : 20;

                return (
                  <div
                    key={shipment.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      risk === "HIGH"
                        ? "border-l-red-500 bg-red-50"
                        : risk === "MEDIUM"
                        ? "border-l-amber-500 bg-amber-50"
                        : "border-l-green-500 bg-green-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-sm font-medium text-gray-900">
                          {shipment.awbNumber}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {shipment.consigneeName || "—"} • {shipment.consigneeCity || "—"}
                        </p>
                      </div>
                      <RiskBadge risk={risk} score={riskScore} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className="ml-1 font-medium">
                          {shipment.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">ETA:</span>
                        <span
                          className={`ml-1 font-medium ${
                            hoursRemaining < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {expectedDate
                            ? hoursRemaining < 0
                              ? `${Math.abs(Math.round(hoursRemaining))}h overdue`
                              : `${Math.round(hoursRemaining)}h`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/admin/shipments/${shipment.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Shipment Tracking Grid */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              Shipment Tracking
            </h2>
            <div className="flex items-center gap-2">
              <Link href="/admin/shipments">
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {shipmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
              <p className="ml-2 text-gray-500">Loading shipments...</p>
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p>No active shipments</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      AWB
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Route
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Mode
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Expected
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.slice(0, 10).map((shipment: any) => (
                    <tr key={shipment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-mono text-sm font-medium text-primary-600">
                          {shipment.awbNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">
                          {shipment.shipperCity || "—"} → {shipment.consigneeCity || "—"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {shipment.shipperPincode} → {shipment.consigneePincode}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            shipment.fulfillmentMode === "OWN_FLEET"
                              ? "bg-green-100 text-green-800"
                              : shipment.fulfillmentMode === "HYBRID"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {shipment.fulfillmentMode?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">
                          {shipment.expectedDeliveryDate
                            ? new Date(shipment.expectedDeliveryDate).toLocaleDateString()
                            : "—"}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/shipments/${shipment.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
