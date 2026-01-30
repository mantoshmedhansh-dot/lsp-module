"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Calendar,
  TrendingUp,
  AlertTriangle,
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Settlement {
  id: string;
  connectionId: string;
  channel: string;
  settlementId: string;
  settlementDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  totalAmount: string;
  orderAmount: string;
  refundAmount: string;
  commissionAmount: string;
  netAmount: string;
  reconciliationStatus: string;
  matchedCount: number;
  unmatchedCount: number;
  discrepancyCount: number;
  reconciledAt: string | null;
  createdAt: string;
}

interface SettlementStats {
  period_days: number;
  total_settlements: number;
  total_amount: string;
  total_net: string;
  total_commission: string;
  by_status: {
    matched: number;
    partial: number;
    unmatched: number;
    pending: number;
  };
  by_channel: Record<string, { count: number; amount: string }>;
  reconciliation_rate: number;
}

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  status: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-green-100 text-green-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  UNMATCHED: "bg-red-100 text-red-800",
  DISPUTED: "bg-orange-100 text-orange-800",
};

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
};

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchSettlements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/settlements?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSettlements(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching settlements:", error);
    }
  }, [connectionFilter, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/settlements/stats?days=30");
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
    await Promise.all([fetchSettlements(), fetchStats(), fetchConnections()]);
    setIsLoading(false);
  }, [fetchSettlements, fetchStats, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSettlements();
    }, 300);
    return () => clearTimeout(timer);
  }, [connectionFilter, statusFilter, fetchSettlements]);

  const triggerReconciliation = async (settlementId: string) => {
    try {
      const response = await fetch(`/api/v1/settlements/${settlementId}/reconcile`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Reconciliation complete: ${result.matched} matched, ${result.unmatched} unmatched`);
        fetchAll();
      } else {
        toast.error("Failed to reconcile settlement");
      }
    } catch (error) {
      toast.error("Failed to reconcile settlement");
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  const formatCurrency = (value: string | number | null, currency: string = "INR"): string => {
    const num = parseDecimal(value);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 2,
    }).format(num);
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
      case "MATCHED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "UNMATCHED":
      case "DISPUTED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "PARTIAL":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlement Reconciliation</h1>
          <p className="text-muted-foreground">
            Match marketplace payments to orders and identify discrepancies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Settlements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_settlements || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_net || "0")}
            </div>
            <p className="text-xs text-muted-foreground">
              After deductions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconciliation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.reconciliation_rate?.toFixed(1) || 0}%
            </div>
            <Progress value={stats?.reconciliation_rate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.total_commission || "0")}
            </div>
            <p className="text-xs text-muted-foreground">
              Platform fees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      {stats?.by_status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.by_status.matched}</div>
                <p className="text-sm text-green-700">Matched</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.by_status.partial}</div>
                <p className="text-sm text-blue-700">Partial</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.by_status.unmatched}</div>
                <p className="text-sm text-red-700">Unmatched</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.by_status.pending}</div>
                <p className="text-sm text-gray-700">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Settlements</CardTitle>
              <CardDescription>
                View and reconcile marketplace settlements
              </CardDescription>
            </div>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="MATCHED">Matched</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="UNMATCHED">Unmatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No settlements found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Settlement ID</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow
                    key={settlement.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/channels/settlements/${settlement.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-mono font-medium">{settlement.settlementId}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(settlement.settlementDate).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getChannelBadge(settlement.channel)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {settlement.periodStart && settlement.periodEnd ? (
                        <>
                          {new Date(settlement.periodStart).toLocaleDateString()} -
                          {new Date(settlement.periodEnd).toLocaleDateString()}
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(settlement.totalAmount, settlement.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(settlement.netAmount, settlement.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(settlement.reconciliationStatus)}
                        {getStatusBadge(settlement.reconciliationStatus)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">
                        <span className="text-green-600">{settlement.matchedCount}</span>
                        {" / "}
                        <span className="text-red-600">{settlement.unmatchedCount}</span>
                        {settlement.discrepancyCount > 0 && (
                          <span className="text-orange-600 ml-1">
                            ({settlement.discrepancyCount})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerReconciliation(settlement.id);
                        }}
                        disabled={settlement.reconciliationStatus === "MATCHED"}
                      >
                        Reconcile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
