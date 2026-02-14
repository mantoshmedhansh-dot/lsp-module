"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  ExternalLink,
  Clock,
  CheckCircle,
  MapPin,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TrackingDrawer } from "./components/tracking-drawer";
import { BulkActionsBar } from "./components/bulk-actions-bar";

interface DeliveryItem {
  id: string;
  deliveryNo: string;
  awbNo: string | null;
  orderNo: string | null;
  orderId: string | null;
  customerName: string | null;
  paymentMode: string | null;
  status: string;
  carrierCode: string | null;
  carrierName: string | null;
  weight: number | null;
  boxes: number;
  labelUrl: string | null;
  trackingUrl: string | null;
  shipDate: string | null;
  deliveryDate: string | null;
  manifestId: string | null;
  createdAt: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-800 hover:bg-gray-100", icon: Clock },
  PACKED: { label: "Packed", color: "bg-blue-100 text-blue-800 hover:bg-blue-100", icon: Package },
  MANIFESTED: { label: "Manifested", color: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100", icon: FileText },
  SHIPPED: { label: "Shipped", color: "bg-blue-100 text-blue-800 hover:bg-blue-100", icon: Truck },
  IN_TRANSIT: { label: "In Transit", color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100", icon: MapPin },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "bg-orange-100 text-orange-800 hover:bg-orange-100", icon: Truck },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-800 hover:bg-green-100", icon: CheckCircle },
  NDR: { label: "NDR", color: "bg-red-100 text-red-800 hover:bg-red-100", icon: Clock },
  RTO: { label: "RTO", color: "bg-red-100 text-red-800 hover:bg-red-100", icon: RefreshCw },
  RTO_INITIATED: { label: "RTO Initiated", color: "bg-red-100 text-red-800 hover:bg-red-100", icon: RefreshCw },
  RTO_IN_TRANSIT: { label: "RTO Transit", color: "bg-red-100 text-red-800 hover:bg-red-100", icon: RefreshCw },
  RTO_DELIVERED: { label: "RTO Delivered", color: "bg-red-100 text-red-800 hover:bg-red-100", icon: RefreshCw },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800 hover:bg-gray-100", icon: Clock },
};

export default function DeliveryShippingPage() {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Tracking drawer
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingDelivery, setTrackingDelivery] = useState<DeliveryItem | null>(null);

  // Assign carrier dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignCarrierCode, setAssignCarrierCode] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Carriers list
  const [carriers, setCarriers] = useState<{ code: string; name: string }[]>([]);

  const limit = 20;

  useEffect(() => {
    fetchDeliveries();
  }, [page, statusFilter, carrierFilter, paymentFilter]);

  useEffect(() => {
    fetchCarriers();
  }, []);

  async function fetchCarriers() {
    try {
      const res = await fetch("/api/v1/transporters?limit=50");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.data || [];
      setCarriers(items.map((t: { code: string; name: string }) => ({ code: t.code, name: t.name })));
    } catch {
      // Carriers load failed
    }
  }

  async function fetchDeliveries() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (carrierFilter && carrierFilter !== "all") params.append("carrier_code", carrierFilter);
      if (paymentFilter && paymentFilter !== "all") params.append("payment_mode", paymentFilter);
      params.append("skip", String((page - 1) * limit));
      params.append("limit", String(limit));

      const response = await fetch(`/api/v1/shipping/deliveries?${params}`);
      const data = await response.json();

      setDeliveries(data.deliveries || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to fetch deliveries");
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setPage(1);
    fetchDeliveries();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === deliveries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deliveries.map((d) => d.id)));
    }
  };

  const openTracking = (d: DeliveryItem) => {
    setTrackingDelivery(d);
    setTrackingOpen(true);
  };

  async function handleAssignCarrier() {
    if (!assignCarrierCode || selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/v1/shipping/bulk-assign-carrier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryIds: Array.from(selectedIds),
          carrierCode: assignCarrierCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Carrier assigned to ${data.updated} deliveries`);
        setSelectedIds(new Set());
        setAssignDialogOpen(false);
        fetchDeliveries();
      } else {
        toast.error(data.detail || "Failed to assign carrier");
      }
    } catch {
      toast.error("Failed to assign carrier");
    } finally {
      setAssigning(false);
    }
  }

  async function handleCreateManifest() {
    if (selectedIds.size === 0) return;
    // Get first delivery's transporter to group
    const firstDelivery = deliveries.find((d) => selectedIds.has(d.id));
    if (!firstDelivery) return;

    // Find transporter ID via carrier code
    try {
      const res = await fetch(`/api/v1/transporters?limit=50`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.data || [];
      const transporter = items.find(
        (t: { code: string }) => t.code === firstDelivery.carrierCode
      );
      if (!transporter) {
        toast.error("Assign a carrier to deliveries first");
        return;
      }

      const manifestRes = await fetch("/api/v1/shipping/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryIds: Array.from(selectedIds),
          transporterId: transporter.id,
        }),
      });
      const manifestData = await manifestRes.json();
      if (manifestRes.ok) {
        toast.success(`Manifest ${manifestData.manifestNo} created with ${manifestData.deliveriesAssigned} deliveries`);
        setSelectedIds(new Set());
        fetchDeliveries();
      } else {
        toast.error(manifestData.detail || "Failed to create manifest");
      }
    } catch {
      toast.error("Failed to create manifest");
    }
  }

  async function handleDownloadLabels() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/v1/shipping/bulk-generate-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      const labels = data.labels || [];
      let opened = 0;
      for (const label of labels) {
        if (label.labelUrl) {
          window.open(label.labelUrl, "_blank");
          opened++;
        }
      }
      if (opened > 0) {
        toast.success(`Opened ${opened} label(s)`);
      } else {
        toast.error("No labels available for selected deliveries");
      }
    } catch {
      toast.error("Failed to fetch labels");
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800", icon: Clock };
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Delivery Shipping</h1>
          <p className="text-muted-foreground">
            Manage deliveries, labels, tracking, and manifests
          </p>
        </div>
        <Button onClick={fetchDeliveries} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipped</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {deliveries.filter((d) => ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(d.status)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {deliveries.filter((d) => d.status === "DELIVERED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {deliveries.filter((d) => ["NDR", "RTO", "RTO_INITIATED"].includes(d.status)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by delivery no, AWB, or order no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PACKED">Packed</SelectItem>
                <SelectItem value="MANIFESTED">Manifested</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="OUT_FOR_DELIVERY">Out for Delivery</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="NDR">NDR</SelectItem>
                <SelectItem value="RTO">RTO</SelectItem>
              </SelectContent>
            </Select>
            <Select value={carrierFilter} onValueChange={(v) => { setCarrierFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PREPAID">Prepaid</SelectItem>
                <SelectItem value="COD">COD</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={deliveries.length > 0 && selectedIds.size === deliveries.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Delivery No</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>AWB</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ship Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No deliveries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                deliveries.map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => openTracking(d)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={() => toggleSelect(d.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {d.deliveryNo}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{d.orderNo || "-"}</span>
                      {d.customerName && (
                        <p className="text-xs text-muted-foreground">{d.customerName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.awbNo ? (
                        <span className="font-mono text-sm">{d.awbNo}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.carrierName || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {d.paymentMode ? (
                        <Badge variant={d.paymentMode === "COD" ? "destructive" : "secondary"} className="text-xs">
                          {d.paymentMode}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(d.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(d.shipDate)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {d.labelUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(d.labelUrl!, "_blank")}
                            title="Download Label"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {d.trackingUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a
                              href={d.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Track"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {deliveries.length} of {total} deliveries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
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
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAssignCarrier={() => setAssignDialogOpen(true)}
        onCreateManifest={handleCreateManifest}
        onDownloadLabels={handleDownloadLabels}
      />

      {/* Tracking Drawer */}
      <TrackingDrawer
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        deliveryId={trackingDelivery?.id || null}
        deliveryNo={trackingDelivery?.deliveryNo || ""}
        awbNo={trackingDelivery?.awbNo || null}
      />

      {/* Assign Carrier Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Carrier</DialogTitle>
            <DialogDescription>
              Assign a carrier to {selectedIds.size} selected deliveries
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={assignCarrierCode} onValueChange={setAssignCarrierCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select carrier..." />
              </SelectTrigger>
              <SelectContent>
                {carriers.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignCarrier} disabled={!assignCarrierCode || assigning}>
                {assigning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="mr-2 h-4 w-4" />
                )}
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
