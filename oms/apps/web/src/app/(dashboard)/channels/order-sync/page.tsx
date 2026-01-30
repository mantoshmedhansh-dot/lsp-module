"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  ShoppingCart,
  XCircle,
  Ban,
  Calendar,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface SyncJob {
  id: string;
  connectionId: string;
  connectionName: string;
  marketplace: string;
  jobType: string;
  status: string;
  recordsTotal: number | null;
  recordsSuccess: number | null;
  recordsFailed: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SyncedOrder {
  id: string;
  connectionId: string;
  connectionName: string;
  marketplaceOrderId: string;
  localOrderId: string | null;
  localOrderNo: string | null;
  syncStatus: string;
  channel: string;
  orderAmount: string;
  syncedAt: string;
  errorMessage: string | null;
}

interface SyncStats {
  period_days: number;
  total_sync_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  total_orders_synced: number;
  orders_from_jobs: number;
  failed_orders: number;
}

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  status: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  SYNCED: "bg-green-100 text-green-800",
  IMPORTED: "bg-blue-100 text-blue-800",
  ERROR: "bg-red-100 text-red-800",
};

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
};

export default function OrderSyncPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [orders, setOrders] = useState<SyncedOrder[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("jobs");

  // Filters
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/order-sync/jobs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, [connectionFilter, statusFilter]);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/order-sync/orders?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, [connectionFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/order-sync/stats?days=7");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/marketplaces");
      if (response.ok) {
        const data = await response.json();
        setConnections(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchJobs(), fetchOrders(), fetchStats(), fetchConnections()]);
    setIsLoading(false);
  }, [fetchJobs, fetchOrders, fetchStats, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs();
      fetchOrders();
    }, 300);
    return () => clearTimeout(timer);
  }, [connectionFilter, statusFilter, fetchJobs, fetchOrders]);

  const triggerSync = async () => {
    if (!selectedConnection) {
      toast.error("Please select a marketplace connection");
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch("/api/v1/order-sync/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedConnection }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Order sync initiated: Job ID ${result.jobId}`);
        setShowTriggerDialog(false);
        fetchAll();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to trigger sync");
      }
    } catch (error) {
      toast.error("Failed to trigger sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerAllSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/v1/order-sync/trigger-all", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || "Sync initiated for all connections");
        setShowTriggerDialog(false);
        fetchAll();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to trigger sync");
      }
    } catch (error) {
      toast.error("Failed to trigger sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/v1/order-sync/jobs/${jobId}/cancel`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Job cancelled");
        fetchJobs();
      } else {
        toast.error("Failed to cancel job");
      }
    } catch (error) {
      toast.error("Failed to cancel job");
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    return (
      <Badge className={channelColors[channel] || "bg-gray-100 text-gray-800"}>
        {channel}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "SYNCED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "IN_PROGRESS":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "CANCELLED":
        return <Ban className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order Sync</h1>
          <p className="text-muted-foreground">
            Pull orders from marketplaces and track sync jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowTriggerDialog(true)}>
            <Play className="mr-2 h-4 w-4" />
            Trigger Sync
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders Synced</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_orders_synced || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Jobs</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sync_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_jobs || 0} completed, {stats?.failed_jobs || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.success_rate?.toFixed(1) || 0}%
            </div>
            <Progress value={stats?.success_rate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Orders</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed_orders || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="jobs">Sync Jobs</TabsTrigger>
            <TabsTrigger value="orders">Synced Orders</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Select value={connectionFilter} onValueChange={setConnectionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Connections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Connections</SelectItem>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.connectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTab === "jobs" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Jobs</CardTitle>
              <CardDescription>
                Track order sync job history and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sync jobs found</p>
                  <Button className="mt-4" onClick={() => setShowTriggerDialog(true)}>
                    <Play className="mr-2 h-4 w-4" />
                    Trigger First Sync
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Connection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Records</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{job.connectionName}</p>
                            {getChannelBadge(job.marketplace)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            {getStatusBadge(job.status)}
                          </div>
                          {job.errorMessage && (
                            <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                              {job.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {job.recordsTotal !== null ? (
                            <div className="text-sm">
                              <span className="text-green-600">{job.recordsSuccess || 0}</span>
                              {" / "}
                              <span>{job.recordsTotal}</span>
                              {job.recordsFailed ? (
                                <span className="text-red-600 ml-1">({job.recordsFailed} failed)</span>
                              ) : null}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.startedAt ? new Date(job.startedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.completedAt ? new Date(job.completedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {(job.status === "PENDING" || job.status === "IN_PROGRESS") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => cancelJob(job.id)}>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Cancel Job
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Synced Orders</CardTitle>
              <CardDescription>
                Orders imported from marketplaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders synced yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace Order</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Local Order</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Synced At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.marketplaceOrderId}</TableCell>
                        <TableCell>{getChannelBadge(order.channel)}</TableCell>
                        <TableCell className="font-mono">
                          {order.localOrderNo || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseDecimal(order.orderAmount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.syncStatus)}
                          {order.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">{order.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(order.syncedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Trigger Sync Dialog */}
      <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger Order Sync</DialogTitle>
            <DialogDescription>
              Pull orders from a marketplace connection or all connections
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketplace Connection</label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select connection or sync all" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  {connections
                    .filter((c) => c.status === "CONNECTED")
                    .map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.connectionName} ({conn.marketplace})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTriggerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={selectedConnection === "all" ? triggerAllSync : triggerSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Sync
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
