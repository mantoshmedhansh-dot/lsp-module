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
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Package,
  History,
} from "lucide-react";

interface Movement {
  id: string;
  movementNo: string;
  type: "IN" | "OUT" | "TRANSFER";
  skuId: string;
  quantity: number;
  fromBinId: string | null;
  toBinId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  performedBy: string;
  performedAt: string;
  sku: {
    id: string;
    code: string;
    name: string;
  } | null;
  fromBin: {
    id: string;
    code: string;
    zone: { code: string; name: string };
  } | null;
  toBin: {
    id: string;
    code: string;
    zone: { code: string; name: string };
  } | null;
  performedByUser: {
    id: string;
    name: string;
  } | null;
}

interface MovementsResponse {
  movements: Movement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  typeCounts: Record<string, number>;
}

export default function MovementHistoryPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [referenceTypeFilter, setReferenceTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      if (referenceTypeFilter && referenceTypeFilter !== "all")
        params.append("referenceType", referenceTypeFilter);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/inventory/movements?${params}`);
      const data: MovementsResponse = await response.json();

      setMovements(data.movements || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setTypeCounts(data.typeCounts || {});
    } catch (error) {
      console.error("Error fetching movements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [page, typeFilter, referenceTypeFilter, fromDate, toDate]);

  const handleSearch = () => {
    setPage(1);
    fetchMovements();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "OUT":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case "TRANSFER":
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "IN":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            {getTypeIcon(type)}
            <span className="ml-1">IN</span>
          </Badge>
        );
      case "OUT":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            {getTypeIcon(type)}
            <span className="ml-1">OUT</span>
          </Badge>
        );
      case "TRANSFER":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            {getTypeIcon(type)}
            <span className="ml-1">Transfer</span>
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getReferenceTypeBadge = (refType: string | null) => {
    if (!refType) return <span className="text-muted-foreground">-</span>;

    const colors: Record<string, string> = {
      ORDER: "bg-purple-100 text-purple-800",
      INBOUND: "bg-cyan-100 text-cyan-800",
      ADJUSTMENT: "bg-orange-100 text-orange-800",
      TRANSFER: "bg-blue-100 text-blue-800",
    };

    return (
      <Badge className={`${colors[refType] || "bg-gray-100 text-gray-800"} hover:${colors[refType] || "bg-gray-100"}`}>
        {refType}
      </Badge>
    );
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

  const formatBinLocation = (bin: Movement["fromBin"] | Movement["toBin"]) => {
    if (!bin) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="text-sm">
        <div className="font-medium">{bin.code}</div>
        <div className="text-muted-foreground text-xs">{bin.zone.code}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movement History</h1>
          <p className="text-muted-foreground">
            Track all inventory movements across your warehouse
          </p>
        </div>
        <Button onClick={fetchMovements} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {typeCounts["IN"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outbound</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {typeCounts["OUT"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfers</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {typeCounts["TRANSFER"] || 0}
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
                  placeholder="Search by movement no or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Movement Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="IN">Inbound</SelectItem>
                <SelectItem value="OUT">Outbound</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={referenceTypeFilter} onValueChange={(value) => { setReferenceTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Reference Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All References</SelectItem>
                <SelectItem value="ORDER">Order</SelectItem>
                <SelectItem value="INBOUND">Inbound</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="w-[150px]"
                placeholder="From Date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="w-[150px]"
                placeholder="To Date"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Movement #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Date/Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No movements found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-mono text-sm">
                      {movement.movementNo}
                    </TableCell>
                    <TableCell>{getTypeBadge(movement.type)}</TableCell>
                    <TableCell>
                      {movement.sku ? (
                        <div>
                          <div className="font-medium">{movement.sku.code}</div>
                          <div className="text-muted-foreground text-xs truncate max-w-[150px]">
                            {movement.sku.name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={
                          movement.type === "IN"
                            ? "text-green-600"
                            : movement.type === "OUT"
                            ? "text-red-600"
                            : ""
                        }
                      >
                        {movement.type === "IN" ? "+" : movement.type === "OUT" ? "-" : ""}
                        {movement.quantity}
                      </span>
                    </TableCell>
                    <TableCell>{formatBinLocation(movement.fromBin)}</TableCell>
                    <TableCell>{formatBinLocation(movement.toBin)}</TableCell>
                    <TableCell>
                      {getReferenceTypeBadge(movement.referenceType)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {movement.reason || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {movement.performedByUser ? (
                        <span className="text-sm">{movement.performedByUser.name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(movement.performedAt)}
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
            Showing {movements.length} of {total} movements
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
