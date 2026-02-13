"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  Package,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  User,
  IndianRupee,
  Plus,
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Preorder {
  id: string;
  preorderNo: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  totalItems: number;
  subtotal: string;
  totalAmount: string;
  depositAmount: string;
  depositPaidAt: string | null;
  expectedAvailableDate: string | null;
  expiryDate: string | null;
  convertedOrderId: string | null;
  createdAt: string;
}

interface InventoryStatus {
  preorderId: string;
  totalLines: number;
  fullyAllocatedLines: number;
  partiallyAllocatedLines: number;
  unallocatedLines: number;
  totalQuantity: string;
  allocatedQuantity: string;
  percentageAllocated: string;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PARTIALLY_ALLOCATED", label: "Partially Allocated" },
  { value: "FULLY_ALLOCATED", label: "Fully Allocated" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PreordersPage() {
  const router = useRouter();
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPreorder, setSelectedPreorder] = useState<Preorder | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus | null>(null);

  const fetchPreorders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/v1/preorders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPreorders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching preorders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const debounce = setTimeout(fetchPreorders, 300);
    return () => clearTimeout(debounce);
  }, [fetchPreorders]);

  const fetchInventoryStatus = async (preorderId: string) => {
    try {
      const response = await fetch(`/api/v1/preorders/inventory-status?preorderId=${preorderId}`);
      if (response.ok) {
        const data = await response.json();
        setInventoryStatus(data);
      }
    } catch (error) {
      console.error("Error fetching inventory status:", error);
    }
  };

  const openConvertDialog = (preorder: Preorder) => {
    setSelectedPreorder(preorder);
    fetchInventoryStatus(preorder.id);
    setShowConvertDialog(true);
  };

  const convertToOrder = async () => {
    if (!selectedPreorder) return;

    try {
      setIsConverting(true);
      const response = await fetch(`/api/v1/preorders/${selectedPreorder.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preorderId: selectedPreorder.id }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Pre-order converted to order successfully");
        setShowConvertDialog(false);
        fetchPreorders();
        if (result.orderId) {
          router.push(`/orders/${result.orderId}`);
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to convert pre-order");
      }
    } catch (error) {
      toast.error("Failed to convert pre-order");
    } finally {
      setIsConverting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary">Draft</Badge>;
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>;
      case "PARTIALLY_ALLOCATED":
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case "FULLY_ALLOCATED":
        return <Badge className="bg-green-100 text-green-800">Ready</Badge>;
      case "CONVERTED":
        return <Badge className="bg-purple-100 text-purple-800">Converted</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "EXPIRED":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  const formatCurrency = (value: string | number | null): string => {
    const num = typeof value === "string" ? parseFloat(value) || 0 : (value ?? 0);
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num);
  };

  const stats = {
    total: preorders.length,
    confirmed: preorders.filter(p => p.status === "CONFIRMED").length,
    ready: preorders.filter(p => p.status === "FULLY_ALLOCATED").length,
    converted: preorders.filter(p => p.status === "CONVERTED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pre-orders</h1>
          <p className="text-muted-foreground">
            Manage pre-orders and inventory reservations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPreorders}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/orders/preorders/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Pre-order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pre-orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Convert</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <ArrowRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.converted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search by pre-order #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pre-orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-orders</CardTitle>
          <CardDescription>{preorders.length} pre-orders found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : preorders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pre-orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pre-order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preorders.map((preorder) => (
                  <TableRow key={preorder.id}>
                    <TableCell className="font-medium font-mono">
                      {preorder.preorderNo}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{preorder.customerName || "-"}</p>
                        <p className="text-sm text-muted-foreground">
                          {preorder.customerEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{preorder.totalItems}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(preorder.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {preorder.depositPaidAt ? (
                        <Badge className="bg-green-100 text-green-800">
                          {formatCurrency(preorder.depositAmount)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {formatCurrency(preorder.depositAmount)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {preorder.expectedAvailableDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(preorder.expectedAvailableDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(preorder.status)}</TableCell>
                    <TableCell className="text-right">
                      {preorder.status === "FULLY_ALLOCATED" && (
                        <Button
                          size="sm"
                          onClick={() => openConvertDialog(preorder)}
                        >
                          Convert
                        </Button>
                      )}
                      {preorder.status === "CONVERTED" && preorder.convertedOrderId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/orders/${preorder.convertedOrderId}`)}
                        >
                          View Order
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

      {/* Convert Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Pre-order to Order</DialogTitle>
            <DialogDescription>
              This will create a new order from this pre-order
            </DialogDescription>
          </DialogHeader>
          {selectedPreorder && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Pre-order #</span>
                  <span className="font-mono font-medium">{selectedPreorder.preorderNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Customer</span>
                  <span className="font-medium">{selectedPreorder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Amount</span>
                  <span className="font-medium">
                    {formatCurrency(selectedPreorder.totalAmount)}
                  </span>
                </div>
              </div>

              {inventoryStatus && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Inventory Allocation</p>
                  <Progress
                    value={parseDecimal(inventoryStatus.percentageAllocated)}
                    className="h-2"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{inventoryStatus.fullyAllocatedLines} / {inventoryStatus.totalLines} lines allocated</span>
                    <span>{parseDecimal(inventoryStatus.percentageAllocated).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={convertToOrder} disabled={isConverting}>
              {isConverting ? "Converting..." : "Convert to Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
