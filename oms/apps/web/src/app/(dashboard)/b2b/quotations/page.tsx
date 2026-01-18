"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Plus,
  Search,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Quotation {
  id: string;
  quotationNo: string;
  status: string;
  validUntil: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  convertedAt: string | null;
  customer: {
    id: string;
    name: string;
    code: string;
    email: string | null;
  };
  createdBy: {
    id: string;
    name: string;
  };
  approvedBy: {
    id: string;
    name: string;
  } | null;
  convertedOrder: {
    id: string;
    orderNo: string;
  } | null;
  _count: {
    items: number;
  };
}

interface QuotationsResponse {
  quotations: Quotation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  DRAFT: { label: "Draft", variant: "outline", icon: FileText },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "secondary", icon: Clock },
  APPROVED: { label: "Approved", variant: "default", icon: CheckCircle },
  REJECTED: { label: "Rejected", variant: "destructive", icon: XCircle },
  EXPIRED: { label: "Expired", variant: "outline", icon: AlertCircle },
  CONVERTED: { label: "Converted", variant: "default", icon: ArrowRight },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "CONVERTED", label: "Converted" },
  { value: "EXPIRED", label: "Expired" },
];

export default function QuotationsPage() {
  const router = useRouter();
  const [data, setData] = useState<QuotationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  const fetchQuotations = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/quotations?${params}`);
      if (!response.ok) throw new Error("Failed to fetch quotations");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      toast.error("Failed to load quotations");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchQuotations();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchQuotations]);

  async function handleAction(quotationId: string, action: string) {
    try {
      const response = await fetch(`/api/v1/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Quotation ${action}ed successfully`);
        fetchQuotations();

        if (action === "convert" && result.order) {
          router.push(`/orders/${result.order.id}`);
        }
      } else {
        toast.error(result.error || `Failed to ${action} quotation`);
      }
    } catch (error) {
      console.error(`Error ${action}ing quotation:`, error);
      toast.error(`Failed to ${action} quotation`);
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
    setPage(1);
  }

  const hasFilters = search || activeTab !== "all";

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  function isExpired(validUntil: string) {
    return new Date(validUntil) < new Date();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">
            Manage B2B quotations and convert to orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchQuotations}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/b2b/quotations/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Quotation
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              All quotations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data?.statusCounts?.PENDING_APPROVAL || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data?.statusCounts?.APPROVED || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready to convert
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <ArrowRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data?.statusCounts?.CONVERTED || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Converted to orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.label}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {getTabCount(tab.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by quotation no or customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quotations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quotation List</CardTitle>
          <CardDescription>
            {data?.total || 0} quotations found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.quotations?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters
                  ? "No quotations match your filters"
                  : "No quotations found"}
              </p>
              <Button
                variant="link"
                onClick={() => router.push("/b2b/quotations/new")}
              >
                Create your first quotation
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quotations.map((quotation) => {
                    const statusInfo = statusConfig[quotation.status] || {
                      label: quotation.status,
                      variant: "outline" as const,
                      icon: FileText,
                    };
                    const expired =
                      quotation.status !== "CONVERTED" &&
                      quotation.status !== "REJECTED" &&
                      isExpired(quotation.validUntil);

                    return (
                      <TableRow key={quotation.id}>
                        <TableCell>
                          <div>
                            <button
                              onClick={() =>
                                router.push(`/b2b/quotations/${quotation.id}`)
                              }
                              className="font-medium text-primary hover:underline"
                            >
                              {quotation.quotationNo}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(quotation.createdAt), "dd MMM yyyy")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <button
                              onClick={() =>
                                router.push(`/b2b/customers/${quotation.customer.id}`)
                              }
                              className="font-medium hover:underline"
                            >
                              {quotation.customer.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {quotation.customer.code}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {quotation._count.items} items
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-medium">
                              {Number(quotation.totalAmount).toLocaleString("en-IN", {
                                style: "currency",
                                currency: "INR",
                              })}
                            </p>
                            {quotation.discountAmount > 0 && (
                              <p className="text-xs text-green-600">
                                -{Number(quotation.discountAmount).toLocaleString()} discount
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                            </p>
                            {expired && (
                              <Badge variant="destructive" className="text-xs">
                                Expired
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                          {quotation.convertedOrder && (
                            <button
                              onClick={() =>
                                router.push(`/orders/${quotation.convertedOrder!.id}`)
                              }
                              className="block text-xs text-primary hover:underline mt-1"
                            >
                              {quotation.convertedOrder.orderNo}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{quotation.createdBy.name}</div>
                          {quotation.approvedBy && (
                            <p className="text-xs text-muted-foreground">
                              Approved by: {quotation.approvedBy.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/b2b/quotations/${quotation.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>

                              {quotation.status === "DRAFT" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(
                                        `/b2b/quotations/${quotation.id}/edit`
                                      )
                                    }
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleAction(quotation.id, "submit")}
                                  >
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit for Approval
                                  </DropdownMenuItem>
                                </>
                              )}

                              {quotation.status === "PENDING_APPROVAL" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleAction(quotation.id, "approve")}
                                    className="text-green-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleAction(quotation.id, "reject")}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}

                              {quotation.status === "APPROVED" && !expired && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(quotation.id, "convert")}
                                  className="text-blue-600"
                                >
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Convert to Order
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
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
                      onClick={() =>
                        setPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={page === data.totalPages}
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
