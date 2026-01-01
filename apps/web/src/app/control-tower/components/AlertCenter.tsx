"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Building2,
  Truck,
  Package,
  CheckCircle,
  RefreshCw,
  ChevronRight,
  Bell,
  BellOff,
  Eye,
} from "lucide-react";
import { Button } from "@cjdquick/ui";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  shipmentId: string | null;
  tripId: string | null;
  hubId: string | null;
  metrics: any;
  status: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

interface AlertCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// Fetch alerts
async function fetchAlerts(): Promise<{
  success: boolean;
  data: { items: Alert[]; counts: AlertCounts };
}> {
  const res = await fetch("/api/control-tower/alerts?status=ACTIVE&limit=20");
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

// Acknowledge alert
async function acknowledgeAlert(alertId: string): Promise<void> {
  const res = await fetch(`/api/control-tower/alerts/${alertId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "acknowledge", acknowledgedBy: "Operator" }),
  });
  if (!res.ok) throw new Error("Failed to acknowledge alert");
}

// Get icon for alert type
function getAlertIcon(alertType: string) {
  switch (alertType) {
    case "DELAY_RISK":
      return Clock;
    case "SLA_BREACH":
      return AlertTriangle;
    case "HUB_CONGESTION":
      return Building2;
    case "VEHICLE_ISSUE":
      return Truck;
    case "SHIPMENT_STUCK":
      return Package;
    default:
      return AlertCircle;
  }
}

// Get severity color classes
function getSeverityColors(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-800",
        icon: "text-red-600",
        badge: "bg-red-100 text-red-800",
      };
    case "HIGH":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-800",
        icon: "text-amber-600",
        badge: "bg-amber-100 text-amber-800",
      };
    case "MEDIUM":
      return {
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-800",
        icon: "text-yellow-600",
        badge: "bg-yellow-100 text-yellow-800",
      };
    default:
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-800",
        icon: "text-blue-600",
        badge: "bg-blue-100 text-blue-800",
      };
  }
}

// Alert Card Component
function AlertCard({
  alert,
  onAcknowledge,
  isAcknowledging,
}: {
  alert: Alert;
  onAcknowledge: () => void;
  isAcknowledging: boolean;
}) {
  const Icon = getAlertIcon(alert.alertType);
  const colors = getSeverityColors(alert.severity);

  return (
    <div className={`p-3 ${colors.bg} border ${colors.border} rounded-lg`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 ${colors.icon} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${colors.text} truncate`}>
                {alert.title}
              </p>
              <p className={`text-xs ${colors.text} opacity-80 mt-0.5 line-clamp-2`}>
                {alert.description}
              </p>
            </div>
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${colors.badge} flex-shrink-0`}>
              {alert.severity}
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(alert.createdAt))} ago
            </span>
            <div className="flex items-center gap-1">
              {alert.shipmentId && (
                <Link href={`/admin/shipments/${alert.shipmentId}`}>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <Eye className="h-3 w-3" />
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 ${colors.text}`}
                onClick={onAcknowledge}
                disabled={isAcknowledging}
              >
                {isAcknowledging ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <BellOff className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertCenter({
  autoRefresh = true,
  compact = false,
}: {
  autoRefresh?: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["control-tower", "alerts"],
    queryFn: fetchAlerts,
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 25000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onMutate: (alertId) => {
      setAcknowledgingId(alertId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["control-tower", "alerts"] });
    },
    onSettled: () => {
      setAcknowledgingId(null);
    },
  });

  const alerts = data?.data?.items || [];
  const counts = data?.data?.counts || { critical: 0, high: 0, medium: 0, low: 0 };
  const totalActive = counts.critical + counts.high + counts.medium + counts.low;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading alerts...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bell className={`h-5 w-5 ${totalActive > 0 ? "text-red-500" : "text-gray-400"}`} />
          Alert Center
          {isRefetching && (
            <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <p className="text-xl font-bold text-red-600">{counts.critical}</p>
          <p className="text-xs text-red-600">Critical</p>
        </div>
        <div className="text-center p-2 bg-amber-50 rounded-lg">
          <p className="text-xl font-bold text-amber-600">{counts.high}</p>
          <p className="text-xs text-amber-600">High</p>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded-lg">
          <p className="text-xl font-bold text-yellow-600">{counts.medium}</p>
          <p className="text-xs text-yellow-600">Medium</p>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <p className="text-xl font-bold text-blue-600">{counts.low}</p>
          <p className="text-xs text-blue-600">Low</p>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-10 w-10 mx-auto text-green-400 mb-2" />
            <p className="font-medium text-green-600">All Clear</p>
            <p className="text-sm">No active alerts at this time</p>
          </div>
        ) : (
          alerts
            .slice(0, compact ? 5 : 20)
            .map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                isAcknowledging={acknowledgingId === alert.id}
              />
            ))
        )}
      </div>

      {/* View All Link */}
      {alerts.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <Link href="/control-tower/alerts">
            <Button variant="outline" size="sm" className="w-full">
              View All Alerts
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
