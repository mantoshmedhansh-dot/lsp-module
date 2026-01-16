"use client";

import { useState, useEffect } from "react";
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  PackageCheck,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface SKU {
  id: string;
  code: string;
  name: string;
}

interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  channel: string;
}

interface ReturnItem {
  id: string;
  skuId: string;
  sku?: SKU;
  quantity: number;
  receivedQty: number;
  qcStatus: string | null;
  qcGrade: string | null;
  qcRemarks: string | null;
  action: string | null;
  restockedQty: number;
  disposedQty: number;
}

interface Return {
  id: string;
  returnNo: string;
  type: string;
  status: string;
  orderId: string | null;
  order?: Order;
  awbNo: string | null;
  reason: string | null;
  remarks: string | null;
  items: ReturnItem[];
  _count: { items: number };
  initiatedAt: string;
  receivedAt: string | null;
  processedAt: string | null;
  refundAmount: number | null;
  refundStatus: string | null;
  createdAt: string;
}

interface Zone {
  id: string;
  code: string;
  name: string;
  bins: { id: string; code: string; name: string }[];
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);

  // Form state
  const [orders, setOrders] = useState<Order[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [newReturn, setNewReturn] = useState({
    type: "CUSTOMER_RETURN",
    orderId: "",
    awbNo: "",
    reason: "",
    remarks: "",
  });
  const [newReturnItems, setNewReturnItems] = useState<{ skuId: string; quantity: number }[]>([
    { skuId: "", quantity: 1 },
  ]);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);

  // QC and process state
  const [qcItems, setQcItems] = useState<{
    id: string;
    qcStatus: string;
    qcGrade: string;
    qcRemarks: string;
  }[]>([]);
  const [processItems, setProcessItems] = useState<{
    id: string;
    action: string;
    quantity: number;
  }[]>([]);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/returns?${params}`);
      const data = await response.json();

      setReturns(data.returns || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setTypeCounts(data.typeCounts || {});
      setStatusCounts(data.statusCounts || {});
    } catch (error) {
      console.error("Error fetching returns:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      const [orderRes, skuRes, locRes] = await Promise.all([
        fetch("/api/v1/orders?status=DELIVERED&limit=100"),
        fetch("/api/v1/skus?limit=500"),
        fetch("/api/v1/locations"),
      ]);

      const [orderData, skuData, locData] = await Promise.all([
        orderRes.json(),
        skuRes.json(),
        locRes.json(),
      ]);

      setOrders(orderData.orders || []);
      setSkus(skuData.skus || []);

      // Fetch zones for first location
      if (locData.locations?.length > 0) {
        setSelectedLocationId(locData.locations[0].id);
        const zoneRes = await fetch(`/api/v1/zones?locationId=${locData.locations[0].id}&includeBins=true`);
        const zoneData = await zoneRes.json();
        setZones(zoneData || []);
      }
    } catch (error) {
      console.error("Error fetching form data:", error);
    }
  };

  const fetchReturnDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/returns/${id}`);
      const data = await response.json();
      setSelectedReturn(data);

      // Initialize QC items
      setQcItems(
        data.items.map((item: ReturnItem) => ({
          id: item.id,
          qcStatus: item.qcStatus || "",
          qcGrade: item.qcGrade || "",
          qcRemarks: item.qcRemarks || "",
        }))
      );

      // Initialize process items
      setProcessItems(
        data.items.map((item: ReturnItem) => ({
          id: item.id,
          action: item.action || "RESTOCK",
          quantity: item.receivedQty || item.quantity,
        }))
      );

      setViewDialogOpen(true);
    } catch (error) {
      console.error("Error fetching return details:", error);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    if (createDialogOpen) {
      fetchFormData();
    }
  }, [createDialogOpen]);

  const handleSearch = () => {
    setPage(1);
    fetchReturns();
  };

  const handleCreateReturn = async () => {
    if (!newReturn.type) {
      alert("Please select return type");
      return;
    }

    const validItems = newReturnItems.filter((item) => item.skuId && item.quantity > 0);
    if (validItems.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newReturn.type,
          orderId: newReturn.orderId || null,
          awbNo: newReturn.awbNo || null,
          reason: newReturn.reason || null,
          remarks: newReturn.remarks || null,
          items: validItems,
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setNewReturn({ type: "CUSTOMER_RETURN", orderId: "", awbNo: "", reason: "", remarks: "" });
        setNewReturnItems([{ skuId: "", quantity: 1 }]);
        fetchReturns();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create return");
      }
    } catch (error) {
      console.error("Error creating return:", error);
      alert("Failed to create return");
    } finally {
      setCreating(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedReturn) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/v1/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive",
          items: selectedReturn.items.map((item) => ({
            id: item.id,
            receivedQty: item.quantity,
          })),
        }),
      });

      if (response.ok) {
        fetchReturnDetails(selectedReturn.id);
      }
    } catch (error) {
      console.error("Error receiving return:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleQC = async () => {
    if (!selectedReturn) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/v1/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "qc",
          items: qcItems,
        }),
      });

      if (response.ok) {
        fetchReturnDetails(selectedReturn.id);
      }
    } catch (error) {
      console.error("Error QC return:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedReturn || !selectedBinId) {
      alert("Please select a bin for restocking");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/v1/returns/${selectedReturn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process",
          items: processItems,
          binId: selectedBinId,
          locationId: selectedLocationId,
        }),
      });

      if (response.ok) {
        setViewDialogOpen(false);
        fetchReturns();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to process return");
      }
    } catch (error) {
      console.error("Error processing return:", error);
    } finally {
      setProcessing(false);
    }
  };

  const addReturnItem = () => {
    setNewReturnItems([...newReturnItems, { skuId: "", quantity: 1 }]);
  };

  const removeReturnItem = (index: number) => {
    if (newReturnItems.length > 1) {
      setNewReturnItems(newReturnItems.filter((_, i) => i !== index));
    }
  };

  const updateReturnItem = (index: number, field: string, value: string | number) => {
    const updated = [...newReturnItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewReturnItems(updated);
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      CUSTOMER_RETURN: "bg-purple-100 text-purple-800",
      RTO: "bg-orange-100 text-orange-800",
      VENDOR_RETURN: "bg-cyan-100 text-cyan-800",
    };

    const labels: Record<string, string> = {
      CUSTOMER_RETURN: "Customer Return",
      RTO: "RTO",
      VENDOR_RETURN: "Vendor Return",
    };

    return (
      <Badge className={`${colors[type] || "bg-gray-100"} hover:${colors[type]}`}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      INITIATED: "bg-gray-100 text-gray-800",
      IN_TRANSIT: "bg-blue-100 text-blue-800",
      RECEIVED: "bg-cyan-100 text-cyan-800",
      QC_PENDING: "bg-yellow-100 text-yellow-800",
      QC_PASSED: "bg-green-100 text-green-800",
      QC_FAILED: "bg-red-100 text-red-800",
      RESTOCKED: "bg-emerald-100 text-emerald-800",
      DISPOSED: "bg-gray-100 text-gray-800",
      REFUNDED: "bg-purple-100 text-purple-800",
    };

    return (
      <Badge className={`${colors[status] || "bg-gray-100"} hover:${colors[status]}`}>
        {status.replace("_", " ")}
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
          <h1 className="text-3xl font-bold tracking-tight">Returns</h1>
          <p className="text-muted-foreground">
            Manage customer returns and RTOs
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Return
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Initiated</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {statusCounts["INITIATED"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statusCounts["IN_TRANSIT"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <Package className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {statusCounts["RECEIVED"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QC Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts["QC_PENDING"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restocked</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statusCounts["RESTOCKED"] || 0}
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
                  placeholder="Search by return no, AWB, or order..."
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
                <SelectItem value="CUSTOMER_RETURN">Customer Return</SelectItem>
                <SelectItem value="RTO">RTO</SelectItem>
                <SelectItem value="VENDOR_RETURN">Vendor Return</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="INITIATED">Initiated</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="QC_PENDING">QC Pending</SelectItem>
                <SelectItem value="QC_PASSED">QC Passed</SelectItem>
                <SelectItem value="QC_FAILED">QC Failed</SelectItem>
                <SelectItem value="RESTOCKED">Restocked</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={fetchReturns}>
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
                <TableHead>Return No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AWB</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <RotateCcw className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No returns found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-mono font-medium">{ret.returnNo}</TableCell>
                    <TableCell>{getTypeBadge(ret.type)}</TableCell>
                    <TableCell>
                      {ret.order ? (
                        <span className="font-mono text-sm">{ret.order.orderNo}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ret.order?.customerName || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(ret.status)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {ret.awbNo || "-"}
                    </TableCell>
                    <TableCell>{ret._count.items}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {ret.reason || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(ret.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchReturnDetails(ret.id)}
                      >
                        <Eye className="h-4 w-4" />
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
            Showing {returns.length} of {total} returns
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

      {/* Create Return Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Return</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Return Type *</Label>
                <Select
                  value={newReturn.type}
                  onValueChange={(value) => setNewReturn({ ...newReturn, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER_RETURN">Customer Return</SelectItem>
                    <SelectItem value="RTO">RTO</SelectItem>
                    <SelectItem value="VENDOR_RETURN">Vendor Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AWB No</Label>
                <Input
                  value={newReturn.awbNo}
                  onChange={(e) => setNewReturn({ ...newReturn, awbNo: e.target.value })}
                  placeholder="Tracking number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Original Order</Label>
              <Select
                value={newReturn.orderId}
                onValueChange={(value) => setNewReturn({ ...newReturn, orderId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select order (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.orderNo} - {order.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={newReturn.reason}
                onChange={(e) => setNewReturn({ ...newReturn, reason: e.target.value })}
                placeholder="Return reason"
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={newReturn.remarks}
                onChange={(e) => setNewReturn({ ...newReturn, remarks: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addReturnItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Item
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-[100px]">Quantity</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newReturnItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.skuId}
                            onValueChange={(value) => updateReturnItem(index, "skuId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select SKU" />
                            </SelectTrigger>
                            <SelectContent>
                              {skus.map((sku) => (
                                <SelectItem key={sku.id} value={sku.id}>
                                  {sku.code} - {sku.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateReturnItem(index, "quantity", parseInt(e.target.value) || 1)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeReturnItem(index)}
                            disabled={newReturnItems.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReturn} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Return"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Process Return Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {selectedReturn?.returnNo}
              <span className="ml-2">
                {selectedReturn && getTypeBadge(selectedReturn.type)}
                {selectedReturn && getStatusBadge(selectedReturn.status)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedReturn && (
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="qc">QC</TabsTrigger>
                <TabsTrigger value="process">Process</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Order</p>
                    <p className="font-mono">{selectedReturn.order?.orderNo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedReturn.order?.customerName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">AWB</p>
                    <p className="font-mono">{selectedReturn.awbNo || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reason</p>
                    <p>{selectedReturn.reason || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Initiated</p>
                    <p>{formatDate(selectedReturn.initiatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Received</p>
                    <p>{formatDate(selectedReturn.receivedAt)}</p>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead>QC Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.sku?.code}</div>
                              <div className="text-xs text-muted-foreground">{item.sku?.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.receivedQty}</TableCell>
                          <TableCell>
                            {item.qcStatus ? (
                              <Badge
                                className={
                                  item.qcStatus === "PASSED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }
                              >
                                {item.qcStatus} {item.qcGrade && `(${item.qcGrade})`}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {item.action || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {selectedReturn.status === "INITIATED" && (
                  <div className="flex justify-end">
                    <Button onClick={handleReceive} disabled={processing}>
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Mark as Received
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="qc" className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>QC Status</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.sku?.code}</div>
                              <div className="text-xs text-muted-foreground">
                                Qty: {item.receivedQty || item.quantity}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={qcItems[index]?.qcStatus || ""}
                              onValueChange={(value) => {
                                const updated = [...qcItems];
                                updated[index] = { ...updated[index], qcStatus: value };
                                setQcItems(updated);
                              }}
                              disabled={selectedReturn.status === "RESTOCKED"}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PASSED">Passed</SelectItem>
                                <SelectItem value="FAILED">Failed</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={qcItems[index]?.qcGrade || ""}
                              onValueChange={(value) => {
                                const updated = [...qcItems];
                                updated[index] = { ...updated[index], qcGrade: value };
                                setQcItems(updated);
                              }}
                              disabled={selectedReturn.status === "RESTOCKED"}
                            >
                              <SelectTrigger className="w-[80px]">
                                <SelectValue placeholder="Grade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="D">D</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={qcItems[index]?.qcRemarks || ""}
                              onChange={(e) => {
                                const updated = [...qcItems];
                                updated[index] = { ...updated[index], qcRemarks: e.target.value };
                                setQcItems(updated);
                              }}
                              placeholder="Remarks"
                              disabled={selectedReturn.status === "RESTOCKED"}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {["RECEIVED", "QC_PENDING"].includes(selectedReturn.status) && (
                  <div className="flex justify-end">
                    <Button onClick={handleQC} disabled={processing}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save QC
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="process" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Restock Bin</Label>
                    <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bin" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAllBins().map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.code} ({bin.zoneName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>QC</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="w-[100px]">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReturn.items.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.sku?.code}</div>
                              <div className="text-xs text-muted-foreground">{item.sku?.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.qcStatus ? (
                              <Badge
                                className={
                                  item.qcStatus === "PASSED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }
                              >
                                {item.qcStatus}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={processItems[index]?.action || "RESTOCK"}
                              onValueChange={(value) => {
                                const updated = [...processItems];
                                updated[index] = { ...updated[index], action: value };
                                setProcessItems(updated);
                              }}
                              disabled={selectedReturn.status === "RESTOCKED"}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="RESTOCK">Restock</SelectItem>
                                <SelectItem value="DISPOSE">Dispose</SelectItem>
                                <SelectItem value="REPAIR">Repair</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={processItems[index]?.quantity || 0}
                              onChange={(e) => {
                                const updated = [...processItems];
                                updated[index] = {
                                  ...updated[index],
                                  quantity: parseInt(e.target.value) || 0,
                                };
                                setProcessItems(updated);
                              }}
                              disabled={selectedReturn.status === "RESTOCKED"}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {["QC_PASSED", "QC_FAILED"].includes(selectedReturn.status) && (
                  <div className="flex justify-end">
                    <Button onClick={handleProcess} disabled={processing}>
                      {processing ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Process Return
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
