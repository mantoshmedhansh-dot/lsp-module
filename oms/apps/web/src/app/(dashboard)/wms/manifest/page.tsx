"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  MoreHorizontal,
  Eye,
  Clock,
  CheckCircle,
  Truck,
  RefreshCw,
  FileText,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Package,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Transporter {
  id: string;
  code: string;
  name: string;
}

interface ManifestDelivery {
  id: string;
  deliveryNo: string;
  awbNo: string | null;
  status: string;
  order: {
    orderNo: string;
    customerName: string;
    paymentMode: string;
    totalAmount: number;
  };
}

interface Manifest {
  id: string;
  manifestNo: string;
  transporterId: string;
  transporter: Transporter | null;
  status: string;
  vehicleNo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  confirmedAt: string | null;
  createdAt: string;
  deliveries: ManifestDelivery[];
  _count: {
    deliveries: number;
  };
}

interface ManifestsResponse {
  manifests: Manifest[];
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
  OPEN: { label: "Open", variant: "outline", icon: Unlock },
  CONFIRMED: { label: "Confirmed", variant: "secondary", icon: CheckCircle },
  CLOSED: { label: "Closed", variant: "default", icon: Lock },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CLOSED", label: "Closed" },
];

export default function ManifestPage() {
  const router = useRouter();
  const [data, setData] = useState<ManifestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transporters, setTransporters] = useState<Transporter[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("OPEN");
  const [transporterFilter, setTransporterFilter] = useState("");
  const [page, setPage] = useState(1);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [manifestToDelete, setManifestToDelete] = useState<Manifest | null>(null);

  // Expanded manifest
  const [expandedManifest, setExpandedManifest] = useState<string | null>(null);

  const fetchManifests = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      if (transporterFilter) params.set("transporterId", transporterFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/transporters/manifests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch manifests");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching manifests:", error);
      toast.error("Failed to load manifests");
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
      fetchManifests();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchManifests]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  async function handleConfirm(manifestId: string) {
    try {
      const response = await fetch(`/api/v1/transporters/manifests/${manifestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Manifest confirmed");
        fetchManifests();
      } else {
        toast.error(result.error || "Failed to confirm manifest");
      }
    } catch (error) {
      console.error("Error confirming manifest:", error);
      toast.error("Failed to confirm manifest");
    }
  }

  async function handleClose(manifestId: string) {
    try {
      const response = await fetch(`/api/v1/transporters/manifests/${manifestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        fetchManifests();
      } else {
        toast.error(result.error || "Failed to close manifest");
      }
    } catch (error) {
      console.error("Error closing manifest:", error);
      toast.error("Failed to close manifest");
    }
  }

  async function handleDelete() {
    if (!manifestToDelete) return;

    try {
      const response = await fetch(`/api/v1/transporters/manifests/${manifestToDelete.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Manifest deleted");
        setShowDeleteDialog(false);
        setManifestToDelete(null);
        fetchManifests();
      } else {
        toast.error(result.error || "Failed to delete manifest");
      }
    } catch (error) {
      console.error("Error deleting manifest:", error);
      toast.error("Failed to delete manifest");
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("OPEN");
    setTransporterFilter("");
    setPage(1);
  }

  const hasFilters = search || transporterFilter;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  const getTotalCodAmount = (manifest: Manifest) => {
    return manifest.deliveries
      .filter((d) => d.order.paymentMode === "COD")
      .reduce((sum, d) => sum + Number(d.order.totalAmount), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manifests</h1>
          <p className="text-muted-foreground">
            Manage shipment manifests for courier pickup
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchManifests}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/wms/delivery-shipping")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Manifest
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
                placeholder="Search by manifest no or vehicle no..."
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

      {/* Manifests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Manifest List</CardTitle>
          <CardDescription>{data?.total || 0} manifests found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.manifests.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No manifests found</p>
              <Button
                variant="link"
                onClick={() => router.push("/wms/delivery-shipping")}
              >
                Create your first manifest
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manifest</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Shipments</TableHead>
                    <TableHead>COD Amount</TableHead>
                    <TableHead>Vehicle / Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.manifests.map((manifest) => {
                    const statusInfo = statusConfig[manifest.status] || {
                      label: manifest.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const codAmount = getTotalCodAmount(manifest);
                    const isExpanded = expandedManifest === manifest.id;

                    return (
                      <>
                        <TableRow key={manifest.id}>
                          <TableCell>
                            <button
                              onClick={() =>
                                setExpandedManifest(
                                  isExpanded ? null : manifest.id
                                )
                              }
                              className="font-medium text-primary hover:underline"
                            >
                              {manifest.manifestNo}
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {manifest.transporter?.name || "Unknown"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span>{manifest._count.deliveries}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {codAmount > 0 ? (
                              <span className="font-medium text-orange-600">
                                ₹{codAmount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {manifest.vehicleNo || manifest.driverName ? (
                              <div>
                                {manifest.vehicleNo && (
                                  <p className="text-sm font-medium">
                                    {manifest.vehicleNo}
                                  </p>
                                )}
                                {manifest.driverName && (
                                  <p className="text-xs text-muted-foreground">
                                    {manifest.driverName}
                                    {manifest.driverPhone &&
                                      ` (${manifest.driverPhone})`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                              <statusInfo.icon className="mr-1 h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(
                                new Date(manifest.createdAt),
                                "dd MMM yyyy"
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(manifest.createdAt), "HH:mm")}
                            </div>
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
                                    setExpandedManifest(
                                      isExpanded ? null : manifest.id
                                    )
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  {isExpanded ? "Hide" : "View"} Deliveries
                                </DropdownMenuItem>

                                {manifest.status === "OPEN" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleConfirm(manifest.id)}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Confirm Manifest
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setManifestToDelete(manifest);
                                        setShowDeleteDialog(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Manifest
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {manifest.status === "CONFIRMED" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleClose(manifest.id)}
                                    >
                                      <Truck className="mr-2 h-4 w-4" />
                                      Close & Ship
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Deliveries */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/50 p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium">
                                  Deliveries in this manifest
                                </h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Delivery No</TableHead>
                                      <TableHead>Order</TableHead>
                                      <TableHead>Customer</TableHead>
                                      <TableHead>AWB</TableHead>
                                      <TableHead>Payment</TableHead>
                                      <TableHead className="text-right">
                                        Amount
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {manifest.deliveries.map((delivery) => (
                                      <TableRow key={delivery.id}>
                                        <TableCell className="font-medium">
                                          {delivery.deliveryNo}
                                        </TableCell>
                                        <TableCell>
                                          {delivery.order.orderNo}
                                        </TableCell>
                                        <TableCell>
                                          {delivery.order.customerName}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                          {delivery.awbNo}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              delivery.order.paymentMode ===
                                              "COD"
                                                ? "destructive"
                                                : "secondary"
                                            }
                                          >
                                            {delivery.order.paymentMode}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          ₹
                                          {Number(
                                            delivery.order.totalAmount
                                          ).toLocaleString()}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Manifest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all deliveries from the manifest and delete it.
              The deliveries will be returned to PACKED status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
