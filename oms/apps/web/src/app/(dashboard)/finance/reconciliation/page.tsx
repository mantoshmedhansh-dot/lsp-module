"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Upload,
  Download,
  Clock,
  TrendingUp,
  XCircle,
  Search,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  settlementNo: string;
  paymentGateway: string;
  settlementDate: string;
  totalTransactions: number;
  grossAmount: string;
  fees: string;
  netAmount: string;
  matchedAmount: string;
  unmatchedAmount: string;
  status: string;
  importedAt: string;
}

interface Chargeback {
  id: string;
  chargebackNo: string;
  orderId: string;
  orderNo: string;
  amount: string;
  reason: string;
  status: string;
  dueDate: string;
  filedAt: string;
}

interface Discrepancy {
  id: string;
  settlementId: string;
  settlementNo: string;
  transactionRef: string;
  expectedAmount: string;
  actualAmount: string;
  difference: string;
  discrepancyType: string;
  status: string;
  createdAt: string;
}

interface DashboardData {
  totalSettlements: number;
  pendingReconciliation: number;
  matchedPercentage: number;
  totalDiscrepancies: number;
  openChargebacks: number;
  chargebackAmount: number;
  codPending: number;
  escrowHeld: number;
}

export default function ReconciliationPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/reconciliation/dashboard");
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/v1/reconciliation/settlements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSettlements(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching settlements:", error);
    }
  }, [statusFilter]);

  const fetchChargebacks = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/chargebacks?status=OPEN,UNDER_REVIEW");
      if (response.ok) {
        const data = await response.json();
        setChargebacks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching chargebacks:", error);
    }
  }, []);

  const fetchDiscrepancies = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/reconciliation/discrepancies?status=UNRESOLVED");
      if (response.ok) {
        const data = await response.json();
        setDiscrepancies(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching discrepancies:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDashboard(), fetchSettlements(), fetchChargebacks(), fetchDiscrepancies()]);
    setIsLoading(false);
  }, [fetchDashboard, fetchSettlements, fetchChargebacks, fetchDiscrepancies]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const runAutoMatch = async () => {
    try {
      const response = await fetch("/api/v1/reconciliation/match", {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Matched ${result.matchedCount || 0} transactions`);
        fetchAll();
      } else {
        toast.error("Auto-match failed");
      }
    } catch (error) {
      toast.error("Auto-match failed");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "PARTIALLY_MATCHED":
        return <Badge className="bg-blue-100 text-blue-800">Partial</Badge>;
      case "FULLY_MATCHED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Matched</Badge>;
      case "RECONCILED":
        return <Badge className="bg-green-100 text-green-800">Reconciled</Badge>;
      case "DISPUTED":
        return <Badge variant="destructive">Disputed</Badge>;
      case "OPEN":
        return <Badge className="bg-red-100 text-red-800">Open</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-yellow-100 text-yellow-800">Under Review</Badge>;
      case "WON":
        return <Badge className="bg-green-100 text-green-800">Won</Badge>;
      case "LOST":
        return <Badge variant="destructive">Lost</Badge>;
      case "UNRESOLVED":
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="mr-1 h-3 w-3" />Unresolved</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-100 text-green-800">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
          <h1 className="text-2xl font-bold tracking-tight">Payment Reconciliation</h1>
          <p className="text-muted-foreground">
            Match payments, manage settlements and resolve discrepancies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Settlement
          </Button>
          <Button onClick={runAutoMatch}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Auto-Match
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboard?.matchedPercentage?.toFixed(1) || 0}%
            </div>
            <Progress value={dashboard?.matchedPercentage || 0} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reconciliation</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard?.pendingReconciliation || 0}
            </div>
            <p className="text-xs text-muted-foreground">Settlements to review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Discrepancies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboard?.totalDiscrepancies || discrepancies.length}
            </div>
            <p className="text-xs text-muted-foreground">Need resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Chargebacks</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.openChargebacks || chargebacks.length}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(dashboard?.chargebackAmount || 0).toFixed(2)} at risk
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Settlements</TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancies
            {discrepancies.length > 0 && (
              <Badge variant="destructive" className="ml-2">{discrepancies.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="chargebacks">
            Chargebacks
            {chargebacks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{chargebacks.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Settlement Files</CardTitle>
                  <CardDescription>Imported payment settlements</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PARTIALLY_MATCHED">Partial</SelectItem>
                    <SelectItem value="FULLY_MATCHED">Matched</SelectItem>
                    <SelectItem value="RECONCILED">Reconciled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : settlements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No settlements found</p>
                  <Button variant="outline" className="mt-4">
                    <Upload className="mr-2 h-4 w-4" />
                    Import First Settlement
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Settlement #</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Transactions</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                      <TableHead className="text-right">Matched</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((settlement) => (
                      <TableRow key={settlement.id}>
                        <TableCell className="font-mono font-medium">
                          {settlement.settlementNo}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{settlement.paymentGateway}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(settlement.settlementDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {settlement.totalTransactions}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${parseDecimal(settlement.netAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600">
                            ${parseDecimal(settlement.matchedAmount).toFixed(2)}
                          </span>
                          {parseDecimal(settlement.unmatchedAmount) > 0 && (
                            <span className="text-red-600 ml-2">
                              (-${parseDecimal(settlement.unmatchedAmount).toFixed(2)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies">
          <Card>
            <CardHeader>
              <CardTitle>Payment Discrepancies</CardTitle>
              <CardDescription>Mismatches requiring investigation</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : discrepancies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">No unresolved discrepancies</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Settlement</TableHead>
                      <TableHead>Transaction Ref</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map((discrepancy) => (
                      <TableRow key={discrepancy.id}>
                        <TableCell className="font-mono">{discrepancy.settlementNo}</TableCell>
                        <TableCell className="font-mono">{discrepancy.transactionRef}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{discrepancy.discrepancyType}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseDecimal(discrepancy.expectedAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${parseDecimal(discrepancy.actualAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          ${parseDecimal(discrepancy.difference).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(discrepancy.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline">Resolve</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chargebacks">
          <Card>
            <CardHeader>
              <CardTitle>Chargebacks</CardTitle>
              <CardDescription>Disputed transactions requiring response</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : chargebacks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">No open chargebacks</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chargeback #</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chargebacks.map((chargeback) => (
                      <TableRow key={chargeback.id}>
                        <TableCell className="font-mono font-medium">
                          {chargeback.chargebackNo}
                        </TableCell>
                        <TableCell className="font-mono">{chargeback.orderNo}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          ${parseDecimal(chargeback.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>{chargeback.reason}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Date(chargeback.dueDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(chargeback.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm">Respond</Button>
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
    </div>
  );
}
