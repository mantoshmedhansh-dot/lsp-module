"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Package,
  Truck,
  XCircle,
  CheckCircle,
  FileText,
  Upload,
  Download,
  Layers,
  Search,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface Order {
  id: string;
  orderNo: string;
  status: string;
  customerName: string;
  totalAmount: number;
  channel: string;
  createdAt: string;
}

export default function BulkActionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Fetch orders
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bulk-orders", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/v1/orders?${params}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const result = await res.json();
      const orders = Array.isArray(result)
        ? result
        : result.orders || result.data || result.items || [];
      return orders as Order[];
    },
  });

  const orders = data || [];

  const toggleOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o) => o.id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedOrders.length === 0) {
      toast.error("No orders selected");
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const orderId of selectedOrders) {
        try {
          let endpoint = `/api/v1/orders/${orderId}`;
          let method = "PATCH";
          let body: Record<string, unknown> = {};

          switch (bulkAction) {
            case "ship":
              endpoint = `/api/v1/orders/${orderId}/ship`;
              method = "POST";
              break;
            case "cancel":
              body = { status: "CANCELLED" };
              break;
            case "update_status":
              body = { status: newStatus };
              break;
            default:
              continue;
          }

          const res = await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      toast.success(
        `Bulk ${bulkAction}: ${successCount} succeeded, ${failCount} failed`
      );
      setSelectedOrders([]);
      setShowActionDialog(false);
      queryClient.invalidateQueries({ queryKey: ["bulk-orders"] });
    } catch (error) {
      toast.error("Bulk operation failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ limit: "10000", format: "csv" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/v1/orders?${params}`);
      const result = await res.json();
      const exportOrders = Array.isArray(result)
        ? result
        : result.orders || result.data || result.items || [];

      // Build CSV
      const headers = [
        "Order No",
        "Status",
        "Customer",
        "Amount",
        "Channel",
        "Created",
      ].join(",");
      const rows = exportOrders.map(
        (o: Order) =>
          `"${o.orderNo}","${o.status}","${o.customerName}","${o.totalAmount}","${o.channel}","${o.createdAt}"`
      );
      const csv = [headers, ...rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${exportOrders.length} orders`);
    } catch {
      toast.error("Export failed");
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "order_no",
      "order_date",
      "channel",
      "payment_mode",
      "customer_name",
      "customer_phone",
      "customer_email",
      "shipping_address_line1",
      "shipping_city",
      "shipping_state",
      "shipping_pincode",
      "sku_code",
      "quantity",
      "unit_price",
    ].join(",");
    const sampleRow = [
      "ORD001",
      "2026-01-15",
      "MANUAL",
      "PREPAID",
      "John Doe",
      "9876543210",
      "john@example.com",
      "123 Main St",
      "Mumbai",
      "Maharashtra",
      "400001",
      "SKU001",
      "2",
      "500",
    ].join(",");

    const csv = `${headers}\n${sampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_order_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAction = (action: string) => {
    if (action === "export") {
      handleExport();
      return;
    }
    if (action === "import") {
      router.push("/orders/import");
      return;
    }
    if (action === "waves") {
      router.push("/fulfillment/waves");
      return;
    }
    setBulkAction(action);
    setShowActionDialog(true);
  };

  const statusColors: Record<string, string> = {
    CREATED: "bg-gray-100 text-gray-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-yellow-100 text-yellow-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/orders")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Actions</h1>
          <p className="text-muted-foreground">
            Perform operations on multiple orders at once
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "Import", icon: Upload, action: "import", color: "text-blue-600" },
          { label: "Ship", icon: Truck, action: "ship", color: "text-green-600" },
          { label: "Cancel", icon: XCircle, action: "cancel", color: "text-red-600" },
          { label: "Labels", icon: FileText, action: "print_labels", color: "text-purple-600" },
          { label: "Invoices", icon: FileSpreadsheet, action: "print_invoices", color: "text-indigo-600" },
          { label: "Export", icon: Download, action: "export", color: "text-teal-600" },
          { label: "Add to Wave", icon: Layers, action: "waves", color: "text-amber-600" },
          { label: "Update Status", icon: CheckCircle, action: "update_status", color: "text-emerald-600" },
        ].map((item) => (
          <Button
            key={item.action}
            variant="outline"
            className="flex flex-col gap-1 h-auto py-3"
            onClick={() => openAction(item.action)}
            disabled={
              !["import", "export", "waves"].includes(item.action) &&
              selectedOrders.length === 0
            }
          >
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </div>

      {/* Selection info */}
      {selectedOrders.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedOrders.length} order(s) selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrders([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bulk Import via CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button size="sm" onClick={() => router.push("/orders/import")}>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Select Orders</CardTitle>
          <CardDescription>
            {orders.length} orders loaded. Select orders to apply bulk actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedOrders.length === orders.length &&
                        orders.length > 0
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Order No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => toggleOrder(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.orderNo}
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[order.status] || ""}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(order.totalAmount).toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm Bulk{" "}
              {bulkAction === "ship"
                ? "Ship"
                : bulkAction === "cancel"
                ? "Cancel"
                : bulkAction === "update_status"
                ? "Status Update"
                : bulkAction.replace("_", " ")}
            </DialogTitle>
            <DialogDescription>
              This will affect {selectedOrders.length} selected order(s).
            </DialogDescription>
          </DialogHeader>

          {bulkAction === "update_status" && (
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={
                processing ||
                (bulkAction === "update_status" && !newStatus)
              }
              variant={bulkAction === "cancel" ? "destructive" : "default"}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm (${selectedOrders.length} orders)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
