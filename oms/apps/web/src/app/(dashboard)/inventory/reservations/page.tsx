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
  Lock,
  Unlock,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

interface Allocation {
  id: string;
  orderNo: string;
  orderId: string;
  skuCode: string;
  skuName: string;
  allocatedQty: number;
  binCode: string;
  status: string;
  allocatedAt: string;
}

interface AllocationsResponse {
  allocations: Allocation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ALLOCATED: { label: "Allocated", color: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  PICKED: { label: "Picked", color: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  RELEASED: { label: "Released", color: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

export default function InventoryReservationsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAllocations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/allocation?${params}`);
      const data: AllocationsResponse = await response.json();

      setAllocations(data.allocations || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching allocations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocations();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchAllocations();
  };

  const handleRelease = async (allocationId: string) => {
    try {
      const response = await fetch(`/api/v1/allocation/${allocationId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast.success("Allocation released successfully");
        fetchAllocations();
      } else {
        const result = await response.json();
        toast.error(result.detail || "Failed to release allocation");
      }
    } catch (error) {
      console.error("Error releasing allocation:", error);
      toast.error("Failed to release allocation");
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Reservations</h1>
          <p className="text-muted-foreground">
            View and manage inventory allocated to orders
          </p>
        </div>
        <Button onClick={fetchAllocations} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reservations</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {allocations.filter((a) => a.status === "ALLOCATED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picked</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {allocations.filter((a) => a.status === "PICKED").length}
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
                  placeholder="Search by order no or SKU..."
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
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
                <SelectItem value="PICKED">Picked</SelectItem>
                <SelectItem value="RELEASED">Released</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Allocation ID</TableHead>
                <TableHead>Order No</TableHead>
                <TableHead>SKU Code</TableHead>
                <TableHead>SKU Name</TableHead>
                <TableHead className="text-right">Allocated Qty</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Allocated At</TableHead>
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
              ) : allocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No allocations found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell className="font-mono text-sm">
                      {allocation.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">
                      {allocation.orderNo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {allocation.skuCode}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                        {allocation.skuName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {allocation.allocatedQty}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{allocation.binCode}</Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(allocation.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(allocation.allocatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {allocation.status === "ALLOCATED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRelease(allocation.id)}
                        >
                          <Unlock className="mr-1 h-3 w-3" />
                          Release
                        </Button>
                      )}
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
            Showing {allocations.length} of {total} allocations
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
