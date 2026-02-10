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
  Scale,
  AlertTriangle,
  CheckCircle,
  IndianRupee,
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
  declaredWeight?: number | string;
  actualWeight?: number | string;
  freightCharges?: number | string;
  shippedAt?: string;
  createdAt: string;
}

interface DiscrepancyRecord {
  id: string;
  awbNo: string;
  orderNo: string;
  courier: string;
  declaredWeight: number;
  chargedWeight: number;
  discrepancy: number;
  amountImpact: number;
  status: string;
  date: string;
}

export default function WeightDiscrepancyPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courierFilter, setCourierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch shipments
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["weight-discrepancy", search, statusFilter, courierFilter, page],
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

  // Normalize
  const rawShipments: Shipment[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.shipments || [];
  const total = data?.total || rawShipments.length;
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1;

  const parseNum = (val: number | string | undefined | null): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "string") return parseFloat(val) || 0;
    return val;
  };

  // Filter shipments where weight discrepancy exists
  const discrepancies: DiscrepancyRecord[] = rawShipments
    .map((s) => {
      const declared = parseNum(s.declaredWeight) || parseNum(s.weight);
      const charged = parseNum(s.chargedWeight) || parseNum(s.volumetricWeight) || parseNum(s.actualWeight);
      const diff = charged - declared;
      // Estimate amount impact: ~Rs 50 per 0.5 kg slab difference
      const slabs = Math.ceil(diff / 0.5);
      const impact = slabs > 0 ? slabs * 50 : 0;

      return {
        id: s.id,
        awbNo: s.awbNo || "-",
        orderNo: s.orderNo || s.orderId || "-",
        courier: s.transporterName || s.transporterCode || "-",
        declaredWeight: declared,
        chargedWeight: charged,
        discrepancy: diff,
        amountImpact: parseNum(s.freightCharges) > 0 && diff > 0
          ? diff * (parseNum(s.freightCharges) / (charged || 1))
          : impact,
        status: diff > 0.1 ? "PENDING" : diff <= 0 ? "NO_DISCREPANCY" : "MINOR",
        date: s.shippedAt || s.createdAt,
      };
    })
    .filter((d) => d.discrepancy > 0.05); // Only show actual discrepancies

  // Summary computations
  const totalDiscrepancies = discrepancies.length;
  const totalImpact = discrepancies.reduce((sum, d) => sum + d.amountImpact, 0);
  const resolvedCount = discrepancies.filter((d) => d.status === "RESOLVED").length;
  const pendingCount = discrepancies.filter((d) => d.status === "PENDING" || d.status === "MINOR").length;

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    DISPUTED: "bg-red-100 text-red-800",
    RESOLVED: "bg-green-100 text-green-800",
    ACCEPTED: "bg-blue-100 text-blue-800",
    MINOR: "bg-gray-100 text-gray-800",
    NO_DISCREPANCY: "bg-green-100 text-green-800",
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weight Discrepancy</h1>
          <p className="text-muted-foreground">
            Manage courier weight disputes and volumetric billing issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : totalDiscrepancies}
                </p>
                <p className="text-sm text-muted-foreground">Total Discrepancies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(totalImpact)}
                </p>
                <p className="text-sm text-muted-foreground">Amount Impact</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : resolvedCount}
                </p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : pendingCount}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="DISPUTED">Disputed</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={courierFilter}
              onValueChange={(v) => {
                setCourierFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
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
          <CardTitle>Weight Disputes</CardTitle>
          <CardDescription>
            {discrepancies.length} discrepancies found from {total} shipments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : discrepancies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Scale className="h-12 w-12 mb-4" />
              <p>No weight discrepancies found</p>
              <p className="text-sm mt-1">All shipments are within acceptable weight range</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AWB / Order</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Declared (kg)</TableHead>
                    <TableHead className="text-right">Charged (kg)</TableHead>
                    <TableHead className="text-right">Discrepancy (kg)</TableHead>
                    <TableHead className="text-right">Amount Impact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{dispute.awbNo}</p>
                          <p className="text-sm text-muted-foreground">{dispute.orderNo}</p>
                        </div>
                      </TableCell>
                      <TableCell>{dispute.courier}</TableCell>
                      <TableCell className="text-right">
                        {dispute.declaredWeight.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {dispute.chargedWeight.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        +{dispute.discrepancy.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(dispute.amountImpact)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[dispute.status] || "bg-gray-100 text-gray-800"}
                        >
                          {dispute.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(dispute.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm">
                            Dispute
                          </Button>
                          <Button variant="ghost" size="sm">
                            Accept
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} shipments checked)
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
