"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Activity,
  Zap,
  Package,
  CreditCard,
  Key,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScheduledJob {
  id: string;
  name: string;
  next_run: string | null;
  trigger: string;
  pending: boolean;
}

interface JobsStatus {
  status: string;
  jobs: ScheduledJob[];
}

interface DetectionScanResult {
  timestamp: string | null;
  rules_executed: number;
  exceptions_created: number;
  exceptions_updated: number;
  auto_resolved: number;
  status: string;
}

const JOB_INFO: Record<string, { icon: React.ReactNode; description: string; category: string }> = {
  detection_engine: {
    icon: <Search className="h-4 w-4" />,
    description: "Scans for exceptions and anomalies in orders, deliveries, and NDRs",
    category: "detection",
  },
  marketplace_order_sync: {
    icon: <Package className="h-4 w-4" />,
    description: "Pulls orders from all connected marketplaces (Amazon, Flipkart, Shopify, etc.)",
    category: "marketplace",
  },
  marketplace_inventory_push: {
    icon: <Activity className="h-4 w-4" />,
    description: "Pushes inventory levels to all connected marketplaces",
    category: "marketplace",
  },
  marketplace_settlement_fetch: {
    icon: <CreditCard className="h-4 w-4" />,
    description: "Fetches settlement data from marketplaces for reconciliation",
    category: "marketplace",
  },
  marketplace_token_refresh: {
    icon: <Key className="h-4 w-4" />,
    description: "Refreshes OAuth tokens for marketplace API access",
    category: "marketplace",
  },
};

export default function ScheduledJobsPage() {
  const [jobsStatus, setJobsStatus] = useState<JobsStatus | null>(null);
  const [lastScan, setLastScan] = useState<DetectionScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "trigger" | "pause" | "resume";
    jobId: string;
    jobName: string;
  } | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [jobsRes, scanRes] = await Promise.all([
        fetch("/api/v1/scheduled-jobs"),
        fetch("/api/v1/scheduled-jobs/detection-engine/last-scan"),
      ]);

      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        setJobsStatus(jobs);
      }

      if (scanRes.ok) {
        const scan = await scanRes.json();
        setLastScan(scan);
      }
    } catch (error) {
      console.error("Failed to fetch scheduled jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: "trigger" | "pause" | "resume", jobId: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/v1/scheduled-jobs/${jobId}/${action}`, {
        method: "POST",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Job ${action}${action === "trigger" ? "ed" : "d"} successfully`,
        });
        fetchData();
      } else {
        throw new Error("Failed to perform action");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} job`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  const formatNextRun = (nextRun: string | null) => {
    if (!nextRun) return "Not scheduled";
    const date = new Date(nextRun);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Running...";
    if (diff < 60000) return `In ${Math.floor(diff / 1000)}s`;
    if (diff < 3600000) return `In ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `In ${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-500">Running</Badge>;
      case "not_running":
        return <Badge variant="destructive">Stopped</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const detectionJobs = jobsStatus?.jobs.filter(j => JOB_INFO[j.id]?.category === "detection") || [];
  const marketplaceJobs = jobsStatus?.jobs.filter(j => JOB_INFO[j.id]?.category === "marketplace") || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
          <p className="text-muted-foreground">
            Monitor and manage background jobs for sync operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Auto-refresh: 30s
          </Badge>
          {getStatusBadge(jobsStatus?.status || "unknown")}
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobsStatus?.jobs.length || 0}</div>
            <p className="text-xs text-muted-foreground">Scheduled background tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastScan?.timestamp
                ? new Date(lastScan.timestamp).toLocaleTimeString()
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Detection engine</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastScan?.exceptions_created || 0}</div>
            <p className="text-xs text-muted-foreground">
              {lastScan?.auto_resolved || 0} auto-resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rules Executed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastScan?.rules_executed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Status: {lastScan?.status || "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs Tabs */}
      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">
            Marketplace Sync ({marketplaceJobs.length})
          </TabsTrigger>
          <TabsTrigger value="detection">
            Detection Engine ({detectionJobs.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Jobs ({jobsStatus?.jobs.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Marketplace Sync Jobs</CardTitle>
              <CardDescription>
                Jobs that synchronize data with connected marketplaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketplaceJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No marketplace sync jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    marketplaceJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {JOB_INFO[job.id]?.icon || <Zap className="h-4 w-4" />}
                            <span className="font-medium">{job.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px]">
                          {JOB_INFO[job.id]?.description || "No description"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.trigger}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatNextRun(job.next_run)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirmDialog({
                                  open: true,
                                  action: "trigger",
                                  jobId: job.id,
                                  jobName: job.name,
                                })
                              }
                              disabled={actionLoading === job.id}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Run Now
                            </Button>
                            {job.pending ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction("resume", job.id)}
                                disabled={actionLoading === job.id}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    action: "pause",
                                    jobId: job.id,
                                    jobName: job.name,
                                  })
                                }
                                disabled={actionLoading === job.id}
                              >
                                <Pause className="h-3 w-3 mr-1" />
                                Pause
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detection Engine</CardTitle>
              <CardDescription>
                Proactive exception detection and monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Last Scan Details */}
              {lastScan && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Last Scan Results</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Timestamp:</span>
                      <p className="font-medium">
                        {lastScan.timestamp
                          ? new Date(lastScan.timestamp).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rules Executed:</span>
                      <p className="font-medium">{lastScan.rules_executed}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exceptions Created:</span>
                      <p className="font-medium">{lastScan.exceptions_created}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Auto-Resolved:</span>
                      <p className="font-medium">{lastScan.auto_resolved}</p>
                    </div>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectionJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No detection jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    detectionJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {JOB_INFO[job.id]?.icon || <Zap className="h-4 w-4" />}
                            <span className="font-medium">{job.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[300px]">
                          {JOB_INFO[job.id]?.description || "No description"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.trigger}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatNextRun(job.next_run)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                action: "trigger",
                                jobId: job.id,
                                jobName: job.name,
                              })
                            }
                            disabled={actionLoading === job.id}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Run Now
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Scheduled Jobs</CardTitle>
              <CardDescription>Complete list of all background jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsStatus?.jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">{job.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {JOB_INFO[job.id]?.icon || <Zap className="h-4 w-4" />}
                          {job.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.trigger}</Badge>
                      </TableCell>
                      <TableCell>{formatNextRun(job.next_run)}</TableCell>
                      <TableCell>
                        {job.pending ? (
                          <Badge variant="secondary">Paused</Badge>
                        ) : (
                          <Badge className="bg-green-500">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              action: "trigger",
                              jobId: job.id,
                              jobName: job.name,
                            })
                          }
                          disabled={actionLoading === job.id}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "trigger" && "Run Job Now"}
              {confirmDialog?.action === "pause" && "Pause Job"}
              {confirmDialog?.action === "resume" && "Resume Job"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "trigger" &&
                `Are you sure you want to trigger "${confirmDialog?.jobName}" to run immediately?`}
              {confirmDialog?.action === "pause" &&
                `Are you sure you want to pause "${confirmDialog?.jobName}"? It will not run until resumed.`}
              {confirmDialog?.action === "resume" &&
                `Are you sure you want to resume "${confirmDialog?.jobName}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                confirmDialog && handleAction(confirmDialog.action, confirmDialog.jobId)
              }
              disabled={actionLoading !== null}
            >
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
