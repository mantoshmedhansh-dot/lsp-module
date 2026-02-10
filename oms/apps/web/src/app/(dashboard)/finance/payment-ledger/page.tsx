"use client";

import { useState, useMemo } from "react";
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
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Transaction {
  id: string;
  transactionId?: string;
  transactionNo?: string;
  date?: string;
  transactionDate?: string;
  type: string;
  transactionType?: string;
  description?: string;
  reference?: string;
  referenceNo?: string;
  credit?: number | string;
  debit?: number | string;
  amount?: number | string;
  balance?: number | string;
  status?: string;
  createdAt?: string;
}

export default function PaymentLedgerPage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Fetch transactions from COD transactions endpoint
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payment-ledger", typeFilter, search, dateFrom, dateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);
      if (search) params.append("search", search);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const res = await fetch(`/api/v1/finance/cod-transactions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  // Normalize response
  const transactions: Transaction[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.transactions || [];
  const total = data?.total || transactions.length;
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1;

  const parseNum = (val: number | string | undefined | null): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "string") return parseFloat(val) || 0;
    return val;
  };

  // Compute running balance and summary
  const processedTransactions = useMemo(() => {
    let runningBalance = 0;
    return transactions.map((txn) => {
      const creditVal = parseNum(txn.credit);
      const debitVal = parseNum(txn.debit);
      const amountVal = parseNum(txn.amount);

      // If credit/debit fields exist, use them; otherwise infer from amount + type
      let credit = creditVal;
      let debit = debitVal;
      if (credit === 0 && debit === 0 && amountVal !== 0) {
        const txnType = (txn.type || txn.transactionType || "").toUpperCase();
        if (
          txnType.includes("REMITTANCE") ||
          txnType.includes("CREDIT") ||
          txnType.includes("REFUND") ||
          txnType.includes("ADJUSTMENT")
        ) {
          credit = Math.abs(amountVal);
        } else {
          debit = Math.abs(amountVal);
        }
      }

      runningBalance = runningBalance + credit - debit;

      return {
        ...txn,
        computedCredit: credit,
        computedDebit: debit,
        computedBalance: runningBalance,
        displayDate: txn.date || txn.transactionDate || txn.createdAt || "",
        displayType: txn.type || txn.transactionType || "UNKNOWN",
        displayRef: txn.reference || txn.referenceNo || txn.transactionId || txn.transactionNo || "-",
        displayStatus: txn.status || "COMPLETED",
      };
    });
  }, [transactions]);

  // Summary values
  const totalCredits = processedTransactions.reduce((sum, t) => sum + t.computedCredit, 0);
  const totalDebits = processedTransactions.reduce((sum, t) => sum + t.computedDebit, 0);
  const currentBalance =
    processedTransactions.length > 0
      ? processedTransactions[processedTransactions.length - 1].computedBalance
      : 0;

  const typeColors: Record<string, string> = {
    COD_REMITTANCE: "bg-green-100 text-green-800",
    COD: "bg-green-100 text-green-800",
    PREPAID: "bg-blue-100 text-blue-800",
    CREDIT: "bg-purple-100 text-purple-800",
    FREIGHT_DEDUCTION: "bg-red-100 text-red-800",
    DEDUCTION: "bg-red-100 text-red-800",
    WEIGHT_ADJUSTMENT: "bg-orange-100 text-orange-800",
    ADJUSTMENT: "bg-orange-100 text-orange-800",
    REFUND: "bg-yellow-100 text-yellow-800",
  };

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
    PROCESSING: "bg-blue-100 text-blue-800",
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Ledger</h1>
          <p className="text-muted-foreground">
            Track all financial transactions and balances
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Statement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "..." : formatCurrency(currentBalance)}
                </p>
                <p className="text-sm text-muted-foreground">Current Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {isLoading ? "..." : formatCurrency(totalCredits)}
                </p>
                <p className="text-sm text-muted-foreground">Total Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {isLoading ? "..." : formatCurrency(totalDebits)}
                </p>
                <p className="text-sm text-muted-foreground">Total Debits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">
                {isLoading ? "..." : total}
              </p>
              <p className="text-sm text-muted-foreground">Transactions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by transaction ID or reference..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="COD_REMITTANCE">COD Remittance</SelectItem>
                <SelectItem value="COD">COD</SelectItem>
                <SelectItem value="PREPAID">Prepaid</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
                <SelectItem value="FREIGHT_DEDUCTION">Freight Deduction</SelectItem>
                <SelectItem value="WEIGHT_ADJUSTMENT">Weight Adjustment</SelectItem>
                <SelectItem value="REFUND">Refund</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                className="w-[160px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                className="w-[160px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {total} transactions for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : processedTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mb-4" />
              <p>No transactions found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(txn.displayDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            typeColors[txn.displayType] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {txn.displayType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {txn.description || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {txn.displayRef}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[txn.displayStatus] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {txn.displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.computedCredit > 0 && (
                          <span className="text-green-600 flex items-center justify-end gap-1">
                            <ArrowDownLeft className="h-3 w-3" />
                            {formatCurrency(txn.computedCredit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.computedDebit > 0 && (
                          <span className="text-red-600 flex items-center justify-end gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {formatCurrency(txn.computedDebit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(txn.computedBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Running Balance Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex gap-6 text-sm">
                  <span>
                    Total Credits:{" "}
                    <strong className="text-green-600">
                      {formatCurrency(totalCredits)}
                    </strong>
                  </span>
                  <span>
                    Total Debits:{" "}
                    <strong className="text-red-600">
                      {formatCurrency(totalDebits)}
                    </strong>
                  </span>
                  <span>
                    Net:{" "}
                    <strong
                      className={
                        currentBalance >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {formatCurrency(currentBalance)}
                    </strong>
                  </span>
                </div>
              </div>

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
