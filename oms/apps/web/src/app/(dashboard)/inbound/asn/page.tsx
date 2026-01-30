"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  ArrowDownToLine,
  Clock,
  CheckCircle,
  Truck,
  MoreHorizontal,
  Eye,
  Loader2,
  X,
  AlertCircle,
  Download,
  PackageCheck,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, type ExportColumn } from "@/lib/utils";

interface Inbound {
  id: string;
  inboundNo: string;
  type: string;
  status: string;
  locationId: string;
  receivedById: string;
  purchaseOrderId?: string;
  grnNo?: string;
  remarks?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Summary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  expectedToday: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "secondary", icon: Truck },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
};

const typeConfig: Record<string, string> = {
  PURCHASE_ORDER: "Purchase Order",
  RETURN: "Return",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
};

export default function ASNManagementPage() {
  const router = useRouter();
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    expectedToday: 0,
  });

  // Create form state
  const [newInbound, setNewInbound] = useState({
    inboundNo: "",
    type: "PURCHASE_ORDER",
    locationId: "",
    remarks: "",
  });

  const statusTabs = [
    { value: "all", label: "All ASNs" },
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
  ];

  const fetchData = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("limit", "50");

      // Fetch inbounds
      const inboundsRes = await fetch(`/api/v1/inbound?${params}`);
      if (inboundsRes.ok) {
        const data = await inboundsRes.json();
        const inboundList = Array.isArray(data) ? data : data.items || [];
        setInbounds(inboundList);
      }

      // Fetch locations for the create form
      const locationsRes = await fetch("/api/v1/locations?limit=100");
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        const locationList = Array.isArray(data) ? data : data.items || [];
        setLocations(locationList);
      }

      // Calculate summary
      const countRes = await fetch("/api/v1/inbound/count");
      const pendingRes = await fetch("/api/v1/inbound/count?status=PENDING");
      const inProgressRes = await fetch("/api/v1/inbound/count?status=IN_PROGRESS");
      const completedRes = await fetch("/api/v1/inbound/count?status=COMPLETED");

      const [totalCount, pendingCount, inProgressCount, completedCount] = await Promise.all([
        countRes.ok ? countRes.json() : { count: 0 },
        pendingRes.ok ? pendingRes.json() : { count: 0 },
        inProgressRes.ok ? inProgressRes.json() : { count: 0 },
        completedRes.ok ? completedRes.json() : { count: 0 },
      ]);

      setSummary({
        total: totalCount.count || 0,
        pending: pendingCount.count || 0,
        inProgress: inProgressCount.count || 0,
        completed: completedCount.count || 0,
        expectedToday: pendingCount.count || 0, // Using pending as expected today for now
      });

      if (showToast) {
        toast.success("Data refreshed successfully");
      }
    } catch (error) {
      console.error("Error fetching ASN data:", error);
      if (showToast) {
        toast.error("Failed to refresh data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateInbound = async () => {
    if (!newInbound.inboundNo || !newInbound.locationId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Get current user for receivedById
      const meRes = await fetch("/api/v1/auth/me");
      if (!meRes.ok) {
        toast.error("Could not get current user");
        return;
      }
      const me = await meRes.json();

      const response = await fetch("/api/v1/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newInbound,
          receivedById: me.id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("ASN created successfully");
        setIsCreateDialogOpen(false);
        setNewInbound({
          inboundNo: "",
          type: "PURCHASE_ORDER",
          locationId: "",
          remarks: "",
        });
        fetchData();
      } else {
        const errorMsg = result.detail
          ? (typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail))
          : "Failed to create ASN";
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Error creating ASN:", error);
      toast.error("Failed to create ASN");
    }
  };

  const generateASNNumber = () => {
    const date = new Date();
    const prefix = "ASN";
    const timestamp = date.getFullYear().toString().slice(-2) +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}-${timestamp}-${random}`;
  };

  const filteredInbounds = inbounds.filter((inbound) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      inbound.inboundNo.toLowerCase().includes(searchLower) ||
      inbound.grnNo?.toLowerCase().includes(searchLower) ||
      inbound.remarks?.toLowerCase().includes(searchLower)
    );
  });

  const hasFilters = search || activeTab !== "all";

  // Export ASN data to CSV
  const handleExport = () => {
    if (filteredInbounds.length === 0) {
      toast.error("No data to export");
      return;
    }
    const columns: ExportColumn[] = [
      { key: "inboundNo", header: "ASN Number" },
      { key: "type", header: "Type", formatter: (v) => typeConfig[v] || v },
      { key: "status", header: "Status", formatter: (v) => statusConfig[v]?.label || v },
      { key: "grnNo", header: "GRN Number", formatter: (v) => v || "" },
      { key: "remarks", header: "Remarks", formatter: (v) => v || "" },
      { key: "createdAt", header: "Created Date", formatter: (v) => format(new Date(v), "dd MMM yyyy HH:mm") },
      { key: "completedAt", header: "Completed Date", formatter: (v) => v ? format(new Date(v), "dd MMM yyyy HH:mm") : "" },
    ];
    exportToCSV(filteredInbounds, columns, `asn_list_${activeTab}`);
    toast.success("ASN data exported successfully");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ASN Management</h1>
          <p className="text-muted-foreground">
            Advanced Shipping Notices - Track inbound shipments from vendors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create ASN
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New ASN</DialogTitle>
                <DialogDescription>
                  Create a new Advanced Shipping Notice to track incoming shipments
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="inboundNo">ASN Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inboundNo"
                      placeholder="e.g., ASN-240126-001"
                      value={newInbound.inboundNo}
                      onChange={(e) =>
                        setNewInbound((prev) => ({ ...prev, inboundNo: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setNewInbound((prev) => ({
                          ...prev,
                          inboundNo: generateASNNumber(),
                        }))
                      }
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={newInbound.type}
                    onValueChange={(value) =>
                      setNewInbound((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                      <SelectItem value="RETURN">Return</SelectItem>
                      <SelectItem value="TRANSFER">Transfer</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="locationId">Location *</Label>
                  <Select
                    value={newInbound.locationId}
                    onValueChange={(value) =>
                      setNewInbound((prev) => ({ ...prev, locationId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input
                    id="remarks"
                    placeholder="Optional notes about this shipment"
                    value={newInbound.remarks}
                    onChange={(e) =>
                      setNewInbound((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateInbound}>Create ASN</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ASNs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">All inbound notices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected Today</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.expectedToday}</div>
            <p className="text-xs text-muted-foreground">Pending arrival</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Truck className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <p className="text-xs text-muted-foreground">Fully received</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value === "all" && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {summary.total}
                </Badge>
              )}
              {tab.value === "PENDING" && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {summary.pending}
                </Badge>
              )}
              {tab.value === "IN_PROGRESS" && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {summary.inProgress}
                </Badge>
              )}
              {tab.value === "COMPLETED" && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {summary.completed}
                </Badge>
              )}
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
                placeholder="Search by ASN number, GRN, or remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ASN List */}
      <Card>
        <CardHeader>
          <CardTitle>ASN List</CardTitle>
          <CardDescription>
            {filteredInbounds.length} records found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInbounds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowDownToLine className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No ASNs Found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {hasFilters
                  ? "No ASNs match your current filters. Try adjusting your search."
                  : "Create an ASN to track incoming shipments from vendors. ASNs help you plan receiving operations and dock scheduling."}
              </p>
              {!hasFilters && (
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First ASN
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ASN Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GRN</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInbounds.map((inbound) => {
                  const statusInfo = statusConfig[inbound.status] || {
                    label: inbound.status,
                    variant: "outline" as const,
                    icon: AlertCircle,
                  };
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={inbound.id}>
                      <TableCell>
                        <div>
                          <button
                            onClick={() => router.push(`/inbound/goods-receipt/${inbound.id}`)}
                            className="font-medium text-primary hover:underline"
                          >
                            {inbound.inboundNo}
                          </button>
                          {inbound.remarks && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {inbound.remarks}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {typeConfig[inbound.type] || inbound.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inbound.grnNo || <span className="text-muted-foreground">--</span>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(inbound.createdAt), "dd MMM yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(inbound.createdAt), "HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {inbound.completedAt ? (
                          <div className="text-sm">
                            {format(new Date(inbound.completedAt), "dd MMM yyyy")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
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
                              onClick={() => router.push(`/inbound/goods-receipt/${inbound.id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {(inbound.status === "PENDING" || inbound.status === "IN_PROGRESS") && !inbound.grnNo && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/inbound/goods-receipt/new?source=asn&asnId=${inbound.id}`)}
                              >
                                <PackageCheck className="mr-2 h-4 w-4 text-green-600" />
                                Create GRN
                              </DropdownMenuItem>
                            )}
                            {inbound.grnNo && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/inbound/goods-receipt?search=${inbound.grnNo}`)}
                              >
                                <ExternalLink className="mr-2 h-4 w-4 text-blue-600" />
                                View GRN
                              </DropdownMenuItem>
                            )}
                            {inbound.status === "PENDING" && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/inbound/receiving?id=${inbound.id}`)}
                              >
                                <ArrowDownToLine className="mr-2 h-4 w-4" />
                                Start Receiving
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
