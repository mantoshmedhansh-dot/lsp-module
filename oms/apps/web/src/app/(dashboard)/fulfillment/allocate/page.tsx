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
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckSquare,
  XSquare,
  ShoppingCart,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  items: number;
  totalQty: number;
  allocatedQty: number;
  pendingQty: number;
  status: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  PARTIALLY_ALLOCATED: { label: "Partial", color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  ALLOCATED: { label: "Allocated", color: "bg-green-100 text-green-800 hover:bg-green-100" },
};

export default function OrderAllocatePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      params.append("status", statusFilter !== "all" ? statusFilter : "CONFIRMED");
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/orders?${params}`);
      const data: OrdersResponse = await response.json();

      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map((o) => o.id));
    }
  };

  const handleAllocate = async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      toast.error("Please select at least one order");
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch("/api/v1/allocation/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || `Allocated ${orderIds.length} order(s) successfully`);
        setSelectedOrders([]);
        fetchOrders();
      } else {
        toast.error(result.detail || "Failed to allocate orders");
      }
    } catch (error) {
      console.error("Error allocating orders:", error);
      toast.error("Failed to allocate orders");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnallocate = async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      toast.error("Please select at least one order");
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch("/api/v1/allocation/unallocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || `Unallocated ${orderIds.length} order(s) successfully`);
        setSelectedOrders([]);
        fetchOrders();
      } else {
        toast.error(result.detail || "Failed to unallocate orders");
      }
    } catch (error) {
      console.error("Error unallocating orders:", error);
      toast.error("Failed to unallocate orders");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Allocate / Unallocate</h1>
          <p className="text-muted-foreground">
            Allocate and unallocate inventory for orders
          </p>
        </div>
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
            <CheckSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{selectedOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Allocation</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {orders.filter((o) => o.pendingQty > 0).length}
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
                  placeholder="Search by order no or customer..."
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
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="PARTIALLY_ALLOCATED">Partially Allocated</SelectItem>
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedOrders.length} order(s) selected
              </span>
              <Button
                size="sm"
                onClick={() => handleAllocate(selectedOrders)}
                disabled={actionLoading}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Allocate Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUnallocate(selectedOrders)}
                disabled={actionLoading}
              >
                <XSquare className="mr-2 h-4 w-4" />
                Unallocate Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedOrders([])}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedOrders.length === orders.length}
                    onChange={toggleAllOrders}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Order No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">Allocated Qty</TableHead>
                <TableHead className="text-right">Pending Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No orders found for allocation</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.orderNo}
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-right">{order.items}</TableCell>
                    <TableCell className="text-right font-medium">{order.totalQty}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-medium">{order.allocatedQty}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={order.pendingQty > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                        {order.pendingQty}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {order.pendingQty > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAllocate([order.id])}
                            disabled={actionLoading}
                          >
                            <CheckSquare className="mr-1 h-3 w-3" />
                            Allocate
                          </Button>
                        )}
                        {order.allocatedQty > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnallocate([order.id])}
                            disabled={actionLoading}
                          >
                            <XSquare className="mr-1 h-3 w-3" />
                            Unallocate
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
            Showing {orders.length} of {total} orders
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
    </div>
  );
}
