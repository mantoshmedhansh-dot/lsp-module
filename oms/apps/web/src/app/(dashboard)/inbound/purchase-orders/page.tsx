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
import {
  Search,
  Plus,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  Trash2,
  Package,
  ShoppingCart,
} from "lucide-react";

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
}

interface POItem {
  id: string;
  skuId: string;
  sku?: SKU;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  taxAmount: number;
  totalPrice: number;
}

interface PurchaseOrder {
  id: string;
  poNo: string;
  vendor: Vendor;
  status: string;
  expectedDate: string | null;
  remarks: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  items?: POItem[];
  _count: {
    items: number;
    inbounds: number;
  };
  createdAt: string;
}

interface NewPOItem {
  skuId: string;
  orderedQty: number;
  unitPrice: number;
  taxRate: number;
}

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [newPO, setNewPO] = useState({
    vendorId: "",
    expectedDate: "",
    remarks: "",
  });
  const [newPOItems, setNewPOItems] = useState<NewPOItem[]>([
    { skuId: "", orderedQty: 1, unitPrice: 0, taxRate: 18 },
  ]);
  const [creating, setCreating] = useState(false);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/purchase-orders?${params}`);
      const data = await response.json();

      setPurchaseOrders(data.purchaseOrders || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setStatusCounts(data.statusCounts || {});
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/v1/vendors?limit=100");
      const data = await response.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchSKUs = async () => {
    try {
      const response = await fetch("/api/v1/skus?limit=500");
      const data = await response.json();
      setSkus(data.skus || []);
    } catch (error) {
      console.error("Error fetching SKUs:", error);
    }
  };

  const fetchPODetails = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/purchase-orders/${id}`);
      const data = await response.json();
      setSelectedPO(data);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Error fetching PO details:", error);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [page, statusFilter]);

  useEffect(() => {
    if (createDialogOpen) {
      fetchVendors();
      fetchSKUs();
    }
  }, [createDialogOpen]);

  const handleSearch = () => {
    setPage(1);
    fetchPurchaseOrders();
  };

  const handleCreatePO = async () => {
    if (!newPO.vendorId) {
      alert("Please select a vendor");
      return;
    }

    const validItems = newPOItems.filter((item) => item.skuId && item.orderedQty > 0);
    if (validItems.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: newPO.vendorId,
          expectedDate: newPO.expectedDate || null,
          remarks: newPO.remarks || null,
          items: validItems,
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setNewPO({ vendorId: "", expectedDate: "", remarks: "" });
        setNewPOItems([{ skuId: "", orderedQty: 1, unitPrice: 0, taxRate: 18 }]);
        fetchPurchaseOrders();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create PO");
      }
    } catch (error) {
      console.error("Error creating PO:", error);
      alert("Failed to create PO");
    } finally {
      setCreating(false);
    }
  };

  const handleApprovePO = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (response.ok) {
        fetchPurchaseOrders();
        if (selectedPO?.id === id) {
          fetchPODetails(id);
        }
      }
    } catch (error) {
      console.error("Error approving PO:", error);
    }
  };

  const handleCancelPO = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this PO?")) return;

    try {
      const response = await fetch(`/api/v1/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (response.ok) {
        fetchPurchaseOrders();
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error("Error cancelling PO:", error);
    }
  };

  const addPOItem = () => {
    setNewPOItems([...newPOItems, { skuId: "", orderedQty: 1, unitPrice: 0, taxRate: 18 }]);
  };

  const removePOItem = (index: number) => {
    if (newPOItems.length > 1) {
      setNewPOItems(newPOItems.filter((_, i) => i !== index));
    }
  };

  const updatePOItem = (index: number, field: keyof NewPOItem, value: string | number) => {
    const updated = [...newPOItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewPOItems(updated);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      APPROVED: "bg-blue-100 text-blue-800",
      PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-800",
      RECEIVED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={`${colors[status] || "bg-gray-100 text-gray-800"} hover:${colors[status]}`}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders from vendors
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create PO
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {statusCounts["DRAFT"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statusCounts["APPROVED"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts["PARTIALLY_RECEIVED"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statusCounts["RECEIVED"] || 0}
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
                  placeholder="Search by PO no or vendor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={fetchPurchaseOrders}>
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
                <TableHead>PO No</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No purchase orders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono font-medium">{po.poNo}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{po.vendor.name}</div>
                        <div className="text-xs text-muted-foreground">{po.vendor.code}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell>{po._count.items}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(po.totalAmount))}
                    </TableCell>
                    <TableCell>{formatDate(po.expectedDate)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(po.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchPODetails(po.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status === "DRAFT" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600"
                              onClick={() => handleApprovePO(po.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => handleCancelPO(po.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
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
            Showing {purchaseOrders.length} of {total} purchase orders
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

      {/* Create PO Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select
                  value={newPO.vendorId}
                  onValueChange={(value) => setNewPO({ ...newPO, vendorId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input
                  type="date"
                  value={newPO.expectedDate}
                  onChange={(e) => setNewPO({ ...newPO, expectedDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={newPO.remarks}
                onChange={(e) => setNewPO({ ...newPO, remarks: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPOItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Item
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[80px]">Tax %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newPOItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.skuId}
                            onValueChange={(value) => updatePOItem(index, "skuId", value)}
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
                            value={item.orderedQty}
                            onChange={(e) =>
                              updatePOItem(index, "orderedQty", parseInt(e.target.value) || 1)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updatePOItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={item.taxRate}
                            onChange={(e) =>
                              updatePOItem(index, "taxRate", parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePOItem(index)}
                            disabled={newPOItems.length === 1}
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
            <Button onClick={handleCreatePO} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create PO"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View PO Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedPO?.poNo}
              <span className="ml-2">{selectedPO && getStatusBadge(selectedPO.status)}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Vendor</p>
                  <p className="font-medium">{selectedPO.vendor.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPO.vendor.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Date</p>
                  <p className="font-medium">{formatDate(selectedPO.expectedDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">{formatCurrency(Number(selectedPO.totalAmount))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Inbounds</p>
                  <p className="font-medium">{selectedPO._count.inbounds}</p>
                </div>
              </div>

              {selectedPO.remarks && (
                <div>
                  <p className="text-muted-foreground text-sm">Remarks</p>
                  <p className="text-sm">{selectedPO.remarks}</p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.sku?.code}</div>
                            <div className="text-xs text-muted-foreground">{item.sku?.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.orderedQty}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.receivedQty >= item.orderedQty ? "text-green-600" : ""}>
                            {item.receivedQty}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.totalPrice))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Created: {formatDate(selectedPO.createdAt)}
                </div>
                <div className="flex gap-2">
                  {selectedPO.status === "DRAFT" && (
                    <>
                      <Button
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleCancelPO(selectedPO.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button onClick={() => handleApprovePO(selectedPO.id)}>
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </>
                  )}
                  {["APPROVED", "PARTIALLY_RECEIVED"].includes(selectedPO.status) && (
                    <Button onClick={() => {
                      setViewDialogOpen(false);
                      window.location.href = `/inbound/receiving?poId=${selectedPO.id}`;
                    }}>
                      <Package className="mr-2 h-4 w-4" />
                      Receive
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
