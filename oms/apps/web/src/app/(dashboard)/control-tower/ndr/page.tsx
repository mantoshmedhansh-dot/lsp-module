"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
  Settings,
  ArrowUpRight,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useNdrList, useCreateOutreach } from "@/hooks/use-ndr";
import type { NDRListItem, NDRStatus, NDRPriority, NDRReason } from "@/lib/api/client";
import { toast } from "sonner";

interface NDRSummary {
  summary: {
    totalNDRs: number;
    openNDRs: number;
    inProgressNDRs: number;
    resolvedNDRs: number;
    rtoNDRs: number;
    ndrsToday: number;
    resolvedToday: number;
  };
  exceptions: {
    total: number;
    critical: number;
    high: number;
    byRuleType: Record<string, number>;
  };
  breakdown: {
    byStatus: Record<string, number>;
    byReason: Record<string, number>;
    byPriority: Record<string, number>;
  };
  riskMetrics: {
    avgRiskScore: number;
    highRiskCount: number;
  };
  aiActions: {
    pendingApproval: number;
  };
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

export default function NDRCommandCenterPage() {
  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NDRStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<NDRPriority | "">("");
  const [reasonFilter, setReasonFilter] = useState<NDRReason | "">("");

  // Outreach dialog state
  const [selectedNDR, setSelectedNDR] = useState<NDRListItem | null>(null);
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState("WHATSAPP");
  const [customMessage, setCustomMessage] = useState("");

  // Control Tower integration state
  const [ndrSummary, setNdrSummary] = useState<NDRSummary | null>(null);
  const [schedulerInfo, setSchedulerInfo] = useState<SchedulerInfo | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Fetch NDR summary from Control Tower
  const fetchNdrSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/control-tower/ndr-summary");
      if (response.ok) {
        const data = await response.json();
        setNdrSummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch NDR summary:", error);
    }
  }, []);

  // Fetch scheduler status
  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/control-tower/dashboard");
      if (response.ok) {
        const data = await response.json();
        setSchedulerInfo(data.scheduler);
      }
    } catch (error) {
      console.error("Failed to fetch scheduler status:", error);
    }
  }, []);

  // Execute NDR action via Control Tower
  const executeNdrAction = async (actionType: string, ndrId: string, config?: Record<string, any>) => {
    try {
      setIsExecutingAction(true);
      const response = await fetch("/api/v1/control-tower/ndr-action/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: actionType, ndr_id: ndrId, config }),
      });

      if (!response.ok) throw new Error("Action failed");

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        refetch();
        fetchNdrSummary();
      } else {
        toast.error(result.message || "Action failed");
      }
    } catch (error) {
      toast.error("Failed to execute action");
      console.error(error);
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Initial fetch for Control Tower data
  useEffect(() => {
    fetchNdrSummary();
    fetchSchedulerStatus();
  }, [fetchNdrSummary, fetchSchedulerStatus]);

  // Auto-refresh Control Tower data every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNdrSummary();
      fetchSchedulerStatus();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNdrSummary, fetchSchedulerStatus]);

  // Use React Query hooks for data fetching
  const {
    data: ndrData,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useNdrList({
    page,
    limit: 25,
    ...(statusFilter && { status: statusFilter as NDRStatus }),
    ...(priorityFilter && { priority: priorityFilter as NDRPriority }),
    ...(reasonFilter && { reason: reasonFilter as NDRReason }),
    ...(search && { search }),
  });

  // Outreach mutation
  const createOutreach = useCreateOutreach();

  // Extract data from query result
  const ndrs = ndrData?.ndrs || [];
  const total = ndrData?.total || 0;
  const stats = {
    statusCounts: (ndrData?.statusCounts || {}) as Record<string, number>,
    priorityCounts: (ndrData?.priorityCounts || {}) as Record<string, number>,
    reasonCounts: (ndrData?.reasonCounts || {}) as Record<string, number>,
    avgResolutionHours: ndrData?.avgResolutionHours || 0,
    outreachSuccessRate: ndrData?.outreachSuccessRate || 0,
  };

  const handleOutreach = async () => {
    if (!selectedNDR) return;

    try {
      await createOutreach.mutateAsync({
        ndrId: selectedNDR.id,
        requestBody: {
          ndrId: selectedNDR.id,
          channel: outreachChannel as "WHATSAPP" | "SMS" | "VOICE" | "EMAIL",
          attemptNumber: 1,
          messageContent: customMessage || undefined,
        },
      });
      setOutreachDialogOpen(false);
      setCustomMessage("");
    } catch (error) {
      console.error("Failed to send outreach:", error);
    }
  };

  // Calculate stats
  const totalNDRs = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0);
  const openNDRs = stats.statusCounts.OPEN || 0;
  const actionRequestedNDRs = stats.statusCounts.ACTION_REQUESTED || 0;
  const resolvedNDRs = stats.statusCounts.RESOLVED || 0;
  const rtoNDRs = stats.statusCounts.RTO || 0;
  const closedNDRs = stats.statusCounts.CLOSED || 0;
  const criticalNDRs = stats.priorityCounts.CRITICAL || 0;
  const highPriorityNDRs = stats.priorityCounts.HIGH || 0;

  const resolutionRate = totalNDRs > 0 ? Math.round((resolvedNDRs / totalNDRs) * 100) : 0;
  const contactRate = totalNDRs > 0 ? Math.round(((actionRequestedNDRs + resolvedNDRs) / totalNDRs) * 100) : 0;

  const lastRefresh = new Date(dataUpdatedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-7 w-7" />
            NDR Command Center
          </h1>
          <p className="text-muted-foreground">
            AI-powered NDR resolution with rule-based detection and automated outreach
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/control-tower/rules">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              NDR Rules
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetch();
              fetchNdrSummary();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Auto-Detection Status Banner */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-indigo-700">Auto-Detection Active</span>
              </div>
              <span className="text-indigo-600">
                NDR rules scan every 15 minutes
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              {schedulerInfo?.lastScan && (
                <span className="text-indigo-500">
                  Last scan: {new Date(schedulerInfo.lastScan).toLocaleTimeString()}
                </span>
              )}
              {ndrSummary?.exceptions && (
                <div className="flex items-center gap-2">
                  {ndrSummary.exceptions.critical > 0 && (
                    <Badge className="bg-red-100 text-red-700">
                      {ndrSummary.exceptions.critical} Critical
                    </Badge>
                  )}
                  {ndrSummary.exceptions.high > 0 && (
                    <Badge className="bg-orange-100 text-orange-700">
                      {ndrSummary.exceptions.high} High
                    </Badge>
                  )}
                  {ndrSummary.aiActions.pendingApproval > 0 && (
                    <Badge className="bg-blue-100 text-blue-700">
                      {ndrSummary.aiActions.pendingApproval} AI Actions Pending
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rule-Detected Exceptions Summary */}
      {ndrSummary?.exceptions && ndrSummary.exceptions.total > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              Rule-Detected NDR Exceptions
            </CardTitle>
            <CardDescription>
              {ndrSummary.exceptions.total} NDRs flagged by detection rules requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ndrSummary.exceptions.byRuleType).map(([ruleType, count]) => (
                <Badge key={ruleType} variant="outline" className="text-xs">
                  {ruleType.replace(/_/g, " ")}: {count}
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/control-tower/exceptions?entityType=NDR">
                <Button variant="outline" size="sm">
                  View All NDR Exceptions
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
              <Link href="/control-tower/ai-actions?entityType=NDR">
                <Button variant="outline" size="sm">
                  NDR AI Actions
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open NDRs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openNDRs}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Requested</CardTitle>
            <Phone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actionRequestedNDRs}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedNDRs}</div>
            <p className="text-xs text-muted-foreground">{resolutionRate}% resolution rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RTO</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rtoNDRs}</div>
            <p className="text-xs text-muted-foreground">Return initiated</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <ShieldAlert className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalNDRs}</div>
            <p className="text-xs text-muted-foreground">Needs immediate action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Target className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityNDRs}</div>
            <p className="text-xs text-muted-foreground">Priority attention</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Performance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              AI Auto-Resolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{resolutionRate}%</span>
                {resolutionRate >= 50 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <Progress value={resolutionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {resolvedNDRs} of {totalNDRs} NDRs resolved
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              Contact Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{contactRate}%</span>
                {contactRate >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <Progress value={contactRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Customers reached successfully
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Avg. Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {stats.avgResolutionHours > 0 ? `${stats.avgResolutionHours}h` : "N/A"}
                </span>
                {stats.avgResolutionHours > 0 && stats.avgResolutionHours < 4 ? (
                  <TrendingDown className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <Progress value={stats.avgResolutionHours > 0 ? Math.min(100, (4 / stats.avgResolutionHours) * 100) : 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Based on {resolvedNDRs} resolved cases
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NDR Reason Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">NDR Reasons Distribution</CardTitle>
          <CardDescription>AI-classified NDR reasons across all active cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              { key: "CUSTOMER_UNAVAILABLE", label: "Not Available", color: "bg-blue-500" },
              { key: "WRONG_ADDRESS", label: "Wrong Address", color: "bg-red-500" },
              { key: "PHONE_UNREACHABLE", label: "Phone Off", color: "bg-orange-500" },
              { key: "CUSTOMER_REFUSED", label: "Refused", color: "bg-purple-500" },
              { key: "COD_NOT_READY", label: "COD Not Ready", color: "bg-amber-500" },
              { key: "DELIVERY_RESCHEDULED", label: "Reschedule", color: "bg-green-500" },
              { key: "OTHER", label: "Other", color: "bg-gray-500" },
            ].map(({ key, label, color }) => {
              const count = stats.reasonCounts[key] || 0;
              const percentage = totalNDRs > 0 ? Math.round((count / totalNDRs) * 100) : 0;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    reasonFilter === key ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setReasonFilter(reasonFilter === key ? "" : key as NDRReason)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{percentage}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            NDR Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order, AWB, customer..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v as NDRStatus)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="ACTION_REQUESTED">Action Requested</SelectItem>
                <SelectItem value="REATTEMPT_SCHEDULED">Reattempt</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="RTO">RTO</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v as NDRPriority)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NDR Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NDR Code</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ndrs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                        <p>No NDRs matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  ndrs.map((ndr) => (
                    <TableRow key={ndr.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {ndr.ndrCode}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ndr.order?.orderNo || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {ndr.delivery?.awbNo || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ndr.order?.customerName || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {ndr.order?.customerPhone || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {ndr.reason.replace(/_/g, " ")}
                          </Badge>
                          {ndr.confidence && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {Math.round(ndr.confidence * 100)}% confident
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ndr.priority === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : ndr.priority === "HIGH"
                                ? "bg-orange-100 text-orange-700"
                                : ndr.priority === "MEDIUM"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                          }
                        >
                          {ndr.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ndr.riskScore !== null && (
                          <div className="flex items-center gap-2">
                            <Progress value={ndr.riskScore} className="w-16 h-2" />
                            <span className="text-xs">{ndr.riskScore}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ndr.status === "RESOLVED"
                              ? "bg-green-100 text-green-700"
                              : ndr.status === "ACTION_REQUESTED"
                                ? "bg-blue-100 text-blue-700"
                                : ndr.status === "RTO"
                                  ? "bg-red-100 text-red-700"
                                  : ndr.status === "REATTEMPT_SCHEDULED"
                                    ? "bg-amber-100 text-amber-700"
                                    : ndr.status === "CLOSED"
                                      ? "bg-gray-100 text-gray-700"
                                      : "bg-orange-100 text-orange-700"
                          }
                        >
                          {ndr.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {(ndr as any).outreachCount || 0} attempts
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            title="Send Outreach"
                            onClick={() => {
                              setSelectedNDR(ndr);
                              setOutreachDialogOpen(true);
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {ndr.status === "OPEN" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Schedule Reattempt"
                                disabled={isExecutingAction}
                                onClick={() => executeNdrAction("AUTO_REATTEMPT", ndr.id)}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                title="Escalate"
                                disabled={isExecutingAction}
                                onClick={() => executeNdrAction("AUTO_ESCALATE", ndr.id, { reason: "Manual escalation from NDR Command Center" })}
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                              {ndr.attemptNumber && ndr.attemptNumber >= 3 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Initiate RTO"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={isExecutingAction}
                                  onClick={() => executeNdrAction("AUTO_RTO", ndr.id, { notes: "Initiated after 3+ failed attempts" })}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View Order"
                            onClick={() => ndr.order?.id && window.open(`/orders/${ndr.order.id}`, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 25) + 1} - {Math.min(page * 25, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 25 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outreach Dialog */}
      <Dialog open={outreachDialogOpen} onOpenChange={setOutreachDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Outreach</DialogTitle>
            <DialogDescription>
              Contact customer for NDR resolution via AI-powered communication
            </DialogDescription>
          </DialogHeader>

          {selectedNDR && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <span className="font-medium">{selectedNDR.order?.orderNo || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <span className="font-medium">{selectedNDR.order?.customerName || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-medium">{selectedNDR.order?.customerPhone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reason:</span>{" "}
                    <span className="font-medium">{selectedNDR.reason.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Tabs value={outreachChannel} onValueChange={setOutreachChannel}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="WHATSAPP" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="SMS" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      SMS
                    </TabsTrigger>
                    <TabsTrigger value="AI_VOICE" className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      AI Call
                    </TabsTrigger>
                    <TabsTrigger value="EMAIL" className="flex items-center gap-2" disabled={!selectedNDR.order?.customerEmail}>
                      <Mail className="h-4 w-4" />
                      Email
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Message (Optional)</label>
                <Textarea
                  placeholder="Leave empty to use AI-generated message based on NDR reason..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  AI will generate an appropriate message if left empty
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOutreachDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOutreach} disabled={createOutreach.isPending}>
              {createOutreach.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Outreach
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
