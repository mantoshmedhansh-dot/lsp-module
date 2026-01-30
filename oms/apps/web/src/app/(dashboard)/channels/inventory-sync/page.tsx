"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  XCircle,
  Settings,
  Activity,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface SyncLog {
  id: string;
  connectionId: string;
  connectionName: string;
  skuId: string;
  skuCode: string;
  marketplaceSku: string;
  previousQuantity: number;
  newQuantity: number;
  syncStatus: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ConnectionStatus {
  connectionId: string;
  marketplace: string;
  connectionName: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncSuccess: number;
  lastSyncFailed: number;
  activeMappings: number;
}

interface SyncStats {
  period_days: number;
  total_sync_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  total_sku_updates: number;
  failed_updates: number;
  total_sync_logs: number;
}

interface SyncConfig {
  connectionId: string;
  marketplace: string;
  inventorySyncEnabled: boolean;
  syncFrequency: string;
  bufferPercentage: number;
  bufferQuantity: number;
  maxQuantity: number | null;
  syncOnOrderChange: boolean;
  syncOnStockChange: boolean;
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
  SUCCESS: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
  CONNECTED: "bg-green-100 text-green-800",
  DISCONNECTED: "bg-red-100 text-red-800",
};

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
};

export default function InventorySyncPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("status");

  // Filters
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/inventory-sync/jobs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, [connectionFilter, statusFilter]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      params.append("limit", "100");

      const response = await fetch(`/api/v1/inventory-sync/logs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }, [connectionFilter]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/inventory-sync/status");
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.connections || []);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/inventory-sync/stats?days=7");
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

  const fetchConfig = useCallback(async (connectionId: string) => {
    try {
      const response = await fetch(`/api/v1/inventory-sync/config/${connectionId}`);
      if (response.ok) {
        const data = await response.json();
        setSyncConfig(data);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchJobs(), fetchLogs(), fetchStatus(), fetchStats(), fetchConnections()]);
    setIsLoading(false);
  }, [fetchJobs, fetchLogs, fetchStatus, fetchStats, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs();
      fetchLogs();
    }, 300);
    return () => clearTimeout(timer);
  }, [connectionFilter, statusFilter, fetchJobs, fetchLogs]);

  const pushInventory = async () => {
    if (!selectedConnection) {
      toast.error("Please select a marketplace connection");
      return;
    }

    setIsPushing(true);
    try {
      const endpoint = selectedConnection === "all"
        ? "/api/v1/inventory-sync/push-all"
        : `/api/v1/inventory-sync/push?connection_id=${selectedConnection}`;

      const response = await fetch(endpoint, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || "Inventory push initiated");
        setShowPushDialog(false);
        fetchAll();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to push inventory");
      }
    } catch (error) {
      toast.error("Failed to push inventory");
    } finally {
      setIsPushing(false);
    }
  };

  const saveConfig = async () => {
    if (!syncConfig) return;

    setIsSavingConfig(true);
    try {
      const response = await fetch(`/api/v1/inventory-sync/config/${syncConfig.connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_sync_enabled: syncConfig.inventorySyncEnabled,
          sync_frequency: syncConfig.syncFrequency,
          buffer_percentage: syncConfig.bufferPercentage,
          buffer_quantity: syncConfig.bufferQuantity,
          max_quantity: syncConfig.maxQuantity,
          sync_on_order_change: syncConfig.syncOnOrderChange,
          sync_on_stock_change: syncConfig.syncOnStockChange,
        }),
      });

      if (response.ok) {
        toast.success("Configuration saved");
        setShowConfigDialog(false);
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      toast.error("Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const openConfigDialog = (connectionId: string) => {
    setSelectedConnection(connectionId);
    fetchConfig(connectionId);
    setShowConfigDialog(true);
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
      case "SUCCESS":
      case "CONNECTED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
      case "ERROR":
      case "DISCONNECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "IN_PROGRESS":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Sync</h1>
          <p className="text-muted-foreground">
            Push inventory levels to marketplaces and track sync status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowPushDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Push Inventory
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKU Updates</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sku_updates || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_sync_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_jobs || 0} completed
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
            <CardTitle className="text-sm font-medium">Failed Updates</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed_updates || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="status">Connection Status</TabsTrigger>
            <TabsTrigger value="jobs">Sync Jobs</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          </TabsList>

          {(activeTab === "jobs" || activeTab === "logs") && (
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
            </div>
          )}
        </div>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Status by Connection</CardTitle>
              <CardDescription>
                Current inventory sync status for each marketplace connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : connectionStatus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No connections found</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {connectionStatus.map((status) => (
                    <Card key={status.connectionId}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{status.connectionName}</CardTitle>
                            {getChannelBadge(status.marketplace)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openConfigDialog(status.connectionId)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status.status)}
                            {getStatusBadge(status.status)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Active Mappings</span>
                          <span className="font-medium">{status.activeMappings}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Last Sync</span>
                          <span className="text-sm">
                            {status.lastSyncAt
                              ? new Date(status.lastSyncAt).toLocaleString()
                              : "Never"
                            }
                          </span>
                        </div>
                        {status.lastSyncStatus && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Last Result</span>
                            <span className="text-sm">
                              <span className="text-green-600">{status.lastSyncSuccess}</span>
                              {status.lastSyncFailed > 0 && (
                                <span className="text-red-600 ml-1">
                                  / {status.lastSyncFailed} failed
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        <Button
                          className="w-full mt-2"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedConnection(status.connectionId);
                            setShowPushDialog(true);
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Push Now
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Jobs</CardTitle>
              <CardDescription>
                History of inventory push jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sync jobs found</p>
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
                        </TableCell>
                        <TableCell className="text-center">
                          {job.recordsTotal !== null ? (
                            <div className="text-sm">
                              <span className="text-green-600">{job.recordsSuccess || 0}</span>
                              {" / "}
                              <span>{job.recordsTotal}</span>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>
                Individual SKU inventory update logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sync logs found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Marketplace SKU</TableHead>
                      <TableHead className="text-center">Qty Change</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.skuCode}</TableCell>
                        <TableCell className="text-sm">{log.connectionName}</TableCell>
                        <TableCell className="font-mono text-sm">{log.marketplaceSku}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-muted-foreground">{log.previousQuantity}</span>
                          {" -> "}
                          <span className="font-medium">{log.newQuantity}</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.syncStatus)}
                          {log.errorMessage && (
                            <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
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

      {/* Push Inventory Dialog */}
      <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push Inventory</DialogTitle>
            <DialogDescription>
              Push current inventory levels to marketplace(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Marketplace Connection</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select connection or push all" />
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
            <Button variant="outline" onClick={() => setShowPushDialog(false)}>
              Cancel
            </Button>
            <Button onClick={pushInventory} disabled={isPushing || !selectedConnection}>
              {isPushing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Push Inventory
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inventory Sync Configuration</DialogTitle>
            <DialogDescription>
              Configure sync settings for this connection
            </DialogDescription>
          </DialogHeader>
          {syncConfig && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Inventory Sync</Label>
                <Switch
                  checked={syncConfig.inventorySyncEnabled}
                  onCheckedChange={(checked) =>
                    setSyncConfig({ ...syncConfig, inventorySyncEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Sync Frequency (minutes)</Label>
                <Select
                  value={syncConfig.syncFrequency}
                  onValueChange={(value) =>
                    setSyncConfig({ ...syncConfig, syncFrequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Buffer Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={syncConfig.bufferPercentage}
                    onChange={(e) =>
                      setSyncConfig({
                        ...syncConfig,
                        bufferPercentage: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buffer Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={syncConfig.bufferQuantity}
                    onChange={(e) =>
                      setSyncConfig({
                        ...syncConfig,
                        bufferQuantity: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Max Quantity (leave empty for unlimited)</Label>
                <Input
                  type="number"
                  min="0"
                  value={syncConfig.maxQuantity || ""}
                  onChange={(e) =>
                    setSyncConfig({
                      ...syncConfig,
                      maxQuantity: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Sync on Order Change</Label>
                <Switch
                  checked={syncConfig.syncOnOrderChange}
                  onCheckedChange={(checked) =>
                    setSyncConfig({ ...syncConfig, syncOnOrderChange: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Sync on Stock Change</Label>
                <Switch
                  checked={syncConfig.syncOnStockChange}
                  onCheckedChange={(checked) =>
                    setSyncConfig({ ...syncConfig, syncOnStockChange: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={isSavingConfig}>
              {isSavingConfig ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
