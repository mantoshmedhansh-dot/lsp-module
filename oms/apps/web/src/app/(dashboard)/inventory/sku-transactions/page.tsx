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
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  Calendar,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  transactionNo: string;
  type: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";
  reference: string | null;
  qtyChange: number;
  runningBalance: number;
  performedBy: string | null;
}

interface TransactionsResponse {
  movements: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const typeColors: Record<string, string> = {
  IN: "bg-green-100 text-green-800",
  OUT: "bg-red-100 text-red-800",
  TRANSFER: "bg-blue-100 text-blue-800",
  ADJUSTMENT: "bg-orange-100 text-orange-800",
};

export default function SKUTransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [skuSearch, setSkuSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (skuSearch) params.append("search", skuSearch);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/inventory/movements?${params}`);
      const data: TransactionsResponse = await response.json();

      setTransactions(data.movements || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter, fromDate, toDate]);

  const handleSearch = () => {
    setPage(1);
    fetchTransactions();
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
    const colorClass = typeColors[type] || "bg-gray-100 text-gray-800";
    return (
      <Badge className={`${colorClass} hover:${colorClass}`}>
        {getTypeIcon(type)}
        <span className="ml-1">{type}</span>
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

  const formatQtyChange = (qty: number) => {
    if (qty > 0) {
      return <span className="text-green-600 font-medium">+{qty}</span>;
    }
    if (qty < 0) {
      return <span className="text-red-600 font-medium">{qty}</span>;
    }
    return <span className="text-muted-foreground">0</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SKU Transaction History</h1>
          <p className="text-muted-foreground">
            View complete transaction history for individual SKUs
          </p>
        </div>
        <Button onClick={fetchTransactions} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
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
              {transactions.filter((t) => t.type === "IN").length}
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
              {transactions.filter((t) => t.type === "OUT").length}
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
              {transactions.filter((t) => t.type === "TRANSFER").length}
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
                  placeholder="Search by SKU code or transaction no..."
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="IN">Inbound</SelectItem>
                <SelectItem value="OUT">Outbound</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
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

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Qty Change</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No transactions found</p>
                      <p className="text-sm text-muted-foreground">
                        Search for a SKU to view its transaction history
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(txn.date)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {txn.transactionNo}
                    </TableCell>
                    <TableCell>{getTypeBadge(txn.type)}</TableCell>
                    <TableCell>
                      {txn.reference ? (
                        <span className="text-sm">{txn.reference}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQtyChange(txn.qtyChange)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {txn.runningBalance}
                    </TableCell>
                    <TableCell>
                      {txn.performedBy ? (
                        <span className="text-sm">{txn.performedBy}</span>
                      ) : (
                        <span className="text-muted-foreground">System</span>
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
            Showing {transactions.length} of {total} transactions
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
