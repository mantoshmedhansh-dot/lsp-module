"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  XCircle,
  Zap,
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
import { Progress } from "@/components/ui/progress";

interface AIAction {
  id: string;
  entityType: string;
  entityId: string;
  actionType: string;
  actionDetails: Record<string, unknown>;
  status: string;
  confidence: number | null;
  processingTime: number | null;
  errorMessage: string | null;
  createdAt: string;
  ndr: {
    id: string;
    ndrCode: string;
    status: string;
  } | null;
}

interface AIStats {
  actionTypes: Record<string, number>;
  statuses: Record<string, number>;
  entityTypes: Record<string, number>;
  averageConfidence: number;
  averageProcessingTime: number;
  todayStats: {
    total: number;
    successful: number;
    successRate: number;
  };
}

export default function AIActionsPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [actions, setActions] = useState<AIAction[]>([]);
  const [stats, setStats] = useState<AIStats>({
    actionTypes: {},
    statuses: {},
    entityTypes: {},
    averageConfidence: 0,
    averageProcessingTime: 0,
    todayStats: { total: 0, successful: 0, successRate: 0 },
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(entityTypeFilter && { entityType: entityTypeFilter }),
        ...(actionTypeFilter && { actionType: actionTypeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/v1/ai-actions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActions(data.actions);
        setTotal(data.total);
        setStats(data.stats || {
          actionTypes: {},
          statuses: {},
          entityTypes: {},
          averageConfidence: 0,
          averageProcessingTime: 0,
          todayStats: { total: 0, successful: 0, successRate: 0 },
        });
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch AI actions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
    // Refresh every 15 minutes
    const interval = setInterval(fetchActions, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [page, entityTypeFilter, actionTypeFilter, statusFilter]);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "AUTO_CLASSIFY":
        return <Brain className="h-4 w-4 text-purple-500" />;
      case "AUTO_OUTREACH":
        return <Zap className="h-4 w-4 text-amber-500" />;
      case "AUTO_RESOLVE":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "SENTIMENT_ANALYSIS":
        return <Activity className="h-4 w-4 text-blue-500" />;
      case "PRIORITY_UPDATE":
        return <Target className="h-4 w-4 text-orange-500" />;
      case "ESCALATION":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "PREDICTION":
        return <TrendingUp className="h-4 w-4 text-indigo-500" />;
      default:
        return <Bot className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SUCCESS: "bg-green-100 text-green-700",
      FAILED: "bg-red-100 text-red-700",
      PENDING: "bg-amber-100 text-amber-700",
      SKIPPED: "bg-gray-100 text-gray-700",
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{status}</Badge>;
  };

  const formatProcessingTime = (time: number | null) => {
    if (time === null) return "-";
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-7 w-7" />
            AI Actions Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor AI-driven automation and decision-making across the platform
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchActions}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Actions</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayStats.total}</div>
            <p className="text-xs text-muted-foreground">AI decisions made</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayStats.successful}</div>
            <p className="text-xs text-muted-foreground">
              {stats.todayStats.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.averageConfidence * 100).toFixed(1)}%
            </div>
            <Progress value={stats.averageConfidence * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatProcessingTime(stats.averageProcessingTime)}
            </div>
            <p className="text-xs text-muted-foreground">Processing time</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Type Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Action Types</CardTitle>
            <CardDescription>Distribution of AI actions by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.actionTypes).map(([type, count]) => {
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div
                    key={type}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                      actionTypeFilter === type ? "bg-muted" : ""
                    }`}
                    onClick={() => setActionTypeFilter(actionTypeFilter === type ? "" : type)}
                  >
                    {getActionIcon(type)}
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{type.replace(/_/g, " ")}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entity Types</CardTitle>
            <CardDescription>AI actions by entity type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.entityTypes).map(([type, count]) => {
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div
                    key={type}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                      entityTypeFilter === type ? "bg-muted" : ""
                    }`}
                    onClick={() => setEntityTypeFilter(entityTypeFilter === type ? "" : type)}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs font-bold">{type.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{type}</span>
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Action Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={entityTypeFilter || "all"} onValueChange={(v) => setEntityTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="NDR">NDR</SelectItem>
                <SelectItem value="Order">Order</SelectItem>
                <SelectItem value="ProactiveCommunication">Communication</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionTypeFilter || "all"} onValueChange={(v) => setActionTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="AUTO_CLASSIFY">Auto Classify</SelectItem>
                <SelectItem value="AUTO_OUTREACH">Auto Outreach</SelectItem>
                <SelectItem value="AUTO_RESOLVE">Auto Resolve</SelectItem>
                <SelectItem value="SENTIMENT_ANALYSIS">Sentiment Analysis</SelectItem>
                <SelectItem value="PRIORITY_UPDATE">Priority Update</SelectItem>
                <SelectItem value="ESCALATION">Escalation</SelectItem>
                <SelectItem value="PREDICTION">Prediction</SelectItem>
                <SelectItem value="MANUAL_UPDATE">Manual Update</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SKIPPED">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Processing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No AI actions found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  actions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="text-sm">
                        {new Date(action.createdAt).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(action.actionType)}
                          <span className="text-sm font-medium">
                            {action.actionType.replace(/_/g, " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {action.entityType}
                          </Badge>
                          {action.ndr && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {action.ndr.ndrCode}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {JSON.stringify(action.actionDetails).slice(0, 50)}...
                        </p>
                      </TableCell>
                      <TableCell>
                        {action.confidence !== null ? (
                          <div className="flex items-center gap-2">
                            <Progress value={action.confidence * 100} className="w-12 h-2" />
                            <span className="text-xs">{Math.round(action.confidence * 100)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatProcessingTime(action.processingTime)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(action.status)}
                        {action.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 truncate max-w-[100px]" title={action.errorMessage}>
                            {action.errorMessage}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} of {total}
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
                  disabled={page * 50 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
