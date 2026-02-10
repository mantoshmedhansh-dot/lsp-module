"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Package,
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface Shipment {
  id: string;
  awbNo: string;
  orderId: string;
  orderNo: string;
  transporterName: string;
  transporterCode: string;
  status: string;
  currentLocation: string | null;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  shippedAt: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending Pickup", color: "bg-gray-100 text-gray-800" },
  PICKED_UP: { label: "Picked Up", color: "bg-blue-100 text-blue-800" },
  IN_TRANSIT: { label: "In Transit", color: "bg-yellow-100 text-yellow-800" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "bg-purple-100 text-purple-800" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-800" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800" },
  RTO_INITIATED: { label: "RTO Initiated", color: "bg-orange-100 text-orange-800" },
  RTO_IN_TRANSIT: { label: "RTO In Transit", color: "bg-orange-100 text-orange-800" },
  RTO_DELIVERED: { label: "RTO Delivered", color: "bg-red-100 text-red-800" },
};

export default function TrackingPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipment-tracking", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/v1/shipments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch shipments");
      const result = await res.json();
      return result;
    },
  });

  const shipments: Shipment[] = Array.isArray(data)
    ? data
    : data?.shipments || data?.data || data?.items || [];
  const total = data?.total || shipments.length;
  const totalPages = data?.totalPages || 1;

  // Stats query
  const { data: statsData } = useQuery({
    queryKey: ["shipment-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?limit=1000");
      if (!res.ok) return { active: 0, delivered: 0, ofd: 0, exceptions: 0 };
      const result = await res.json();
      const all: Shipment[] = Array.isArray(result)
        ? result
        : result?.shipments || result?.data || result?.items || [];
      return {
        active: all.filter((s) => !["DELIVERED", "FAILED", "RTO_DELIVERED"].includes(s.status)).length,
        delivered: all.filter((s) => s.status === "DELIVERED").length,
        ofd: all.filter((s) => s.status === "OUT_FOR_DELIVERY").length,
        exceptions: all.filter((s) => ["FAILED", "RTO_INITIATED"].includes(s.status)).length,
      };
    },
  });

  const stats = statsData || { active: 0, delivered: 0, ofd: 0, exceptions: 0 };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shipment Tracking</h1>
        <p className="text-muted-foreground">
          Track shipments across all courier partners
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Track Shipment</CardTitle>
          <CardDescription>
            Enter AWB number or Order ID to track
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter AWB or Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Track</Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.active}</div>
                <p className="text-sm text-muted-foreground">Active Shipments</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                <p className="text-sm text-muted-foreground">Delivered</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.ofd}</div>
                <p className="text-sm text-muted-foreground">Out for Delivery</p>
              </div>
              <Truck className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.exceptions}</div>
                <p className="text-sm text-muted-foreground">Exceptions</p>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shipments</CardTitle>
              <CardDescription>{total} shipments found</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No shipments found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AWB Number</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Shipped</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => {
                    const cfg = statusConfig[shipment.status] || {
                      label: shipment.status,
                      color: "bg-gray-100 text-gray-800",
                    };
                    return (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-mono font-medium">
                          {shipment.awbNo || "-"}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => router.push(`/orders/${shipment.orderId}`)}
                            className="text-primary hover:underline"
                          >
                            {shipment.orderNo || shipment.orderId}
                          </button>
                        </TableCell>
                        <TableCell>{shipment.transporterName || shipment.transporterCode || "-"}</TableCell>
                        <TableCell>
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {shipment.currentLocation || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {shipment.shippedAt ? formatDateTime(shipment.shippedAt) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/logistics/awb?search=${shipment.awbNo}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
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
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
