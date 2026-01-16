"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  RefreshCw,
  Package,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  Truck,
  PackageCheck,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  bins: Bin[];
}

interface Bin {
  id: string;
  code: string;
  name: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
  barcodes: string[];
  isSerialised: boolean;
  isBatchTracked: boolean;
}

interface InboundItem {
  id: string;
  skuId: string;
  sku?: SKU;
  expectedQty: number | null;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  batchNo: string | null;
  expiryDate: string | null;
  mfgDate: string | null;
  mrp: number | null;
  binId: string | null;
  qcStatus: string | null;
  qcRemarks: string | null;
}

interface Inbound {
  id: string;
  inboundNo: string;
  type: string;
  status: string;
  grnNo: string | null;
  remarks: string | null;
  location: Location;
  receivedBy: { id: string; name: string };
  purchaseOrder?: {
    id: string;
    poNo: string;
    vendor: { id: string; code: string; name: string };
  };
  items: InboundItem[];
  _count: { items: number };
  createdAt: string;
  completedAt: string | null;
}

interface PurchaseOrder {
  id: string;
  poNo: string;
  vendor: { id: string; code: string; name: string };
  status: string;
}

function InboundReceivingContent() {
  const searchParams = useSearchParams();
  const poIdFromUrl = searchParams.get("poId");

  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedInbound, setSelectedInbound] = useState<Inbound | null>(null);

  // Form state
  const [locations, setLocations] = useState<Location[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [newInbound, setNewInbound] = useState({
    type: "PURCHASE_ORDER",
    purchaseOrderId: poIdFromUrl || "",
    locationId: "",
    remarks: "",
  });
  const [receiveItems, setReceiveItems] = useState<{
    id: string;
    receivedQty: number;
    binId: string;
    batchNo: string;
    expiryDate: string;
  }[]>([]);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchInbounds = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/inbounds?${params}`);
      const data = await response.json();

      setInbounds(data.inbounds || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setStatusCounts(data.statusCounts || {});
      setTypeCounts(data.typeCounts || {});
    } catch (error) {
      console.error("Error fetching inbounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const [locRes, poRes, skuRes] = await Promise.all([
        fetch("/api/v1/locations"),
        fetch("/api/v1/purchase-orders?status=APPROVED&limit=100"),
        fetch("/api/v1/skus?limit=500"),
      ]);

      const [locData, poData, skuData] = await Promise.all([
        locRes.json(),
        poRes.json(),
        skuRes.json(),
      ]);

      setLocations(locData.locations || []);
      setPurchaseOrders(poData.purchaseOrders || []);
      setSkus(skuData.skus || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
    }
  };

  const fetchZones = async (locationId: string) => {
    try {
      const response = await fetch(`/api/v1/zones?locationId=${locationId}&includeBins=true`);
      const data = await response.json();
      setZones(data || []);
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  };

  const fetchInboundDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/inbounds/${id}`);
      const data = await response.json();
      setSelectedInbound(data);

      // Initialize receive items
      setReceiveItems(
        data.items.map((item: InboundItem) => ({
          id: item.id,
          receivedQty: item.receivedQty || item.expectedQty || 0,
          binId: item.binId || "",
          batchNo: item.batchNo || "",
          expiryDate: item.expiryDate ? item.expiryDate.split("T")[0] : "",
        }))
      );

      // Fetch zones for this location
      if (data.location?.id) {
        fetchZones(data.location.id);
      }

      setReceiveDialogOpen(true);
    } catch (error) {
      console.error("Error fetching inbound details:", error);
    }
  };

  useEffect(() => {
    fetchInbounds();
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    if (createDialogOpen) {
      fetchFormData();
    }
  }, [createDialogOpen]);

  useEffect(() => {
    if (newInbound.locationId) {
      fetchZones(newInbound.locationId);
    }
  }, [newInbound.locationId]);

  // Auto-open create dialog if poId in URL
  useEffect(() => {
    if (poIdFromUrl) {
      setNewInbound((prev) => ({ ...prev, purchaseOrderId: poIdFromUrl }));
      setCreateDialogOpen(true);
    }
  }, [poIdFromUrl]);

  const handleSearch = () => {
    setPage(1);
    fetchInbounds();
  };

  const handleCreateInbound = async () => {
    if (!newInbound.type || !newInbound.locationId) {
      alert("Please select type and location");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/inbounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newInbound.type,
          purchaseOrderId: newInbound.purchaseOrderId || null,
          locationId: newInbound.locationId,
          remarks: newInbound.remarks || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreateDialogOpen(false);
        setNewInbound({ type: "PURCHASE_ORDER", purchaseOrderId: "", locationId: "", remarks: "" });
        fetchInbounds();
        // Open receive dialog for new inbound
        fetchInboundDetails(data.id);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create inbound");
      }
    } catch (error) {
      console.error("Error creating inbound:", error);
      alert("Failed to create inbound");
    } finally {
      setCreating(false);
    }
  };

  const handleReceiveItems = async () => {
    if (!selectedInbound) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/v1/inbounds/${selectedInbound.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive-items",
          items: receiveItems,
        }),
      });

      if (response.ok) {
        fetchInboundDetails(selectedInbound.id);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to receive items");
      }
    } catch (error) {
      console.error("Error receiving items:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteInbound = async () => {
    if (!selectedInbound) return;

    // Validate all items have bins
    const missingBins = receiveItems.some((item) => item.receivedQty > 0 && !item.binId);
    if (missingBins) {
      alert("Please select a bin for all items with received quantity");
      return;
    }

    setProcessing(true);
    try {
      // First save the receive items
      await fetch(`/api/v1/inbounds/${selectedInbound.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive-items",
          items: receiveItems,
        }),
      });

      // Then complete
      const response = await fetch(`/api/v1/inbounds/${selectedInbound.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });

      if (response.ok) {
        setReceiveDialogOpen(false);
        fetchInbounds();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to complete inbound");
      }
    } catch (error) {
      console.error("Error completing inbound:", error);
    } finally {
      setProcessing(false);
    }
  };

  const updateReceiveItem = (index: number, field: string, value: string | number) => {
    const updated = [...receiveItems];
    updated[index] = { ...updated[index], [field]: value };
    setReceiveItems(updated);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-gray-100 text-gray-800",
      IN_PROGRESS: "bg-blue-100 text-blue-800",
      QC_PENDING: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={`${colors[status] || "bg-gray-100"} hover:${colors[status]}`}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      PURCHASE_ORDER: "bg-purple-100 text-purple-800",
      ASN: "bg-cyan-100 text-cyan-800",
      RETURN: "bg-orange-100 text-orange-800",
      DIRECT: "bg-blue-100 text-blue-800",
      STOCK_TRANSFER: "bg-green-100 text-green-800",
    };

    return (
      <Badge className={`${colors[type] || "bg-gray-100"} hover:${colors[type]}`}>
        {type.replace("_", " ")}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getAllBins = () => {
    const bins: { id: string; code: string; zoneName: string }[] = [];
    zones.forEach((zone) => {
      zone.bins?.forEach((bin) => {
        bins.push({ id: bin.id, code: bin.code, zoneName: zone.name });
      });
    });
    return bins;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbound Receiving</h1>
          <p className="text-muted-foreground">
            Receive goods from purchase orders and other sources
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Inbound
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {statusCounts["PENDING"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <PackageCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statusCounts["IN_PROGRESS"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QC Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts["QC_PENDING"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statusCounts["COMPLETED"] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by inbound no, GRN, or PO..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                <SelectItem value="ASN">ASN</SelectItem>
                <SelectItem value="RETURN">Return</SelectItem>
                <SelectItem value="DIRECT">Direct</SelectItem>
                <SelectItem value="STOCK_TRANSFER">Stock Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="QC_PENDING">QC Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={fetchInbounds}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inbound No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>PO / Vendor</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>GRN</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : inbounds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No inbounds found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                inbounds.map((inbound) => (
                  <TableRow key={inbound.id}>
                    <TableCell className="font-mono font-medium">{inbound.inboundNo}</TableCell>
                    <TableCell>{getTypeBadge(inbound.type)}</TableCell>
                    <TableCell>
                      {inbound.purchaseOrder ? (
                        <div>
                          <div className="font-medium">{inbound.purchaseOrder.poNo}</div>
                          <div className="text-xs text-muted-foreground">
                            {inbound.purchaseOrder.vendor.name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{inbound.location.name}</div>
                      <div className="text-xs text-muted-foreground">{inbound.location.code}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(inbound.status)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {inbound.grnNo || "-"}
                    </TableCell>
                    <TableCell>{inbound._count.items}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(inbound.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchInboundDetails(inbound.id)}
                      >
                        {inbound.status === "COMPLETED" ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <PackageCheck className="h-4 w-4" />
                        )}
                      </Button>
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
            Showing {inbounds.length} of {total} inbounds
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

      {/* Create Inbound Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Inbound</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Inbound Type *</Label>
              <Select
                value={newInbound.type}
                onValueChange={(value) => setNewInbound({ ...newInbound, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                  <SelectItem value="ASN">ASN</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="DIRECT">Direct</SelectItem>
                  <SelectItem value="STOCK_TRANSFER">Stock Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newInbound.type === "PURCHASE_ORDER" && (
              <div className="space-y-2">
                <Label>Purchase Order</Label>
                <Select
                  value={newInbound.purchaseOrderId}
                  onValueChange={(value) => setNewInbound({ ...newInbound, purchaseOrderId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNo} - {po.vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Location *</Label>
              <Select
                value={newInbound.locationId}
                onValueChange={(value) => setNewInbound({ ...newInbound, locationId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={newInbound.remarks}
                onChange={(e) => setNewInbound({ ...newInbound, remarks: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInbound} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create & Receive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Inbound Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedInbound?.inboundNo}
              <span className="ml-2">
                {selectedInbound && getStatusBadge(selectedInbound.status)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedInbound && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p>{getTypeBadge(selectedInbound.type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedInbound.location.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GRN</p>
                  <p className="font-mono">{selectedInbound.grnNo || "-"}</p>
                </div>
                {selectedInbound.purchaseOrder && (
                  <>
                    <div>
                      <p className="text-muted-foreground">PO No</p>
                      <p className="font-mono">{selectedInbound.purchaseOrder.poNo}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vendor</p>
                      <p className="font-medium">{selectedInbound.purchaseOrder.vendor.name}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="w-[100px]">Received</TableHead>
                      <TableHead className="w-[150px]">Bin</TableHead>
                      <TableHead className="w-[120px]">Batch No</TableHead>
                      <TableHead className="w-[130px]">Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInbound.items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.sku?.code}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {item.sku?.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.expectedQty || "-"}
                        </TableCell>
                        <TableCell>
                          {selectedInbound.status !== "COMPLETED" ? (
                            <Input
                              type="number"
                              min="0"
                              value={receiveItems[index]?.receivedQty || 0}
                              onChange={(e) =>
                                updateReceiveItem(index, "receivedQty", parseInt(e.target.value) || 0)
                              }
                              className="w-20"
                            />
                          ) : (
                            <span className="font-medium">{item.receivedQty}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {selectedInbound.status !== "COMPLETED" ? (
                            <Select
                              value={receiveItems[index]?.binId || ""}
                              onValueChange={(value) => updateReceiveItem(index, "binId", value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAllBins().map((bin) => (
                                  <SelectItem key={bin.id} value={bin.id}>
                                    {bin.code} ({bin.zoneName})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{item.binId ? "Assigned" : "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {selectedInbound.status !== "COMPLETED" ? (
                            <Input
                              value={receiveItems[index]?.batchNo || ""}
                              onChange={(e) => updateReceiveItem(index, "batchNo", e.target.value)}
                              placeholder="Batch"
                            />
                          ) : (
                            <span>{item.batchNo || "-"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {selectedInbound.status !== "COMPLETED" ? (
                            <Input
                              type="date"
                              value={receiveItems[index]?.expiryDate || ""}
                              onChange={(e) => updateReceiveItem(index, "expiryDate", e.target.value)}
                            />
                          ) : (
                            <span>{formatDate(item.expiryDate)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedInbound.status !== "COMPLETED" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handleReceiveItems} disabled={processing}>
                    Save Progress
                  </Button>
                  <Button onClick={handleCompleteInbound} disabled={processing}>
                    {processing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Complete & Add to Inventory
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InboundReceivingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-6 w-6 animate-spin" /></div>}>
      <InboundReceivingContent />
    </Suspense>
  );
}
