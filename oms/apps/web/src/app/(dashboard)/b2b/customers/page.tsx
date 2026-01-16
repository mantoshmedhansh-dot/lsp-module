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
  Building2,
  Users,
  CreditCard,
  Phone,
  Mail,
  RefreshCw,
  CheckCircle,
  XCircle,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  status: string;
  gst: string | null;
  pan: string | null;
  creditLimit: number;
  creditUsed: number;
  creditStatus: string;
  paymentTermType: string;
  createdAt: string;
  _count: {
    orders: number;
    quotations: number;
    creditTransactions: number;
  };
  customerGroup: {
    id: string;
    name: string;
  } | null;
  priceList: {
    id: string;
    name: string;
  } | null;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const customerTypeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  RETAIL: { label: "Retail", icon: Users },
  WHOLESALE: { label: "Wholesale", icon: Building2 },
  DISTRIBUTOR: { label: "Distributor", icon: Building2 },
  DEALER: { label: "Dealer", icon: Building2 },
  CORPORATE: { label: "Corporate", icon: Building2 },
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  INACTIVE: { label: "Inactive", variant: "secondary" },
  SUSPENDED: { label: "Suspended", variant: "outline" },
  BLOCKED: { label: "Blocked", variant: "destructive" },
};

const creditStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  AVAILABLE: { label: "Available", variant: "default", icon: CheckCircle },
  EXCEEDED: { label: "Exceeded", variant: "destructive", icon: AlertCircle },
  BLOCKED: { label: "Blocked", variant: "destructive", icon: XCircle },
  ON_HOLD: { label: "On Hold", variant: "outline", icon: AlertCircle },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "BLOCKED", label: "Blocked" },
];

export default function CustomersPage() {
  const router = useRouter();
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Create customer form
  const [newCustomer, setNewCustomer] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
    type: "RETAIL",
    gst: "",
    pan: "",
    creditLimit: 0,
    paymentTermType: "IMMEDIATE",
    billingAddress: {},
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/customers?${params}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, typeFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchCustomers]);

  async function handleCreateCustomer() {
    if (!newCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    try {
      const response = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomer),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Customer created successfully");
        setIsCreateDialogOpen(false);
        setNewCustomer({
          code: "",
          name: "",
          email: "",
          phone: "",
          type: "RETAIL",
          gst: "",
          pan: "",
          creditLimit: 0,
          paymentTermType: "IMMEDIATE",
          billingAddress: {},
        });
        fetchCustomers();
      } else {
        toast.error(result.error || "Failed to create customer");
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Failed to create customer");
    }
  }

  async function handleStatusChange(customerId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/v1/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Customer status updated to ${newStatus}`);
        fetchCustomers();
      } else {
        toast.error("Failed to update customer status");
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer status");
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
    setTypeFilter("");
    setPage(1);
  }

  const hasFilters = search || activeTab !== "all" || typeFilter;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  function getCreditUtilization(customer: Customer) {
    if (customer.creditLimit === 0) return 0;
    return Math.round((customer.creditUsed / customer.creditLimit) * 100);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B2B Customers</h1>
          <p className="text-muted-foreground">
            Manage business customers, credit limits, and pricing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCustomers}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Create a new B2B customer account
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="code">Customer Code *</Label>
                    <Input
                      id="code"
                      placeholder="CUST-001"
                      value={newCustomer.code}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, code: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter company name"
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Customer Type</Label>
                    <Select
                      value={newCustomer.type}
                      onValueChange={(value) =>
                        setNewCustomer((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(customerTypeConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      placeholder="+91 98765 43210"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="company@example.com"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gst">GST Number</Label>
                    <Input
                      id="gst"
                      placeholder="22AAAAA0000A1Z5"
                      value={newCustomer.gst}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, gst: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pan">PAN Number</Label>
                    <Input
                      id="pan"
                      placeholder="AAAAA0000A"
                      value={newCustomer.pan}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, pan: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="creditLimit">Credit Limit (INR)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      placeholder="100000"
                      value={newCustomer.creditLimit}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({
                          ...prev,
                          creditLimit: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentTermType">Payment Terms</Label>
                  <Select
                    value={newCustomer.paymentTermType}
                    onValueChange={(value) =>
                      setNewCustomer((prev) => ({ ...prev, paymentTermType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                      <SelectItem value="NET_7">Net 7</SelectItem>
                      <SelectItem value="NET_15">Net 15</SelectItem>
                      <SelectItem value="NET_30">Net 30</SelectItem>
                      <SelectItem value="NET_45">Net 45</SelectItem>
                      <SelectItem value="NET_60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCustomer}>Create Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active B2B accounts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data?.statusCounts?.ACTIVE || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Exceeded</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {data?.customers?.filter((c) => c.creditStatus === "EXCEEDED").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Over credit limit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data?.statusCounts?.BLOCKED || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Blocked accounts
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
                placeholder="Search by name, email, phone, or GST..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(customerTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            {data?.total || 0} customers found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.customers?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters
                  ? "No customers match your filters"
                  : "No customers found"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Add your first B2B customer to get started
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((customer) => {
                    const typeInfo = customerTypeConfig[customer.type] || {
                      label: customer.type,
                      icon: Users,
                    };
                    const statusInfo = statusConfig[customer.status] || {
                      label: customer.status,
                      variant: "outline" as const,
                    };
                    const creditInfo = creditStatusConfig[customer.creditStatus] || {
                      label: customer.creditStatus,
                      variant: "outline" as const,
                      icon: CreditCard,
                    };
                    const creditUtil = getCreditUtilization(customer);

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <button
                              onClick={() =>
                                router.push(`/b2b/customers/${customer.id}`)
                              }
                              className="font-medium text-primary hover:underline"
                            >
                              {customer.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {customer.code}
                            </p>
                            {customer.gst && (
                              <p className="text-xs text-muted-foreground">
                                GST: {customer.gst}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <typeInfo.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{typeInfo.label}</span>
                          </div>
                          {customer.customerGroup && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {customer.customerGroup.name}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-1 text-xs">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-xs">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {creditUtil}%
                              </span>
                              <Badge variant={creditInfo.variant} className="text-xs">
                                <creditInfo.icon className="mr-1 h-3 w-3" />
                                {creditInfo.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {Number(customer.creditUsed).toLocaleString()} /{" "}
                              {Number(customer.creditLimit).toLocaleString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {customer._count.orders} orders
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {customer._count.quotations} quotations
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(customer.createdAt), "dd MMM yyyy")}
                          </div>
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
                                  router.push(`/b2b/customers/${customer.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/b2b/customers/${customer.id}/edit`)
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/b2b/quotations/new?customerId=${customer.id}`
                                  )
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create Quotation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {customer.status === "ACTIVE" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(customer.id, "SUSPENDED")
                                  }
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(customer.id, "ACTIVE")
                                  }
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Activate
                                </DropdownMenuItem>
                              )}
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
