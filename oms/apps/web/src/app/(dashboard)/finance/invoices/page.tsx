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
  FileText,
  Eye,
  RefreshCw,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface InvoiceOrder {
  id: string;
  orderNo: string;
  customerName?: string;
  customer?: { name: string; email?: string };
  totalAmount: number | string;
  subtotal?: number | string;
  taxAmount?: number | string;
  status: string;
  invoiceNo?: string;
  invoiceDate?: string;
  createdAt: string;
  paymentMode?: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch orders (filter to invoiced ones)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["finance-invoices", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      } else {
        params.append("status", "INVOICED");
      }
      const res = await fetch(`/api/v1/orders?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
  });

  // Normalize response
  const orders: InvoiceOrder[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.orders || [];
  const total = data?.total || orders.length;
  const totalPages = data?.totalPages || Math.ceil(total / limit) || 1;

  // Compute summary stats from current data
  const totalInvoices = total;
  const totalValue = orders.reduce(
    (sum, o) => sum + (typeof o.totalAmount === "string" ? parseFloat(o.totalAmount) || 0 : o.totalAmount || 0),
    0
  );
  const totalTax = orders.reduce(
    (sum, o) => sum + (typeof o.taxAmount === "string" ? parseFloat(o.taxAmount) || 0 : (o.taxAmount as number) || 0),
    0
  );

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    INVOICED: "bg-blue-100 text-blue-800",
    GENERATED: "bg-blue-100 text-blue-800",
    SENT: "bg-green-100 text-green-800",
    PAID: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    DELIVERED: "bg-green-100 text-green-800",
    SHIPPED: "bg-purple-100 text-purple-800",
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  const getCustomerName = (order: InvoiceOrder): string => {
    return order.customerName || order.customer?.name || "-";
  };

  const parseAmount = (val: number | string | undefined | null): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "string") return parseFloat(val) || 0;
    return val;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Management</h1>
          <p className="text-muted-foreground">
            Generate and manage GST compliant invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Bulk Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "..." : totalInvoices}</p>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(totalValue)}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(totalTax)}</p>
                <p className="text-sm text-muted-foreground">GST Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{isLoading ? "..." : orders.length}</p>
                <p className="text-sm text-muted-foreground">This Page</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice # or Order ID..."
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
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="INVOICED">Invoiced</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
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
          <CardTitle>Invoices</CardTitle>
          <CardDescription>{total} invoices found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No invoices found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice / Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">
                            {order.invoiceNo || order.orderNo}
                          </p>
                          {order.invoiceNo && (
                            <p className="text-sm text-muted-foreground">{order.orderNo}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getCustomerName(order)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.invoiceDate || order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(parseAmount(order.subtotal))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(parseAmount(order.taxAmount))}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(parseAmount(order.totalAmount))}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => router.push(`/finance/invoices/${order.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toast.info("Invoice PDF download coming soon")}>
                            <Download className="h-4 w-4" />
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
