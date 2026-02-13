"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  ArrowLeft,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Exception {
  id: string;
  exceptionCode: string;
  type: string;
  source: string;
  severity: string;
  entityType: string;
  entityId: string;
  orderId: string | null;
  title: string;
  description: string;
  autoResolvable: boolean;
  status: string;
  priority: number;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface SchedulerInfo {
  lastScan: string | null;
  status: string;
  lastResult: {
    rulesExecuted: number;
    exceptionsCreated: number;
    exceptionsUpdated: number;
    autoResolved: number;
  };
}

interface DashboardStats {
  exceptions: {
    critical: number;
    open: number;
    inProgress: number;
    resolvedToday: number;
    byType: Record<string, number>;
  };
  operations: {
    ordersToday: number;
    openNDRs: number;
  };
  scheduler: SchedulerInfo;
  timestamp: string;
}

const severityConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  LOW: { label: "Low", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OPEN: { label: "Open", variant: "destructive" },
  IN_PROGRESS: { label: "In Progress", variant: "secondary" },
  RESOLVED: { label: "Resolved", variant: "default" },
  IGNORED: { label: "Ignored", variant: "outline" },
};

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  STUCK_ORDER: { label: "Stuck Order", icon: Package },
  SLA_BREACH: { label: "SLA Breach", icon: Clock },
  NDR_ESCALATION: { label: "NDR Escalation", icon: AlertTriangle },
  CARRIER_DELAY: { label: "Carrier Delay", icon: Truck },
  INVENTORY_ISSUE: { label: "Inventory Issue", icon: Package },
  PAYMENT_ISSUE: { label: "Payment Issue", icon: AlertTriangle },
};

const exceptionTypes = [
  { value: "all", label: "All Types" },
  { value: "STUCK_ORDER", label: "Stuck Orders" },
  { value: "SLA_BREACH", label: "SLA Breach" },
  { value: "NDR_ESCALATION", label: "NDR Escalation" },
  { value: "CARRIER_DELAY", label: "Carrier Delays" },
  { value: "INVENTORY_ISSUE", label: "Inventory Issues" },
  { value: "PAYMENT_ISSUE", label: "Payment Issues" },
];

export default function ExceptionManagementPage() {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/control-tower/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  // Fetch exceptions list
  const fetchExceptions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("type", activeTab);
      params.set("limit", "50");

      const response = await fetch(`/api/v1/system/exceptions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch exceptions");
      const result = await response.json();

      setExceptions(result || []);
    } catch (error) {
      console.error("Error fetching exceptions:", error);
      setExceptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab]);

  // Trigger exception detection engine
  const runDetectionEngine = async () => {
    try {
      setIsScanning(true);
      toast.info("Running exception detection engine...");

      const response = await fetch("/api/v1/control-tower/detect-exceptions", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Detection failed");

      const result = await response.json();
      setLastScanResult(result);

      toast.success(
        `Scan complete: ${result.summary.exceptions_created} new, ${result.summary.exceptions_updated} updated, ${result.summary.exceptions_auto_resolved} resolved`
      );

      // Refresh data
      await Promise.all([fetchStats(), fetchExceptions()]);
    } catch (error) {
      console.error("Detection engine error:", error);
      toast.error("Failed to run detection engine");
    } finally {
      setIsScanning(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStats();
    fetchExceptions();
  }, [fetchStats, fetchExceptions]);

  // Auto-refresh every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchExceptions();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchExceptions]);

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
  }

  const hasFilters = search || activeTab !== "all";

  const getSeverityBadge = (severity: string) => {
    const config = severityConfig[severity] || severityConfig.MEDIUM;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const config = typeConfig[type] || { label: type, icon: AlertTriangle };
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/control-tower")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exception Management</h1>
            <p className="text-muted-foreground">
              Monitor and resolve operational exceptions and anomalies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runDetectionEngine}
            disabled={isScanning}
          >
            <Zap className={`mr-2 h-4 w-4 ${isScanning ? "animate-pulse" : ""}`} />
            {isScanning ? "Scanning..." : "Run Now"}
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchExceptions} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Scheduler Status Banner */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-indigo-700">Auto-Detection Active</span>
              </div>
              <span className="text-indigo-600">
                Scans every 15 minutes
              </span>
            </div>
            {stats?.scheduler?.lastScan && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-indigo-500">
                  Last scan: {new Date(stats.scheduler.lastScan).toLocaleTimeString()}
                </span>
                {stats.scheduler.lastResult && (
                  <span className="text-indigo-400">
                    ({stats.scheduler.lastResult.rulesExecuted} rules, {stats.scheduler.lastResult.exceptionsCreated} created)
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Scan Result */}
      {lastScanResult && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="font-medium text-blue-700">Manual Scan Result:</span>
                <span className="text-blue-600">
                  {lastScanResult.summary.exceptions_created} created,{" "}
                  {lastScanResult.summary.exceptions_updated} updated,{" "}
                  {lastScanResult.summary.exceptions_auto_resolved} auto-resolved
                </span>
              </div>
              <span className="text-blue-500 text-xs">
                {new Date(lastScanResult.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.exceptions.critical ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Requires immediate action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.exceptions.open ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting resolution</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.exceptions.inProgress ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.exceptions.resolvedToday ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Successfully resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Type Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {exceptionTypes.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {stats?.exceptions.byType[tab.value] && tab.value !== "all" && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {stats.exceptions.byType[tab.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by exception code, entity ID, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Exceptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exception Queue</CardTitle>
          <CardDescription>
            {exceptions.length} exceptions found {hasFilters && "(filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium">All Clear!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {hasFilters
                  ? "No exceptions match your filters"
                  : "No exceptions detected. Operations running smoothly."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-detection runs every 15 minutes
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exception</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exception) => {
                  const statusInfo = statusConfig[exception.status] || {
                    label: exception.status,
                    variant: "outline" as const,
                  };

                  return (
                    <TableRow key={exception.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{exception.exceptionCode}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {exception.title}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(exception.type)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{exception.entityId}</p>
                          <p className="text-xs text-muted-foreground">
                            {exception.entityType}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(exception.severity)}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(exception.createdAt), "dd MMM, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (exception.orderId) {
                              router.push(`/orders/${exception.orderId}`);
                            }
                          }}
                          disabled={!exception.orderId}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
