"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Link2,
  XCircle,
  Download,
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
import { Separator } from "@/components/ui/separator";
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
  shippingFee: string;
  otherFees: string;
  taxAmount: string;
  netAmount: string;
  reconciliationStatus: string;
  matchedCount: number;
  unmatchedCount: number;
  discrepancyCount: number;
  reconciledAt: string | null;
  reconciledBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SettlementItem {
  id: string;
  marketplaceOrderId: string;
  localOrderId: string | null;
  transactionType: string;
  transactionDate: string | null;
  amount: string;
  commissionAmount: string;
  shippingFee: string;
  otherFees: string;
  netAmount: string;
  reconciliationStatus: string;
  description: string | null;
  notes: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-green-100 text-green-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  UNMATCHED: "bg-red-100 text-red-800",
  DISPUTED: "bg-orange-100 text-orange-800",
  IGNORED: "bg-gray-100 text-gray-800",
  DISCREPANCY: "bg-orange-100 text-orange-800",
};

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
};

export default function SettlementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const settlementId = params.id as string;

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Match dialog
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SettlementItem | null>(null);
  const [matchOrderId, setMatchOrderId] = useState("");

  const fetchSettlement = useCallback(async () => {
    if (!settlementId) return;

    try {
      const response = await fetch(`/api/v1/settlements/${settlementId}`);
      if (response.ok) {
        const data = await response.json();
        setSettlement(data);
      } else if (response.status === 404) {
        toast.error("Settlement not found");
        router.push("/channels/settlements");
      }
    } catch (error) {
      console.error("Error fetching settlement:", error);
    }
  }, [settlementId, router]);

  const fetchItems = useCallback(async () => {
    if (!settlementId) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append("reconciliation_status", statusFilter);
      }
      params.append("limit", "200");

      const response = await fetch(`/api/v1/settlements/${settlementId}/items?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  }, [settlementId, statusFilter]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchSettlement(), fetchItems()]);
    setIsLoading(false);
  }, [fetchSettlement, fetchItems]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, fetchItems]);

  const triggerReconciliation = async () => {
    setIsReconciling(true);
    try {
      const response = await fetch(`/api/v1/settlements/${settlementId}/reconcile`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `Reconciliation complete: ${result.matched} matched, ${result.unmatched} unmatched`
        );
        fetchAll();
      } else {
        toast.error("Failed to reconcile settlement");
      }
    } catch (error) {
      toast.error("Failed to reconcile settlement");
    } finally {
      setIsReconciling(false);
    }
  };

  const matchItem = async () => {
    if (!selectedItem || !matchOrderId) {
      toast.error("Please enter an order ID");
      return;
    }

    try {
      const response = await fetch(`/api/v1/settlements/items/${selectedItem.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local_order_id: matchOrderId }),
      });

      if (response.ok) {
        toast.success("Item matched successfully");
        setShowMatchDialog(false);
        setSelectedItem(null);
        setMatchOrderId("");
        fetchAll();
      } else {
        toast.error("Failed to match item");
      }
    } catch (error) {
      toast.error("Failed to match item");
    }
  };

  const ignoreItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/v1/settlements/items/${itemId}/ignore`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Item marked as ignored");
        fetchItems();
      } else {
        toast.error("Failed to ignore item");
      }
    } catch (error) {
      toast.error("Failed to ignore item");
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
      case "DISCREPANCY":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "IGNORED":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Settlement not found</p>
        <Button className="mt-4" onClick={() => router.push("/channels/settlements")}>
          Back to Settlements
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/channels/settlements")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settlement Details</h1>
            <p className="text-muted-foreground font-mono">
              {settlement.settlementId}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={triggerReconciliation}
            disabled={isReconciling || settlement.reconciliationStatus === "MATCHED"}
          >
            {isReconciling ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Reconcile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settlement Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Settlement Information</CardTitle>
            <CardDescription>Basic settlement details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Channel</Label>
                <div className="mt-1">{getChannelBadge(settlement.channel)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusIcon(settlement.reconciliationStatus)}
                  {getStatusBadge(settlement.reconciliationStatus)}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Settlement Date</Label>
              <p className="font-medium">{new Date(settlement.settlementDate).toLocaleDateString()}</p>
            </div>
            {settlement.periodStart && settlement.periodEnd && (
              <div>
                <Label className="text-muted-foreground">Settlement Period</Label>
                <p className="text-sm">
                  {new Date(settlement.periodStart).toLocaleDateString()} -{" "}
                  {new Date(settlement.periodEnd).toLocaleDateString()}
                </p>
              </div>
            )}
            {settlement.reconciledAt && (
              <div>
                <Label className="text-muted-foreground">Reconciled At</Label>
                <p className="text-sm">{new Date(settlement.reconciledAt).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Settlement amounts breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Amount</span>
              <span className="font-medium">{formatCurrency(settlement.orderAmount, settlement.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refunds</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(settlement.refundAmount, settlement.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commission</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(settlement.commissionAmount, settlement.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping Fee</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(settlement.shippingFee, settlement.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Other Fees</span>
              <span className="font-medium text-red-600">
                -{formatCurrency(settlement.otherFees, settlement.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">
                {formatCurrency(settlement.taxAmount, settlement.currency)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Total Amount</span>
              <span className="font-bold">
                {formatCurrency(settlement.totalAmount, settlement.currency)}
              </span>
            </div>
            <div className="flex justify-between bg-green-50 p-2 rounded">
              <span className="font-medium text-green-700">Net Payout</span>
              <span className="font-bold text-green-700">
                {formatCurrency(settlement.netAmount, settlement.currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{settlement.matchedCount}</div>
              <p className="text-sm text-green-700">Matched</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{settlement.unmatchedCount}</div>
              <p className="text-sm text-red-700">Unmatched</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{settlement.discrepancyCount}</div>
              <p className="text-sm text-orange-700">Discrepancies</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Settlement Items</CardTitle>
              <CardDescription>
                Individual transactions in this settlement
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="MATCHED">Matched</SelectItem>
                <SelectItem value="UNMATCHED">Unmatched</SelectItem>
                <SelectItem value="IGNORED">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketplace Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Local Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.marketplaceOrderId}</TableCell>
                    <TableCell className="text-sm">{item.transactionType}</TableCell>
                    <TableCell className="font-mono">
                      {item.localOrderId || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount, settlement.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(item.netAmount, settlement.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.reconciliationStatus)}
                        {getStatusBadge(item.reconciliationStatus)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.reconciliationStatus === "UNMATCHED" && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowMatchDialog(true);
                            }}
                          >
                            Match
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => ignoreItem(item.id)}
                          >
                            Ignore
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match to Local Order</DialogTitle>
            <DialogDescription>
              Link this marketplace transaction to a local order
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Marketplace Order</span>
                  <span className="font-mono">{selectedItem.marketplaceOrderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Amount</span>
                  <span className="font-medium">
                    {formatCurrency(selectedItem.amount, settlement.currency)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Local Order ID</Label>
                <Input
                  placeholder="Enter local order ID (UUID)"
                  value={matchOrderId}
                  onChange={(e) => setMatchOrderId(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={matchItem}>Match Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
