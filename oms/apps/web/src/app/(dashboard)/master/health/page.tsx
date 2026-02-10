"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Server,
  Database,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface HealthResponse {
  status: string;
  uptime?: number;
  version?: string;
  timestamp?: string;
  database?: {
    status: string;
    responseTime?: number;
  };
  queue?: {
    status: string;
    pending?: number;
    responseTime?: number;
  };
  cache?: {
    status: string;
    hitRate?: number;
    responseTime?: number;
  };
}

interface SystemStatus {
  cpu?: { usage: number; cores: number };
  memory?: { usage: number; total: string; used: string };
  network?: { throughput: string; bandwidth: string };
  uptime?: number;
  version?: string;
}

interface ServiceCardData {
  name: string;
  status: "operational" | "degraded" | "down" | "unknown";
  uptime: string;
  responseTime: string;
  lastChecked: string;
  icon: React.ElementType;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive";
    icon: React.ElementType;
    color: string;
  }
> = {
  operational: {
    label: "Operational",
    variant: "default",
    icon: CheckCircle,
    color: "text-green-600",
  },
  degraded: {
    label: "Degraded",
    variant: "secondary",
    icon: AlertTriangle,
    color: "text-yellow-600",
  },
  down: {
    label: "Down",
    variant: "destructive",
    icon: XCircle,
    color: "text-red-600",
  },
  unknown: {
    label: "Unknown",
    variant: "secondary",
    icon: Clock,
    color: "text-gray-500",
  },
};

function formatUptime(seconds: number | undefined): string {
  if (!seconds) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatLastChecked(timestamp: string | undefined): string {
  if (!timestamp) return "Just now";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 10) return "Just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  return `${diffMins}m ago`;
}

function resolveStatus(
  raw: string | undefined | null
): "operational" | "degraded" | "down" | "unknown" {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (s === "ok" || s === "healthy" || s === "operational" || s === "connected")
    return "operational";
  if (s === "degraded" || s === "slow" || s === "warning") return "degraded";
  if (s === "down" || s === "error" || s === "unhealthy" || s === "disconnected")
    return "down";
  return "unknown";
}

export default function SystemHealthPage() {
  // Fetch /health endpoint with auto-refresh every 30 seconds
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    dataUpdatedAt: healthUpdatedAt,
    refetch: refetchHealth,
  } = useQuery<HealthResponse>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const startTime = Date.now();
      const res = await fetch("/api/v1/health");
      const elapsed = Date.now() - startTime;
      if (!res.ok) {
        throw new Error(`Health check failed with status ${res.status}`);
      }
      const data = await res.json();
      // Attach measured response time
      return { ...data, _measuredResponseTime: elapsed };
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch /api/v1/system/status if available
  const {
    data: systemStatus,
    isLoading: statusLoading,
    dataUpdatedAt: statusUpdatedAt,
    refetch: refetchStatus,
  } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/system/status");
      if (!res.ok) return {};
      const result = await res.json();
      return result;
    },
    refetchInterval: 30000,
    retry: false,
  });

  const isLoading = healthLoading;
  const measuredResponseTime = (healthData as any)?._measuredResponseTime;
  const lastCheckedTime = healthUpdatedAt
    ? new Date(healthUpdatedAt).toISOString()
    : undefined;

  // Build service cards from fetched data
  const services: ServiceCardData[] = [
    {
      name: "API Server",
      status: healthError
        ? "down"
        : resolveStatus(healthData?.status),
      uptime: formatUptime(healthData?.uptime || systemStatus?.uptime),
      responseTime: measuredResponseTime
        ? `${measuredResponseTime}ms`
        : "N/A",
      lastChecked: formatLastChecked(lastCheckedTime),
      icon: Server,
    },
    {
      name: "Database",
      status: resolveStatus(healthData?.database?.status),
      uptime: "N/A",
      responseTime: healthData?.database?.responseTime
        ? `${healthData.database.responseTime}ms`
        : "N/A",
      lastChecked: formatLastChecked(lastCheckedTime),
      icon: Database,
    },
    {
      name: "Queue",
      status: resolveStatus(healthData?.queue?.status),
      uptime: "N/A",
      responseTime: healthData?.queue?.responseTime
        ? `${healthData.queue.responseTime}ms`
        : "N/A",
      lastChecked: formatLastChecked(lastCheckedTime),
      icon: Activity,
    },
    {
      name: "Cache",
      status: resolveStatus(healthData?.cache?.status),
      uptime: "N/A",
      responseTime: healthData?.cache?.responseTime
        ? `${healthData.cache.responseTime}ms`
        : "N/A",
      lastChecked: formatLastChecked(lastCheckedTime),
      icon: Cpu,
    },
  ];

  // Overall system status
  const overallStatus = healthError
    ? "down"
    : services.some((s) => s.status === "down")
      ? "down"
      : services.some((s) => s.status === "degraded")
        ? "degraded"
        : services.every(
              (s) => s.status === "operational" || s.status === "unknown"
            )
          ? "operational"
          : "unknown";

  const overallConfig = statusConfig[overallStatus];
  const overallLabels: Record<string, string> = {
    operational: "All Systems Operational",
    degraded: "Some Systems Degraded",
    down: "System Issues Detected",
    unknown: "Checking System Status...",
  };

  const handleRefresh = () => {
    refetchHealth();
    refetchStatus();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            Monitor platform infrastructure and service status (auto-refreshes
            every 30s)
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card
        className={
          overallStatus === "operational"
            ? "border-green-200 bg-green-50 dark:bg-green-950/20"
            : overallStatus === "degraded"
              ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
              : overallStatus === "down"
                ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                : ""
        }
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {overallLabels[overallStatus]}
            </CardTitle>
            <Badge
              variant={overallConfig.variant}
              className={
                overallStatus === "operational" ? "bg-green-600" : undefined
              }
            >
              <overallConfig.icon className="h-3 w-3 mr-1" />
              {overallConfig.label}
            </Badge>
          </div>
          <CardDescription>
            Last checked: {formatLastChecked(lastCheckedTime)}
            {healthData?.version && ` | Version: ${healthData.version}`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Service Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const config = statusConfig[service.status];
          return (
            <Card key={service.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {service.name}
                </CardTitle>
                <service.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                  <span className="font-medium">{config.label}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Uptime: {service.uptime}</p>
                  <p>Response: {service.responseTime}</p>
                  <p>Checked: {service.lastChecked}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resource Usage (from system/status if available) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.cpu?.usage != null
                ? `${systemStatus.cpu.usage}%`
                : "--"}
            </div>
            <Progress
              value={systemStatus?.cpu?.usage || 0}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {systemStatus?.cpu?.cores
                ? `${systemStatus.cpu.cores} cores available`
                : "Awaiting data"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.memory?.usage != null
                ? `${systemStatus.memory.usage}%`
                : "--"}
            </div>
            <Progress
              value={systemStatus?.memory?.usage || 0}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {systemStatus?.memory?.used && systemStatus?.memory?.total
                ? `${systemStatus.memory.used} / ${systemStatus.memory.total}`
                : "Awaiting data"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.network?.throughput || "--"}
            </div>
            <Progress value={0} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {systemStatus?.network?.bandwidth
                ? `Bandwidth: ${systemStatus.network.bandwidth}`
                : "Awaiting data"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle>Health Check Details</CardTitle>
          <CardDescription>
            Raw health check response from the backend
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthError ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-muted-foreground font-medium">
                Health Check Failed
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {(healthError as Error).message}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : healthData ? (
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-64">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-muted-foreground font-medium">
                No Recent Incidents
              </p>
              <p className="text-sm text-muted-foreground">
                The platform has been running smoothly
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
