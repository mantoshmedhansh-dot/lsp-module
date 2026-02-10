"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Download,
  IndianRupee,
  Truck,
  FileText,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Shipment {
  id: string;
  awbNo: string;
  orderId?: string;
  orderNo?: string;
  transporterName?: string;
  transporterCode?: string;
  status: string;
  weight?: number | string;
  chargedWeight?: number | string;
  volumetricWeight?: number | string;
  freightCharges?: number | string;
  codAmount?: number | string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export default function FreightBillingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courierFilter, setCourierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch shipments
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["freight-billing", search, statusFilter, courierFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (courierFilter && courierFilter !== "all") params.append("transporter", courierFilter);

      const res = await fetch(`/api/v1/shipments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch shipments");
      return res.json();
    },
  });

  // Normalize shipments
  const shipments: Shipment[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.shipments || [];
  const total = data?.total || shipments.length;
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1;

  const parseNum = (val: number | string | undefined | null): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "string") return parseFloat(val) || 0;
    return val;
  };

  // Compute freight summary from current data
  const totalFreight = shipments.reduce((sum, s) => sum + parseNum(s.freightCharges), 0);
  const billedShipments = shipments.filter(
    (s) => s.status === "DELIVERED" || s.status === "IN_TRANSIT" || s.status === "SHIPPED"
  );
  const billedAmount = billedShipments.reduce((sum, s) => sum + parseNum(s.freightCharges), 0);
  const pendingShipments = shipments.filter(
    (s) => s.status === "PENDING" || s.status === "PICKED_UP"
  );
  const pendingAmount = pendingShipments.reduce((sum, s) => sum + parseNum(s.freightCharges), 0);
  const disputedShipments = shipments.filter(
    (s) => s.status === "FAILED" || s.status === "RTO_INITIATED"
  );
  const disputedAmount = disputedShipments.reduce((sum, s) => sum + parseNum(s.freightCharges), 0);

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PICKED_UP: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-blue-100 text-blue-800",
    SHIPPED: "bg-blue-100 text-blue-800",
    OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    RTO_INITIATED: "bg-orange-100 text-orange-800",
    RTO_DELIVERED: "bg-red-100 text-red-800",
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Freight Billing</h1>
          <p className="text-muted-foreground">
            Manage courier invoices and freight reconciliation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(totalFreight)}
                </p>
                <p className="text-sm text-muted-foreground">Total Freight</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(billedAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Billed ({billedShipments.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(pendingAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pending ({pendingShipments.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(disputedAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Disputed ({disputedShipments.length})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by AWB or Order ID..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="RTO_INITIATED">RTO</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={courierFilter}
              onValueChange={(v) => {
                setCourierFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                <SelectItem value="delhivery">Delhivery</SelectItem>
                <SelectItem value="bluedart">BlueDart</SelectItem>
                <SelectItem value="dtdc">DTDC</SelectItem>
                <SelectItem value="ekart">Ekart</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Freight Records</CardTitle>
          <CardDescription>
            {total} shipments with freight data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mb-4" />
              <p>No freight records found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AWB Number</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right">Charged Wt (kg)</TableHead>
                    <TableHead className="text-right">Freight Charges</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono font-medium">
                        {shipment.awbNo || "-"}
                      </TableCell>
                      <TableCell>
                        {shipment.transporterName || shipment.transporterCode || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shipment.orderNo || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseNum(shipment.weight) > 0 ? parseNum(shipment.weight).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {parseNum(shipment.chargedWeight) > 0
                          ? parseNum(shipment.chargedWeight).toFixed(2)
                          : parseNum(shipment.volumetricWeight) > 0
                          ? parseNum(shipment.volumetricWeight).toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {parseNum(shipment.freightCharges) > 0
                          ? formatCurrency(parseNum(shipment.freightCharges))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(shipment.shippedAt || shipment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[shipment.status] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {shipment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
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
