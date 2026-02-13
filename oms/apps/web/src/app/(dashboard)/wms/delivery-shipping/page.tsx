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
  Truck,
  RefreshCw,
  FileText,
  Send,
  MapPin,
  ExternalLink,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Transporter {
  id: string;
  code: string;
  name: string;
  trackingUrlTemplate: string | null;
}

interface Delivery {
  id: string;
  deliveryNo: string;
  status: string;
  awbNo: string | null;
  trackingUrl: string | null;
  weight: number | null;
  boxes: number;
  shipDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNo: string;
    externalOrderNo: string | null;
    customerName: string;
    customerPhone: string;
    shippingAddress: {
      line1?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
    paymentMode: string;
    totalAmount: number;
    location: {
      id: string;
      code: string;
      name: string;
    };
  };
  transporter: Transporter | null;
  manifest: {
    id: string;
    manifestNo: string;
    status: string;
  } | null;
}

interface DeliveriesResponse {
  deliveries: Delivery[];
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
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  PACKED: { label: "Packed", variant: "secondary", icon: Package },
  MANIFESTED: { label: "Manifested", variant: "secondary", icon: FileText },
  SHIPPED: { label: "Shipped", variant: "default", icon: Truck },
  IN_TRANSIT: { label: "In Transit", variant: "default", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", variant: "default", icon: MapPin },
  DELIVERED: { label: "Delivered", variant: "default", icon: CheckCircle },
  RTO_INITIATED: { label: "RTO Initiated", variant: "destructive", icon: AlertTriangle },
  RTO_IN_TRANSIT: { label: "RTO Transit", variant: "destructive", icon: AlertTriangle },
  RTO_DELIVERED: { label: "RTO Delivered", variant: "destructive", icon: AlertTriangle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "PACKED", label: "Ready to Ship" },
  { value: "MANIFESTED", label: "Manifested" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
];

export default function DeliveryShippingPage() {
  const router = useRouter();
  const [data, setData] = useState<DeliveriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("PACKED");
  const [transporterFilter, setTransporterFilter] = useState("");
  const [page, setPage] = useState(1);

  // AWB Dialog
  const [showAwbDialog, setShowAwbDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [awbData, setAwbData] = useState({
    transporterId: "",
    awbNo: "",
  });

  // Manifest Dialog
  const [showManifestDialog, setShowManifestDialog] = useState(false);
  const [manifestData, setManifestData] = useState({
    transporterId: "",
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
  });

  const fetchDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      if (transporterFilter) params.set("transporterId", transporterFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/deliveries?${params}`);
      if (!response.ok) throw new Error("Failed to fetch deliveries");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      toast.error("Failed to load deliveries");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, transporterFilter, page]);

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
      fetchDeliveries();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchDeliveries]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  function openAwbDialog(delivery: Delivery) {
    setSelectedDelivery(delivery);
    setAwbData({
      transporterId: delivery.transporter?.id || "",
      awbNo: delivery.awbNo || "",
    });
    setShowAwbDialog(true);
  }

  async function handleAssignAwb() {
    if (!selectedDelivery) return;

    if (!awbData.awbNo) {
      toast.error("AWB number is required");
      return;
    }

    try {
      const response = await fetch(`/api/v1/deliveries/${selectedDelivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-awb",
          transporterId: awbData.transporterId || null,
          awbNo: awbData.awbNo,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("AWB assigned successfully");
        setShowAwbDialog(false);
        fetchDeliveries();
      } else {
        toast.error(result.error || "Failed to assign AWB");
      }
    } catch (error) {
      console.error("Error assigning AWB:", error);
      toast.error("Failed to assign AWB");
    }
  }

  async function handleShip(deliveryId: string) {
    try {
      const response = await fetch(`/api/v1/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ship" }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Marked as shipped");
        fetchDeliveries();
      } else {
        toast.error(result.error || "Failed to ship");
      }
    } catch (error) {
      console.error("Error shipping:", error);
      toast.error("Failed to ship");
    }
  }

  function openManifestDialog() {
    const eligibleDeliveries = selectedDeliveries.filter((id) => {
      const delivery = data?.deliveries.find((d) => d.id === id);
      return delivery?.status === "PACKED" && delivery?.awbNo;
    });

    if (eligibleDeliveries.length === 0) {
      toast.error("Select packed deliveries with AWB assigned");
      return;
    }

    // Get common transporter if any
    const firstDelivery = data?.deliveries.find(
      (d) => d.id === eligibleDeliveries[0]
    );

    setManifestData({
      transporterId: firstDelivery?.transporter?.id || "",
      vehicleNo: "",
      driverName: "",
      driverPhone: "",
    });
    setShowManifestDialog(true);
  }

  async function handleCreateManifest() {
    const eligibleDeliveries = selectedDeliveries.filter((id) => {
      const delivery = data?.deliveries.find((d) => d.id === id);
      return delivery?.status === "PACKED" && delivery?.awbNo;
    });

    if (!manifestData.transporterId) {
      toast.error("Please select a transporter");
      return;
    }

    try {
      const response = await fetch("/api/v1/transporters/manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transporterId: manifestData.transporterId,
          deliveryIds: eligibleDeliveries,
          vehicleNo: manifestData.vehicleNo || null,
          driverName: manifestData.driverName || null,
          driverPhone: manifestData.driverPhone || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setShowManifestDialog(false);
        setSelectedDeliveries([]);
        fetchDeliveries();
        router.push("/wms/manifest");
      } else {
        toast.error(result.error || "Failed to create manifest");
      }
    } catch (error) {
      console.error("Error creating manifest:", error);
      toast.error("Failed to create manifest");
    }
  }

  function toggleDeliverySelection(deliveryId: string) {
    setSelectedDeliveries((prev) =>
      prev.includes(deliveryId)
        ? prev.filter((id) => id !== deliveryId)
        : [...prev, deliveryId]
    );
  }

  function toggleAllDeliveries() {
    if (!data?.deliveries) return;

    if (selectedDeliveries.length === data.deliveries.length) {
      setSelectedDeliveries([]);
    } else {
      setSelectedDeliveries(data.deliveries.map((d) => d.id));
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("PACKED");
    setTransporterFilter("");
    setPage(1);
  }

  const hasFilters = search || transporterFilter;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery & Shipping</h1>
          <p className="text-muted-foreground">
            Manage shipments and track deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchDeliveries}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/wms/manifest")}>
            <FileText className="mr-2 h-4 w-4" />
            View Manifests
          </Button>
        </div>
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
                placeholder="Search by delivery no, AWB, or order no..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={transporterFilter}
              onValueChange={(value) => {
                setTransporterFilter(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Transporters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transporters</SelectItem>
                {transporters.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
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

      {/* Bulk Actions */}
      {selectedDeliveries.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedDeliveries.length} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={openManifestDialog}
              >
                <FileText className="mr-2 h-4 w-4" />
                Create Manifest
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedDeliveries([])}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliveries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deliveries</CardTitle>
          <CardDescription>
            {data?.total || 0} deliveries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.deliveries.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No deliveries found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          data.deliveries.length > 0 &&
                          selectedDeliveries.length === data.deliveries.length
                        }
                        onCheckedChange={toggleAllDeliveries}
                      />
                    </TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.deliveries.map((delivery) => {
                    const statusInfo = statusConfig[delivery.status] || {
                      label: delivery.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };

                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDeliveries.includes(delivery.id)}
                            onCheckedChange={() =>
                              toggleDeliverySelection(delivery.id)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{delivery.deliveryNo}</p>
                            <p className="text-xs text-muted-foreground">
                              {delivery.boxes} box(es) •{" "}
                              {delivery.weight ? `${delivery.weight}kg` : "No weight"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() =>
                              router.push(`/orders/${delivery.order.id}`)
                            }
                            className="font-medium text-primary hover:underline"
                          >
                            {delivery.order.orderNo}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {delivery.order.location.code}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {delivery.order.customerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {delivery.order.shippingAddress.city},{" "}
                              {delivery.order.shippingAddress.pincode}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {delivery.transporter ? (
                            <span className="text-sm">
                              {delivery.transporter.name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Not assigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {delivery.awbNo ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-mono">
                                {delivery.awbNo}
                              </span>
                              {delivery.trackingUrl && (
                                <a
                                  href={delivery.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No AWB
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                          {delivery.manifest && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {delivery.manifest.manifestNo}
                            </p>
                          )}
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
                                onClick={() =>
                                  router.push(`/orders/${delivery.order.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Order
                              </DropdownMenuItem>

                              {delivery.status === "PACKED" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openAwbDialog(delivery)}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    {delivery.awbNo ? "Update AWB" : "Assign AWB"}
                                  </DropdownMenuItem>
                                  {delivery.awbNo && (
                                    <DropdownMenuItem
                                      onClick={() => handleShip(delivery.id)}
                                    >
                                      <Send className="mr-2 h-4 w-4" />
                                      Mark Shipped
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}

                              {delivery.trackingUrl && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={delivery.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Track Shipment
                                  </a>
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

      {/* AWB Assignment Dialog */}
      <Dialog open={showAwbDialog} onOpenChange={setShowAwbDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign AWB</DialogTitle>
            <DialogDescription>
              Assign tracking number for {selectedDelivery?.deliveryNo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Transporter</Label>
              <Select
                value={awbData.transporterId}
                onValueChange={(value) =>
                  setAwbData({ ...awbData, transporterId: value })
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

            <div>
              <Label>AWB Number</Label>
              <Input
                placeholder="Enter AWB / Tracking number"
                value={awbData.awbNo}
                onChange={(e) =>
                  setAwbData({ ...awbData, awbNo: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAwbDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignAwb}>Assign AWB</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Manifest Dialog */}
      <Dialog open={showManifestDialog} onOpenChange={setShowManifestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manifest</DialogTitle>
            <DialogDescription>
              Create manifest for{" "}
              {selectedDeliveries.filter((id) => {
                const d = data?.deliveries.find((del) => del.id === id);
                return d?.status === "PACKED" && d?.awbNo;
              }).length}{" "}
              deliveries
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Transporter *</Label>
              <Select
                value={manifestData.transporterId}
                onValueChange={(value) =>
                  setManifestData({ ...manifestData, transporterId: value })
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

            <div>
              <Label>Vehicle Number (Optional)</Label>
              <Input
                placeholder="e.g., MH12AB1234"
                value={manifestData.vehicleNo}
                onChange={(e) =>
                  setManifestData({ ...manifestData, vehicleNo: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Driver Name (Optional)</Label>
                <Input
                  placeholder="Driver name"
                  value={manifestData.driverName}
                  onChange={(e) =>
                    setManifestData({
                      ...manifestData,
                      driverName: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Driver Phone (Optional)</Label>
                <Input
                  placeholder="Phone number"
                  value={manifestData.driverPhone}
                  onChange={(e) =>
                    setManifestData({
                      ...manifestData,
                      driverPhone: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowManifestDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateManifest}>
              <FileText className="mr-2 h-4 w-4" />
              Create Manifest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
