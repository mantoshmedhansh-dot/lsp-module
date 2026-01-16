"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Filter,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  XCircle,
  CheckCircle,
  Package,
  Truck,
  Clock,
  AlertCircle,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

interface OrderItem {
  id: string;
  quantity: number;
  allocatedQty: number;
  sku: {
    id: string;
    code: string;
    name: string;
  };
}

interface Order {
  id: string;
  orderNo: string;
  externalOrderNo: string | null;
  channel: string;
  orderType: string;
  paymentMode: string;
  status: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  orderDate: string;
  shipByDate: string | null;
  location: {
    id: string;
    code: string;
    name: string;
  };
  items: OrderItem[];
  deliveries: Array<{
    id: string;
    deliveryNo: string;
    status: string;
    awbNo: string | null;
    transporter: {
      code: string;
      name: string;
    } | null;
  }>;
  _count: {
    items: number;
    picklists: number;
  };
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  CREATED: { label: "Created", variant: "outline", icon: Clock },
  CONFIRMED: { label: "Confirmed", variant: "secondary", icon: CheckCircle },
  ALLOCATED: { label: "Allocated", variant: "secondary", icon: Package },
  PARTIALLY_ALLOCATED: { label: "Partial", variant: "outline", icon: AlertCircle },
  PICKLIST_GENERATED: { label: "Picklist", variant: "secondary", icon: Package },
  PICKING: { label: "Picking", variant: "secondary", icon: Package },
  PICKED: { label: "Picked", variant: "secondary", icon: CheckCircle },
  PACKING: { label: "Packing", variant: "secondary", icon: Package },
  PACKED: { label: "Packed", variant: "default", icon: Package },
  MANIFESTED: { label: "Manifested", variant: "default", icon: Truck },
  SHIPPED: { label: "Shipped", variant: "default", icon: Truck },
  IN_TRANSIT: { label: "In Transit", variant: "default", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", variant: "default", icon: Truck },
  DELIVERED: { label: "Delivered", variant: "default", icon: CheckCircle },
  RTO_INITIATED: { label: "RTO Initiated", variant: "destructive", icon: RefreshCw },
  RTO_IN_TRANSIT: { label: "RTO Transit", variant: "destructive", icon: RefreshCw },
  RTO_DELIVERED: { label: "RTO Delivered", variant: "destructive", icon: RefreshCw },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
  ON_HOLD: { label: "On Hold", variant: "outline", icon: AlertCircle },
};

const channelConfig: Record<string, { label: string; color: string }> = {
  AMAZON: { label: "Amazon", color: "bg-orange-500" },
  FLIPKART: { label: "Flipkart", color: "bg-yellow-500" },
  MYNTRA: { label: "Myntra", color: "bg-pink-500" },
  AJIO: { label: "Ajio", color: "bg-purple-500" },
  MEESHO: { label: "Meesho", color: "bg-red-500" },
  SHOPIFY: { label: "Shopify", color: "bg-green-500" },
  WEBSITE: { label: "Website", color: "bg-blue-500" },
  MANUAL: { label: "Manual", color: "bg-gray-500" },
};

const statusTabs = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending", statuses: ["CREATED", "CONFIRMED"] },
  { value: "processing", label: "Processing", statuses: ["ALLOCATED", "PARTIALLY_ALLOCATED", "PICKLIST_GENERATED", "PICKING", "PICKED", "PACKING", "PACKED"] },
  { value: "shipped", label: "Shipped", statuses: ["MANIFESTED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
  { value: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { value: "rto", label: "RTO", statuses: ["RTO_INITIATED", "RTO_IN_TRANSIT", "RTO_DELIVERED"] },
  { value: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "ON_HOLD"] },
];

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);
      if (paymentFilter) params.set("paymentMode", paymentFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      // Add status filter based on active tab
      if (activeTab !== "all") {
        const tabConfig = statusTabs.find((t) => t.value === activeTab);
        if (tabConfig?.statuses) {
          // For tabs with multiple statuses, we need to filter client-side or modify API
          // For now, use the first status
          params.set("status", tabConfig.statuses[0]);
        }
      }

      const response = await fetch(`/api/v1/orders?${params}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, channelFilter, paymentFilter, activeTab, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchOrders]);

  async function handleBulkAction(action: string) {
    if (selectedOrders.length === 0) {
      toast.error("Please select orders first");
      return;
    }

    try {
      const response = await fetch("/api/v1/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderIds: selectedOrders }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setSelectedOrders([]);
        fetchOrders();
      } else {
        toast.error(result.error || "Failed to process action");
      }
    } catch (error) {
      console.error("Error processing bulk action:", error);
      toast.error("Failed to process action");
    }
  }

  async function handleGeneratePicklists() {
    if (selectedOrders.length === 0) {
      toast.error("Please select orders first");
      return;
    }

    try {
      const response = await fetch("/api/v1/picklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Generated ${result.created} picklist(s)`);
        setSelectedOrders([]);
        fetchOrders();
        if (result.created > 0) {
          router.push("/wms/picklist");
        }
      } else {
        toast.error(result.error || "Failed to generate picklists");
      }
    } catch (error) {
      console.error("Error generating picklists:", error);
      toast.error("Failed to generate picklists");
    }
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }

  function toggleAllOrders() {
    if (!data?.orders) return;

    if (selectedOrders.length === data.orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(data.orders.map((o) => o.id));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setChannelFilter("");
    setPaymentFilter("");
    setActiveTab("all");
    setPage(1);
  }

  const hasFilters = search || statusFilter || channelFilter || paymentFilter;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;

    const tabConfig = statusTabs.find((t) => t.value === tabValue);
    if (!tabConfig?.statuses) return 0;

    return tabConfig.statuses.reduce(
      (sum, status) => sum + (data.statusCounts[status] || 0),
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage and process customer orders
          </p>
        </div>
        <Button onClick={() => router.push("/orders/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
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
                placeholder="Search by order no, customer name, or phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={channelFilter}
                onValueChange={(value) => {
                  setChannelFilter(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {Object.entries(channelConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={paymentFilter}
                onValueChange={(value) => {
                  setPaymentFilter(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PREPAID">Prepaid</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedOrders.length} orders selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("confirm")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("allocate")}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Allocate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGeneratePicklists}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Generate Picklist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("hold")}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Hold
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction("cancel")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedOrders([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
          <CardDescription>
            {data?.total || 0} orders found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.orders.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No orders match your filters" : "No orders found"}
              </p>
              <Button
                variant="link"
                onClick={() => router.push("/orders/new")}
              >
                Create your first order
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          data.orders.length > 0 &&
                          selectedOrders.length === data.orders.length
                        }
                        onCheckedChange={toggleAllOrders}
                      />
                    </TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => {
                    const statusInfo = statusConfig[order.status] || {
                      label: order.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const channelInfo = channelConfig[order.channel] || {
                      label: order.channel,
                      color: "bg-gray-500",
                    };

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <button
                              onClick={() => router.push(`/orders/${order.id}`)}
                              className="font-medium text-primary hover:underline"
                            >
                              {order.orderNo}
                            </button>
                            {order.externalOrderNo && (
                              <p className="text-xs text-muted-foreground">
                                {order.externalOrderNo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.customerPhone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${channelInfo.color}`}
                            />
                            <span className="text-sm">{channelInfo.label}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className="mt-1 text-xs"
                          >
                            {order.paymentMode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order._count.items} items
                          </div>
                          {order.items.some((i) => i.allocatedQty < i.quantity) && (
                            <span className="text-xs text-yellow-600">
                              Partial allocation
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{Number(order.totalAmount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(order.orderDate), "dd MMM yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.orderDate), "HH:mm")}
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
                                onClick={() => router.push(`/orders/${order.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/orders/${order.id}/edit`)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {["CREATED", "CONFIRMED"].includes(order.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedOrders([order.id]);
                                      handleBulkAction("allocate");
                                    }}
                                  >
                                    <Package className="mr-2 h-4 w-4" />
                                    Allocate Inventory
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!["SHIPPED", "DELIVERED", "CANCELLED"].includes(
                                order.status
                              ) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedOrders([order.id]);
                                      handleBulkAction("cancel");
                                    }}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                </>
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
