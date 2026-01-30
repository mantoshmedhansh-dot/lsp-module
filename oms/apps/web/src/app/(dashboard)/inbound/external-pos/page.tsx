"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  RefreshCw,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  MoreHorizontal,
  Eye,
  Loader2,
  X,
  Download,
  Upload,
  PackageCheck,
  ExternalLink,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface ExternalPO {
  id: string;
  externalPoNumber: string;
  externalVendorCode: string;
  externalVendorName: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: string;
  totalLines: number;
  totalExpectedQty: number;
  totalReceivedQty: number;
  totalAmount?: number;
  locationId: string;
  createdAt: string;
  updatedAt: string;
  // GRN reference
  grnId?: string;
  grnNo?: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Summary {
  total: number;
  open: number;
  partiallyReceived: number;
  fullyReceived: number;
  closed: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-blue-500" },
  PARTIALLY_RECEIVED: { label: "Partial", color: "bg-orange-500" },
  FULLY_RECEIVED: { label: "Received", color: "bg-green-500" },
  CLOSED: { label: "Closed", color: "bg-gray-500" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500" },
};

export default function ExternalPOsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [externalPOs, setExternalPOs] = useState<ExternalPO[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    open: 0,
    partiallyReceived: 0,
    fullyReceived: 0,
    closed: 0,
  });

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const statusTabs = [
    { value: "all", label: "All POs", count: summary.total },
    { value: "OPEN", label: "Open", count: summary.open },
    { value: "PARTIALLY_RECEIVED", label: "Partial", count: summary.partiallyReceived },
    { value: "FULLY_RECEIVED", label: "Received", count: summary.fullyReceived },
  ];

  const fetchData = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("status", activeTab);
      if (locationFilter !== "all") params.set("location_id", locationFilter);
      params.set("limit", "100");

      // Fetch External POs
      const posRes = await fetch(`/api/v1/external-pos?${params}`);
      if (posRes.ok) {
        const data = await posRes.json();
        const poList = Array.isArray(data) ? data : data.items || [];
        setExternalPOs(poList);
      }

      // Fetch locations
      const locationsRes = await fetch("/api/v1/locations?type=WAREHOUSE&limit=100");
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        const locationList = Array.isArray(data) ? data : data.items || [];
        setLocations(locationList);
      }

      // Fetch summary counts
      const [totalRes, openRes, partialRes, receivedRes] = await Promise.all([
        fetch("/api/v1/external-pos/count").catch(() => null),
        fetch("/api/v1/external-pos/count?status=OPEN").catch(() => null),
        fetch("/api/v1/external-pos/count?status=PARTIALLY_RECEIVED").catch(() => null),
        fetch("/api/v1/external-pos/count?status=FULLY_RECEIVED").catch(() => null),
      ]);

      const totalCount = totalRes?.ok ? await totalRes.json() : { count: 0 };
      const openCount = openRes?.ok ? await openRes.json() : { count: 0 };
      const partialCount = partialRes?.ok ? await partialRes.json() : { count: 0 };
      const receivedCount = receivedRes?.ok ? await receivedRes.json() : { count: 0 };

      setSummary({
        total: totalCount.count || 0,
        open: openCount.count || 0,
        partiallyReceived: partialCount.count || 0,
        fullyReceived: receivedCount.count || 0,
        closed: 0,
      });

      if (showToast) {
        toast.success("Data refreshed");
      }
    } catch (error) {
      console.error("Error fetching External POs:", error);
      if (showToast) {
        toast.error("Failed to refresh data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, locationFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPOs = externalPOs.filter((po) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      po.externalPoNumber.toLowerCase().includes(searchLower) ||
      po.externalVendorName.toLowerCase().includes(searchLower) ||
      po.externalVendorCode.toLowerCase().includes(searchLower)
    );
  });

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || "Unknown";
  };

  const hasFilters = search || activeTab !== "all" || locationFilter !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">External Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders from external ERP/SAP systems
          </p>
        </div>
        <div className="flex gap-2">
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
          {canManage && (
            <Button
              onClick={() => router.push("/inbound/goods-receipt/upload")}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload POs
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("all")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">All external POs</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("OPEN")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.open}</div>
            <p className="text-xs text-muted-foreground">Ready for GRN</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("PARTIALLY_RECEIVED")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partially Received</CardTitle>
            <Truck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.partiallyReceived}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("FULLY_RECEIVED")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.fullyReceived}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {tab.count}
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
                placeholder="Search by PO number or vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                  setLocationFilter("all");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      <Card>
        <CardHeader>
          <CardTitle>External Purchase Orders</CardTitle>
          <CardDescription>
            {filteredPOs.length} records found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No External POs Found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                {hasFilters
                  ? "No External POs match your current filters."
                  : "Upload External POs from your ERP system to get started."}
              </p>
              {!hasFilters && canManage && (
                <Button
                  className="mt-4"
                  onClick={() => router.push("/inbound/goods-receipt/upload")}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload External POs
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      <div className="font-medium">{po.externalPoNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{po.externalVendorName}</p>
                        <p className="text-xs text-muted-foreground">{po.externalVendorCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig[po.status]?.color || "bg-gray-500"} text-white`}>
                        {statusConfig[po.status]?.label || po.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getLocationName(po.locationId)}
                    </TableCell>
                    <TableCell className="text-right">{po.totalLines}</TableCell>
                    <TableCell className="text-right">
                      <div>
                        <span className="font-medium">{po.totalReceivedQty || 0}</span>
                        <span className="text-muted-foreground"> / {po.totalExpectedQty}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {po.expectedDeliveryDate
                        ? format(new Date(po.expectedDeliveryDate), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(po.createdAt), { addSuffix: true })}
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
                            onClick={() => router.push(`/inbound/external-pos/${po.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {po.status === "OPEN" && canManage && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/inbound/goods-receipt/new?source=external-po&poId=${po.id}`)}
                            >
                              <PackageCheck className="mr-2 h-4 w-4 text-green-600" />
                              Create GRN
                            </DropdownMenuItem>
                          )}
                          {po.grnNo && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/inbound/goods-receipt?search=${po.grnNo}`)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4 text-blue-600" />
                              View GRN
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
