"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Search,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { formatDate, formatCurrency, parseDecimal } from "@/lib/utils";

interface RefundReturn {
  id: string;
  returnNo: string;
  type: string;
  status: string;
  orderId: string | null;
  order?: {
    id: string;
    orderNo: string;
    customerName: string;
    totalAmount: number | string;
  };
  awbNo: string | null;
  reason: string | null;
  remarks: string | null;
  refundAmount: number | string | null;
  refundStatus: string | null;
  refundMethod: string | null;
  refundReference: string | null;
  refundInitiatedAt: string | null;
  refundCompletedAt: string | null;
  items: {
    id: string;
    quantity: number;
    sku?: { code: string; name: string };
  }[];
  _count?: { items: number };
  createdAt: string;
}

const refundStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  PROCESSED: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  FAILED: "bg-orange-100 text-orange-800",
  REFUND_INITIATED: "bg-cyan-100 text-cyan-800",
};

const refundStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  FAILED: "Failed",
  REFUND_INITIATED: "Initiated",
};

export default function RefundsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const queryClient = useQueryClient();

  // Create refund dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<RefundReturn | null>(null);
  const [refundForm, setRefundForm] = useState({
    amount: "",
    method: "ORIGINAL_PAYMENT",
    reason: "",
    remarks: "",
  });

  // Fetch returns with refund information
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["refund-returns", statusFilter, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        includeRefund: "true",
      });
      if (statusFilter && statusFilter !== "all") {
        params.append("refundStatus", statusFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const res = await fetch(`/api/v1/returns?${params}`);
      if (!res.ok) throw new Error("Failed to fetch refund data");
      return res.json();
    },
  });

  // Normalize response
  const returns: RefundReturn[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.returns || [];
  const totalPages = data?.totalPages || Math.ceil((data?.total || 0) / limit) || 1;
  const total = data?.total || returns.length;

  // Compute summary stats
  const totalRefundAmount = returns.reduce(
    (sum, r) => sum + parseDecimal(r.refundAmount),
    0
  );
  const pendingRefunds = returns.filter(
    (r) => r.refundStatus === "PENDING" || r.refundStatus === "REFUND_INITIATED"
  );
  const pendingAmount = pendingRefunds.reduce(
    (sum, r) => sum + parseDecimal(r.refundAmount),
    0
  );
  const approvedRefunds = returns.filter(
    (r) => r.refundStatus === "APPROVED" || r.refundStatus === "PROCESSING"
  );
  const approvedAmount = approvedRefunds.reduce(
    (sum, r) => sum + parseDecimal(r.refundAmount),
    0
  );
  const processedRefunds = returns.filter(
    (r) => r.refundStatus === "PROCESSED" || r.refundStatus === "COMPLETED"
  );
  const processedAmount = processedRefunds.reduce(
    (sum, r) => sum + parseDecimal(r.refundAmount),
    0
  );

  // Use server-side stats if available
  const summaryStats = {
    totalRefunds: data?.stats?.totalRefunds ?? total,
    totalAmount: data?.stats?.totalAmount ?? totalRefundAmount,
    pendingCount: data?.stats?.pendingCount ?? pendingRefunds.length,
    pendingAmount: data?.stats?.pendingAmount ?? pendingAmount,
    approvedCount: data?.stats?.approvedCount ?? approvedRefunds.length,
    approvedAmount: data?.stats?.approvedAmount ?? approvedAmount,
    processedCount: data?.stats?.processedCount ?? processedRefunds.length,
    processedAmount: data?.stats?.processedAmount ?? processedAmount,
  };

  // Create refund mutation
  const createRefundMutation = useMutation({
    mutationFn: async ({
      returnId,
      payload,
    }: {
      returnId: string;
      payload: typeof refundForm;
    }) => {
      const res = await fetch(`/api/v1/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate_refund",
          refundAmount: parseFloat(payload.amount),
          refundMethod: payload.method,
          reason: payload.reason,
          remarks: payload.remarks,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.detail || "Failed to initiate refund");
      }
      return res.json();
    },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setSelectedReturn(null);
      setRefundForm({ amount: "", method: "ORIGINAL_PAYMENT", reason: "", remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["refund-returns"] });
    },
  });

  // Approve/Reject refund mutation
  const updateRefundMutation = useMutation({
    mutationFn: async ({
      returnId,
      action,
    }: {
      returnId: string;
      action: "approve_refund" | "reject_refund" | "process_refund";
    }) => {
      const res = await fetch(`/api/v1/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.detail || "Failed to update refund");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refund-returns"] });
    },
  });

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const openCreateRefundDialog = (returnItem: RefundReturn) => {
    setSelectedReturn(returnItem);
    setRefundForm({
      amount: returnItem.order?.totalAmount
        ? parseDecimal(returnItem.order.totalAmount).toString()
        : "",
      method: "ORIGINAL_PAYMENT",
      reason: returnItem.reason || "",
      remarks: "",
    });
    setCreateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Refund Processing</h1>
          <p className="text-muted-foreground">
            Manage customer refunds and payment reversals
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryStats.totalAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.totalRefunds} requests
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(summaryStats.pendingAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.pendingCount} pending
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(summaryStats.approvedAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.approvedCount} approved
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Processed</CardTitle>
                <IndianRupee className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summaryStats.processedAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.processedCount} completed
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Order ID, Return No, Customer..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Refund Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="PROCESSED">Processed</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Refunds Table */}
      <Card>
        <CardHeader>
          <CardTitle>Refund Requests</CardTitle>
          <CardDescription>All refund requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <IndianRupee className="h-12 w-12 mb-4 opacity-50" />
              <p>No refund requests found</p>
              <p className="text-sm">Refunds will appear here when returns are processed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return No</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Refund Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Refund Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((ret: RefundReturn) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-medium font-mono">
                      {ret.returnNo || ret.id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {ret.order?.orderNo || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {ret.order?.customerName || "-"}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {ret.refundAmount
                        ? formatCurrency(ret.refundAmount)
                        : formatCurrency(ret.order?.totalAmount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {ret.reason || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ret.refundMethod?.replace(/_/g, " ") || "-"}
                    </TableCell>
                    <TableCell>
                      {ret.refundStatus ? (
                        <Badge className={refundStatusColors[ret.refundStatus] || "bg-gray-100 text-gray-800"}>
                          {refundStatusLabels[ret.refundStatus] || ret.refundStatus?.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">
                          No Refund
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(ret.refundInitiatedAt || ret.createdAt)}
                    </TableCell>
                    <TableCell>
                      {!ret.refundStatus || ret.refundStatus === "PENDING" ? (
                        <div className="flex gap-1">
                          {!ret.refundStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCreateRefundDialog(ret)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Refund
                            </Button>
                          )}
                          {ret.refundStatus === "PENDING" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600"
                                onClick={() =>
                                  updateRefundMutation.mutate({
                                    returnId: ret.id,
                                    action: "approve_refund",
                                  })
                                }
                                disabled={updateRefundMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600"
                                onClick={() =>
                                  updateRefundMutation.mutate({
                                    returnId: ret.id,
                                    action: "reject_refund",
                                  })
                                }
                                disabled={updateRefundMutation.isPending}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      ) : ret.refundStatus === "APPROVED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600"
                          onClick={() =>
                            updateRefundMutation.mutate({
                              returnId: ret.id,
                              action: "process_refund",
                            })
                          }
                          disabled={updateRefundMutation.isPending}
                        >
                          Process
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {returns.length} of {total} refund requests
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Refund Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Initiate Refund</DialogTitle>
            <DialogDescription>
              Create a refund for return {selectedReturn?.returnNo}
              {selectedReturn?.order?.orderNo && ` (Order: ${selectedReturn.order.orderNo})`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedReturn?.order && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedReturn.order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Order Total</p>
                    <p className="font-medium">
                      {formatCurrency(selectedReturn.order.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Return Reason</p>
                    <p className="font-medium">{selectedReturn.reason || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="font-medium">
                      {selectedReturn._count?.items || selectedReturn.items?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Refund Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundForm.amount}
                  onChange={(e) =>
                    setRefundForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Refund Method *</Label>
              <Select
                value={refundForm.method}
                onValueChange={(v) =>
                  setRefundForm((prev) => ({ ...prev, method: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORIGINAL_PAYMENT">Original Payment Method</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="WALLET_CREDIT">Wallet Credit</SelectItem>
                  <SelectItem value="STORE_CREDIT">Store Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input
                value={refundForm.reason}
                onChange={(e) =>
                  setRefundForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Refund reason"
              />
            </div>

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Textarea
                value={refundForm.remarks}
                onChange={(e) =>
                  setRefundForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setSelectedReturn(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedReturn) return;
                createRefundMutation.mutate({
                  returnId: selectedReturn.id,
                  payload: refundForm,
                });
              }}
              disabled={
                !refundForm.amount ||
                parseFloat(refundForm.amount) <= 0 ||
                createRefundMutation.isPending
              }
            >
              {createRefundMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <IndianRupee className="mr-2 h-4 w-4" />
                  Initiate Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
