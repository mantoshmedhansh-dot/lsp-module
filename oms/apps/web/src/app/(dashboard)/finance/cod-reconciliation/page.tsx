"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Plus,
  Eye,
  RefreshCw,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  RECONCILED: "bg-blue-100 text-blue-800",
  VERIFIED: "bg-green-100 text-green-800",
  CLOSED: "bg-purple-100 text-purple-800",
};

interface CODReconciliation {
  id: string;
  reconciliationNo: string;
  status: string;
  reconciliationDate: string;
  remittanceNo?: string;
  bankRef?: string;
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  transporter: { id: string; name: string; code: string };
  _count: { transactions: number };
  createdAt: string;
}

interface Transporter {
  id: string;
  name: string;
  code: string;
}

export default function CODReconciliationPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    transporterId: "",
    reconciliationDate: new Date().toISOString().split("T")[0],
    remittanceNo: "",
    bankRef: "",
    deliveryIds: [] as string[],
  });

  // Fetch reconciliations
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cod-reconciliations", status, transporterId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (status) params.append("status", status);
      if (transporterId) params.append("transporterId", transporterId);

      const res = await fetch(`/api/cod-reconciliation?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reconciliations");
      return res.json();
    },
  });

  // Fetch transporters
  const { data: transportersData } = useQuery({
    queryKey: ["transporters"],
    queryFn: async () => {
      const res = await fetch("/api/transporters?limit=100");
      if (!res.ok) throw new Error("Failed to fetch transporters");
      return res.json();
    },
  });

  // Fetch pending COD deliveries for selected transporter
  const { data: pendingDeliveries } = useQuery({
    queryKey: ["pending-cod-deliveries", formData.transporterId],
    queryFn: async () => {
      if (!formData.transporterId) return { data: [] };
      const params = new URLSearchParams({
        transporterId: formData.transporterId,
        status: "DELIVERED",
        paymentMode: "COD",
        codReconciled: "false",
        limit: "100",
      });
      const res = await fetch(`/api/deliveries?${params}`);
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      return res.json();
    },
    enabled: !!formData.transporterId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/cod-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create reconciliation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reconciliation created",
        description: `${data.reconciliationNo} created with ${data._count?.transactions || 0} transactions`,
      });
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["cod-reconciliations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      transporterId: "",
      reconciliationDate: new Date().toISOString().split("T")[0],
      remittanceNo: "",
      bankRef: "",
      deliveryIds: [],
    });
  };

  const toggleDelivery = (deliveryId: string) => {
    setFormData((p) => ({
      ...p,
      deliveryIds: p.deliveryIds.includes(deliveryId)
        ? p.deliveryIds.filter((id) => id !== deliveryId)
        : [...p.deliveryIds, deliveryId],
    }));
  };

  const selectAllDeliveries = () => {
    const allIds = (pendingDeliveries?.data || []).map((d: { id: string }) => d.id);
    setFormData((p) => ({
      ...p,
      deliveryIds: p.deliveryIds.length === allIds.length ? [] : allIds,
    }));
  };

  const reconciliations: CODReconciliation[] = data?.data || [];
  const transporters: Transporter[] = transportersData?.data || [];
  const stats = data?.stats || {};
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">COD Reconciliation</h1>
          <p className="text-muted-foreground">
            Track and reconcile Cash on Delivery payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Reconciliation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create COD Reconciliation</DialogTitle>
                <DialogDescription>
                  Select delivered COD orders to reconcile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Transporter *</Label>
                    <Select
                      value={formData.transporterId}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          transporterId: v,
                          deliveryIds: [],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporters.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Reconciliation Date</Label>
                    <Input
                      type="date"
                      value={formData.reconciliationDate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          reconciliationDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Remittance No</Label>
                    <Input
                      value={formData.remittanceNo}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          remittanceNo: e.target.value,
                        }))
                      }
                      placeholder="Bank transfer reference"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bank Reference</Label>
                    <Input
                      value={formData.bankRef}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, bankRef: e.target.value }))
                      }
                      placeholder="UTR/NEFT reference"
                    />
                  </div>
                </div>

                {/* Deliveries selection */}
                {formData.transporterId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Deliveries</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllDeliveries}
                      >
                        {formData.deliveryIds.length ===
                        (pendingDeliveries?.data || []).length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    </div>
                    {(pendingDeliveries?.data || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No pending COD deliveries for this transporter
                      </p>
                    ) : (
                      <div className="border rounded-lg max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">Select</TableHead>
                              <TableHead>AWB</TableHead>
                              <TableHead>Order</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(pendingDeliveries?.data || []).map(
                              (delivery: {
                                id: string;
                                awbNo: string;
                                order: { orderNo: string; totalAmount: { toNumber?: () => number } };
                              }) => (
                                <TableRow
                                  key={delivery.id}
                                  className="cursor-pointer"
                                  onClick={() => toggleDelivery(delivery.id)}
                                >
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={formData.deliveryIds.includes(
                                        delivery.id
                                      )}
                                      onChange={() => toggleDelivery(delivery.id)}
                                    />
                                  </TableCell>
                                  <TableCell>{delivery.awbNo}</TableCell>
                                  <TableCell>{delivery.order.orderNo}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(
                                      typeof delivery.order.totalAmount === 'object'
                                        ? delivery.order.totalAmount.toNumber?.() || 0
                                        : delivery.order.totalAmount
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {formData.deliveryIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formData.deliveryIds.length} deliveries selected
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={
                    !formData.transporterId ||
                    formData.deliveryIds.length === 0 ||
                    createMutation.isPending
                  }
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Expected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(stats.totalExpected || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalReceived || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                (stats.totalDifference || 0) < 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {formatCurrency(stats.totalDifference || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(
                (stats.totalExpected || 0) - (stats.totalReceived || 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="RECONCILED">Reconciled</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={transporterId || "all"} onValueChange={(v) => setTransporterId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All transporters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All transporters</SelectItem>
                {transporters.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliations</CardTitle>
          <CardDescription>{data?.total || 0} total records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : reconciliations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <IndianRupee className="h-12 w-12 mb-4" />
              <p>No reconciliations found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reconciliation No</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Transactions</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">
                        {rec.reconciliationNo}
                      </TableCell>
                      <TableCell>{rec.transporter.name}</TableCell>
                      <TableCell>
                        {formatDate(rec.reconciliationDate)}
                      </TableCell>
                      <TableCell>{rec._count.transactions}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(rec.expectedAmount)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(rec.receivedAmount)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          rec.differenceAmount < 0
                            ? "text-red-600"
                            : rec.differenceAmount > 0
                            ? "text-green-600"
                            : ""
                        }`}
                      >
                        {formatCurrency(rec.differenceAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[rec.status] || ""}>
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/finance/cod-reconciliation/${rec.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
