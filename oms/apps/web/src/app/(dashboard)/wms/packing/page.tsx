"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  MoreHorizontal,
  Eye,
  Package,
  Clock,
  CheckCircle,
  Box,
  RefreshCw,
  Play,
  Truck,
  Scale,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
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
  pickedQty: number;
  packedQty: number;
  sku: {
    id: string;
    code: string;
    name: string;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
  };
}

interface Delivery {
  id: string;
  deliveryNo: string;
  status: string;
  boxes: number;
  weight: number | null;
}

interface Order {
  id: string;
  orderNo: string;
  externalOrderNo: string | null;
  status: string;
  customerName: string;
  customerPhone: string;
  paymentMode: string;
  totalAmount: number;
  orderDate: string;
  location: {
    id: string;
    code: string;
    name: string;
  };
  items: OrderItem[];
  deliveries: Delivery[];
}

interface Transporter {
  id: string;
  code: string;
  name: string;
}

interface OrdersResponse {
  orders: Order[];
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
  PICKED: { label: "Ready to Pack", variant: "secondary", icon: Package },
  PACKING: { label: "Packing", variant: "secondary", icon: Box },
  PACKED: { label: "Packed", variant: "default", icon: CheckCircle },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "PICKED", label: "Ready to Pack" },
  { value: "PACKING", label: "Packing" },
  { value: "PACKED", label: "Packed" },
];

export default function PackingPage() {
  const router = useRouter();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transporters, setTransporters] = useState<Transporter[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("PICKED");
  const [page, setPage] = useState(1);

  // Packing dialog
  const [showPackDialog, setShowPackDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [packingData, setPackingData] = useState({
    boxes: 1,
    weight: "",
    length: "",
    width: "",
    height: "",
    transporterId: "",
  });

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/packing?${params}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, page]);

  const fetchTransporters = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/transporters");
      if (response.ok) {
        const result = await response.json();
        setTransporters(result);
      }
    } catch (error) {
      console.error("Error fetching transporters:", error);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchOrders();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchOrders]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  async function handleStartPacking(orderId: string) {
    try {
      const response = await fetch(`/api/v1/packing/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Packing started");
        fetchOrders();
      } else {
        toast.error(result.error || "Failed to start packing");
      }
    } catch (error) {
      console.error("Error starting packing:", error);
      toast.error("Failed to start packing");
    }
  }

  function openPackDialog(order: Order) {
    setSelectedOrder(order);

    // Calculate suggested dimensions from items
    let totalWeight = 0;
    order.items.forEach((item) => {
      if (item.sku.weight) {
        totalWeight += Number(item.sku.weight) * item.pickedQty;
      }
    });

    const delivery = order.deliveries[0];

    setPackingData({
      boxes: delivery?.boxes || 1,
      weight: delivery?.weight?.toString() || totalWeight.toFixed(2),
      length: "",
      width: "",
      height: "",
      transporterId: "",
    });
    setShowPackDialog(true);
  }

  async function handleCompletePacking() {
    if (!selectedOrder) return;

    try {
      const response = await fetch(`/api/v1/packing/${selectedOrder.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          boxes: packingData.boxes,
          weight: packingData.weight ? parseFloat(packingData.weight) : null,
          length: packingData.length ? parseFloat(packingData.length) : null,
          width: packingData.width ? parseFloat(packingData.width) : null,
          height: packingData.height ? parseFloat(packingData.height) : null,
          transporterId: packingData.transporterId || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Order packed successfully");
        setShowPackDialog(false);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        toast.error(result.error || "Failed to complete packing");
      }
    } catch (error) {
      console.error("Error completing packing:", error);
      toast.error("Failed to complete packing");
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("PICKED");
    setPage(1);
  }

  const hasFilters = search;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Packing Station</h1>
          <p className="text-muted-foreground">
            Pack picked orders for shipping
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order no or customer name..."
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

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders for Packing</CardTitle>
          <CardDescription>
            {data?.total || 0} orders found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.orders.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No orders ready for packing
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
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
                    const totalItems = order.items.reduce(
                      (sum, item) => sum + item.pickedQty,
                      0
                    );

                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.orderNo}</p>
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
                          <div className="text-sm">
                            {order.items.length} SKUs
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {totalItems} units
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={order.paymentMode === "COD" ? "destructive" : "secondary"}
                          >
                            {order.paymentMode}
                          </Badge>
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
                          <span className="text-sm">{order.location.code}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/orders/${order.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Order
                              </DropdownMenuItem>

                              {order.status === "PICKED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleStartPacking(order.id)}
                                  >
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Packing
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openPackDialog(order)}
                                  >
                                    <Box className="mr-2 h-4 w-4" />
                                    Pack & Complete
                                  </DropdownMenuItem>
                                </>
                              )}

                              {order.status === "PACKING" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openPackDialog(order)}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Complete Packing
                                  </DropdownMenuItem>
                                </>
                              )}

                              {order.status === "PACKED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => router.push("/wms/delivery-shipping")}
                                  >
                                    <Truck className="mr-2 h-4 w-4" />
                                    Go to Shipping
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

      {/* Packing Dialog */}
      <Dialog open={showPackDialog} onOpenChange={setShowPackDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Packing</DialogTitle>
            <DialogDescription>
              Enter package details for {selectedOrder?.orderNo}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Customer</span>
                  <span className="font-medium">{selectedOrder.customerName}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Items</span>
                  <span className="font-medium">
                    {selectedOrder.items.reduce((s, i) => s + i.pickedQty, 0)} units
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Payment</span>
                  <Badge
                    variant={selectedOrder.paymentMode === "COD" ? "destructive" : "secondary"}
                    className="h-5"
                  >
                    {selectedOrder.paymentMode}
                  </Badge>
                </div>
              </div>

              {/* Package Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="boxes">Number of Boxes</Label>
                  <Input
                    id="boxes"
                    type="number"
                    min="1"
                    value={packingData.boxes}
                    onChange={(e) =>
                      setPackingData({
                        ...packingData,
                        boxes: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <div className="relative">
                    <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-10"
                      value={packingData.weight}
                      onChange={(e) =>
                        setPackingData({ ...packingData, weight: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="length">Length (cm)</Label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="length"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      className="pl-10"
                      value={packingData.length}
                      onChange={(e) =>
                        setPackingData({ ...packingData, length: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="width">Width (cm)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={packingData.width}
                    onChange={(e) =>
                      setPackingData({ ...packingData, width: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={packingData.height}
                    onChange={(e) =>
                      setPackingData({ ...packingData, height: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Transporter Selection */}
              <div>
                <Label htmlFor="transporter">Transporter (Optional)</Label>
                <Select
                  value={packingData.transporterId}
                  onValueChange={(value) =>
                    setPackingData({ ...packingData, transporterId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompletePacking}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Packing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
