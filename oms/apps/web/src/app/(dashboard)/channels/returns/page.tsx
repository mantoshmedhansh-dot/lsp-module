"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Truck,
  ClipboardCheck,
  RotateCcw,
  Filter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface MarketplaceReturn {
  id: string;
  connectionId: string;
  channel: string;
  marketplaceReturnId: string;
  marketplaceOrderId: string;
  localOrderId: string | null;
  returnReason: string | null;
  returnType: string;
  status: string;
  initiatedAt: string;
  receivedAt: string | null;
  refundAmount: string;
  refundStatus: string | null;
  qcStatus: string | null;
  trackingNumber: string | null;
  createdAt: string;
}

interface ReturnStats {
  period_days: number;
  total_returns: number;
  total_refund_amount: string;
  by_status: Record<string, number>;
  by_channel: Record<string, { count: number; refund: string }>;
  pending_actions: {
    pending_receive: number;
    pending_qc: number;
    pending_refund: number;
  };
}

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  status: string;
}

const statusColors: Record<string, string> = {
  INITIATED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-purple-100 text-purple-800",
  QC_PENDING: "bg-orange-100 text-orange-800",
  QC_PASSED: "bg-green-100 text-green-800",
  QC_FAILED: "bg-red-100 text-red-800",
  REFUND_PENDING: "bg-yellow-100 text-yellow-800",
  REFUND_PROCESSED: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
};

export default function MarketplaceReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<MarketplaceReturn[]>([]);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Filters
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showQcDialog, setShowQcDialog] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<MarketplaceReturn | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [qcPassed, setQcPassed] = useState(true);
  const [qcNotes, setQcNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/marketplace-returns?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReturns(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching returns:", error);
    }
  }, [connectionFilter, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/marketplace-returns/stats/summary?days=30");
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
    await Promise.all([fetchReturns(), fetchStats(), fetchConnections()]);
    setIsLoading(false);
  }, [fetchReturns, fetchStats, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReturns();
    }, 300);
    return () => clearTimeout(timer);
  }, [connectionFilter, statusFilter, fetchReturns]);

  const handleReceive = async () => {
    if (!selectedReturn) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/marketplace-returns/${selectedReturn.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_number: trackingNumber || null }),
      });

      if (response.ok) {
        toast.success("Return marked as received");
        setShowReceiveDialog(false);
        setSelectedReturn(null);
        setTrackingNumber("");
        fetchAll();
      } else {
        toast.error("Failed to receive return");
      }
    } catch (error) {
      toast.error("Failed to receive return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQc = async () => {
    if (!selectedReturn) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/marketplace-returns/${selectedReturn.id}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passed: qcPassed, notes: qcNotes || null }),
      });

      if (response.ok) {
        toast.success(`QC ${qcPassed ? "passed" : "failed"}`);
        setShowQcDialog(false);
        setSelectedReturn(null);
        setQcPassed(true);
        setQcNotes("");
        fetchAll();
      } else {
        toast.error("Failed to complete QC");
      }
    } catch (error) {
      toast.error("Failed to complete QC");
    } finally {
      setIsSubmitting(false);
    }
  };

  const processRefund = async (returnId: string) => {
    try {
      const response = await fetch(`/api/v1/marketplace-returns/${returnId}/process-refund`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Refund processed");
        fetchAll();
      } else {
        toast.error("Failed to process refund");
      }
    } catch (error) {
      toast.error("Failed to process refund");
    }
  };

  const completeReturn = async (returnId: string) => {
    try {
      const response = await fetch(`/api/v1/marketplace-returns/${returnId}/complete`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Return completed");
        fetchAll();
      } else {
        toast.error("Failed to complete return");
      }
    } catch (error) {
      toast.error("Failed to complete return");
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  const formatCurrency = (value: string | number | null): string => {
    const num = parseDecimal(value);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status.replace(/_/g, " ")}
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
      case "REFUND_PROCESSED":
      case "QC_PASSED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
      case "CANCELLED":
      case "QC_FAILED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "IN_TRANSIT":
        return <Truck className="h-4 w-4 text-yellow-500" />;
      case "RECEIVED":
      case "QC_PENDING":
        return <ClipboardCheck className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActionButton = (ret: MarketplaceReturn) => {
    switch (ret.status) {
      case "INITIATED":
      case "APPROVED":
      case "IN_TRANSIT":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedReturn(ret);
              setShowReceiveDialog(true);
            }}
          >
            Receive
          </Button>
        );
      case "RECEIVED":
      case "QC_PENDING":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedReturn(ret);
              setShowQcDialog(true);
            }}
          >
            QC
          </Button>
        );
      case "QC_PASSED":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => processRefund(ret.id)}
          >
            Process Refund
          </Button>
        );
      case "REFUND_PROCESSED":
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => completeReturn(ret.id)}
          >
            Complete
          </Button>
        );
      default:
        return null;
    }
  };

  // Filter returns by tab
  const getFilteredReturns = () => {
    switch (activeTab) {
      case "pending_receive":
        return returns.filter(r => ["INITIATED", "APPROVED", "IN_TRANSIT"].includes(r.status));
      case "pending_qc":
        return returns.filter(r => ["RECEIVED", "QC_PENDING"].includes(r.status));
      case "pending_refund":
        return returns.filter(r => r.status === "QC_PASSED");
      case "completed":
        return returns.filter(r => ["COMPLETED", "REFUND_PROCESSED", "CANCELLED", "REJECTED"].includes(r.status));
      default:
        return returns;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Returns</h1>
          <p className="text-muted-foreground">
            Process returns from marketplaces and manage refunds
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_returns || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Receive</CardTitle>
            <Truck className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pending_actions?.pending_receive || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending QC</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats?.pending_actions?.pending_qc || 0}
            </div>
            <p className="text-xs text-muted-foreground">Needs inspection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.total_refund_amount || "0")}
            </div>
            <p className="text-xs text-muted-foreground">Amount refunded</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Returns</TabsTrigger>
            <TabsTrigger value="pending_receive">
              Pending Receive
              {(stats?.pending_actions?.pending_receive || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.pending_actions?.pending_receive}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending_qc">
              Pending QC
              {(stats?.pending_actions?.pending_qc || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.pending_actions?.pending_qc}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending_refund">
              Pending Refund
              {(stats?.pending_actions?.pending_refund || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.pending_actions?.pending_refund}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
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
          </div>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Returns</CardTitle>
            <CardDescription>
              Process marketplace returns through receive, QC, and refund workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">Loading...</div>
            ) : getFilteredReturns().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No returns found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return ID</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredReturns().map((ret) => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-mono">{ret.marketplaceReturnId}</TableCell>
                      <TableCell>{getChannelBadge(ret.channel)}</TableCell>
                      <TableCell className="font-mono">{ret.marketplaceOrderId}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {ret.returnReason || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(ret.status)}
                          {getStatusBadge(ret.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(ret.refundAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(ret.initiatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {getActionButton(ret)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Receive Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Return</DialogTitle>
            <DialogDescription>
              Mark this return as received in the warehouse
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Return ID</span>
                  <span className="font-mono">{selectedReturn.marketplaceReturnId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Channel</span>
                  {getChannelBadge(selectedReturn.channel)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tracking Number (Optional)</Label>
                <Input
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Mark as Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Dialog */}
      <Dialog open={showQcDialog} onOpenChange={setShowQcDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quality Check</DialogTitle>
            <DialogDescription>
              Complete QC inspection for this return
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Return ID</span>
                  <span className="font-mono">{selectedReturn.marketplaceReturnId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Reason</span>
                  <span className="text-sm">{selectedReturn.returnReason || "-"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>QC Result</Label>
                <Select value={qcPassed ? "passed" : "failed"} onValueChange={(v) => setQcPassed(v === "passed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">Passed - Saleable condition</SelectItem>
                    <SelectItem value="failed">Failed - Damaged/Unusable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Enter QC notes..."
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQcDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQc} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Complete QC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
