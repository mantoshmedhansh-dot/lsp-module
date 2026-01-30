"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Eye,
  PackageCheck,
  FileText,
  Search,
  Filter,
  PackageOpen,
  Truck,
  ShoppingCart,
  CornerDownLeft,
  ArrowRightLeft,
  PenLine,
  PlayCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface GoodsReceipt {
  id: string;
  grNo: string;
  inboundId: string | null;
  purchaseOrderId: string | null;
  asnNo: string | null;
  status: string;
  movementType: string;
  totalQty: number;
  totalValue: number;
  locationId: string;
  companyId: string;
  receivedAt: string | null;
  postedAt: string | null;
  itemCount: number;
  createdAt: string;
  sourceType?: string;
  externalPoNumber?: string;
  vendorName?: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface PendingASN {
  id: string;
  asnNo: string;
  externalVendorName?: string;
  totalExpectedQty?: number;
  status: string;
  expectedArrival?: string;
}

interface PendingPO {
  id: string;
  externalPoNumber: string;
  externalVendorName: string;
  totalExpectedQty?: number;
  status: string;
  expectedDeliveryDate?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-500" },
  RECEIVING: { label: "Receiving", color: "bg-blue-500" },
  POSTED: { label: "Posted", color: "bg-green-500" },
  REVERSED: { label: "Reversed", color: "bg-orange-500" },
  CANCELLED: { label: "Cancelled", color: "bg-red-500" },
};

const sourceTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  EXTERNAL_PO: { label: "Ext. PO", icon: ShoppingCart, color: "text-blue-600" },
  ASN: { label: "ASN", icon: Truck, color: "text-purple-600" },
  RETURN: { label: "Return", icon: CornerDownLeft, color: "text-orange-600" },
  STO: { label: "STO", icon: ArrowRightLeft, color: "text-cyan-600" },
  MANUAL: { label: "Manual", icon: PenLine, color: "text-gray-600" },
};

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  // Pending inbounds
  const [pendingASNs, setPendingASNs] = useState<PendingASN[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    fetchLocations();
    fetchGoodsReceipts();
    fetchPendingInbounds();
  }, [filterStatus, filterLocation, filterSource]);

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const data = await response.json();
        const locationList = Array.isArray(data) ? data : data.items || [];
        setLocations(locationList);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }

  async function fetchGoodsReceipts() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "all") {
        params.append("status", filterStatus);
      }
      if (filterLocation && filterLocation !== "all") {
        params.append("location_id", filterLocation);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/v1/goods-receipts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch goods receipts");
      const data = await response.json();
      const grList = Array.isArray(data) ? data : data.items || [];
      setGoodsReceipts(grList);
    } catch (error) {
      console.error("Error fetching goods receipts:", error);
      toast.error("Failed to load goods receipts");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchPendingInbounds() {
    try {
      setLoadingPending(true);

      // Fetch arrived ASNs
      const asnResponse = await fetch("/api/v1/asns?status=ARRIVED&limit=5");
      if (asnResponse.ok) {
        const asnData = await asnResponse.json();
        const asnList = Array.isArray(asnData) ? asnData : asnData.items || [];
        setPendingASNs(asnList);
      }

      // Fetch open External POs
      const poResponse = await fetch("/api/v1/external-pos?status=OPEN&limit=5");
      if (poResponse.ok) {
        const poData = await poResponse.json();
        const poList = Array.isArray(poData) ? poData : poData.items || [];
        setPendingPOs(poList);
      }
    } catch (error) {
      console.error("Error fetching pending inbounds:", error);
    } finally {
      setLoadingPending(false);
    }
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || "Unknown";
  };

  const filteredReceipts = goodsReceipts.filter((gr) => {
    // Source filter
    if (filterSource && filterSource !== "all") {
      if (gr.sourceType !== filterSource) return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        gr.grNo.toLowerCase().includes(query) ||
        gr.asnNo?.toLowerCase().includes(query) ||
        gr.externalPoNumber?.toLowerCase().includes(query) ||
        gr.vendorName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = {
      all: goodsReceipts.length,
      DRAFT: 0,
      RECEIVING: 0,
      POSTED: 0,
      REVERSED: 0,
      CANCELLED: 0,
    };
    goodsReceipts.forEach((gr) => {
      if (counts[gr.status] !== undefined) {
        counts[gr.status]++;
      }
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const hasPendingInbounds = pendingASNs.length > 0 || pendingPOs.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with New GRN Dropdown */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goods Receipt</h1>
          <p className="text-muted-foreground">
            Manage inbound goods receipt documents
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New GRN
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/inbound/goods-receipt/new?source=external-po")}>
                <ShoppingCart className="mr-2 h-4 w-4 text-blue-600" />
                From External PO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/inbound/goods-receipt/new?source=asn")}>
                <Truck className="mr-2 h-4 w-4 text-purple-600" />
                From ASN
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CornerDownLeft className="mr-2 h-4 w-4 text-orange-600" />
                From Sales Return
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <ArrowRightLeft className="mr-2 h-4 w-4 text-cyan-600" />
                From Stock Transfer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/inbound/goods-receipt/new?source=manual")}>
                <PenLine className="mr-2 h-4 w-4 text-gray-600" />
                Manual Entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("DRAFT")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">{statusCounts.DRAFT}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("RECEIVING")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receiving</p>
                <p className="text-2xl font-bold">{statusCounts.RECEIVING}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus("POSTED")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Posted</p>
                <p className="text-2xl font-bold">{statusCounts.POSTED}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending ASNs</p>
                <p className="text-2xl font-bold">{pendingASNs.length}</p>
              </div>
              <Truck className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open POs</p>
                <p className="text-2xl font-bold">{pendingPOs.length}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Inbounds Section */}
      {hasPendingInbounds && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base">Pending Inbounds (Ready for GRN)</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchPendingInbounds}
                disabled={loadingPending}
              >
                <RefreshCw className={`h-4 w-4 ${loadingPending ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingASNs.map((asn) => (
                <div
                  key={asn.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-100">
                      <Truck className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{asn.asnNo}</p>
                      <p className="text-sm text-muted-foreground">
                        {asn.externalVendorName || "Unknown Vendor"} • {asn.totalExpectedQty?.toLocaleString() || 0} units
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {asn.status}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/inbound/goods-receipt/new?source=asn&asnId=${asn.id}`)}
                    >
                      Create GRN
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {pendingPOs.map((po) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{po.externalPoNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {po.externalVendorName} • {po.totalExpectedQty?.toLocaleString() || 0} units
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {po.status}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/inbound/goods-receipt/new?source=external-po&poId=${po.id}`)}
                    >
                      Create GRN
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Tabs */}
      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="DRAFT">
            Draft ({statusCounts.DRAFT})
          </TabsTrigger>
          <TabsTrigger value="RECEIVING">
            Receiving ({statusCounts.RECEIVING})
          </TabsTrigger>
          <TabsTrigger value="POSTED">
            Posted ({statusCounts.POSTED})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Location:</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[180px]">
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
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Source:</Label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="EXTERNAL_PO">External PO</SelectItem>
                  <SelectItem value="ASN">ASN</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                  <SelectItem value="STO">Stock Transfer</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by GR#, PO#, ASN#, or vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    fetchGoodsReceipts();
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Goods Receipts</CardTitle>
          <CardDescription>
            {filteredReceipts.length} document{filteredReceipts.length !== 1 ? "s" : ""}{" "}
            found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No goods receipts found</p>
              {canManage && (
                <Button
                  variant="link"
                  onClick={() => router.push("/inbound/goods-receipt/new")}
                >
                  Create your first goods receipt
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR Number</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((gr) => {
                  const sourceConfig = sourceTypeConfig[gr.sourceType || "MANUAL"];
                  const SourceIcon = sourceConfig?.icon || PenLine;
                  return (
                    <TableRow key={gr.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{gr.grNo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <SourceIcon className={`h-4 w-4 ${sourceConfig?.color || "text-gray-500"}`} />
                          <span className="text-sm">{sourceConfig?.label || "Manual"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {gr.externalPoNumber && (
                            <p>PO: {gr.externalPoNumber}</p>
                          )}
                          {gr.asnNo && (
                            <p className={gr.externalPoNumber ? "text-xs text-muted-foreground" : ""}>
                              {gr.externalPoNumber ? "" : "ASN: "}{gr.asnNo}
                            </p>
                          )}
                          {!gr.externalPoNumber && !gr.asnNo && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${statusConfig[gr.status]?.color || "bg-gray-500"} text-white`}
                        >
                          {statusConfig[gr.status]?.label || gr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getLocationName(gr.locationId)}
                      </TableCell>
                      <TableCell className="text-right">{gr.itemCount}</TableCell>
                      <TableCell className="text-right">{gr.totalQty.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(gr.createdAt), {
                          addSuffix: true,
                        })}
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
                                router.push(`/inbound/goods-receipt/${gr.id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {gr.status === "DRAFT" && canManage && (
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/inbound/goods-receipt/${gr.id}`)
                                }
                              >
                                <PackageCheck className="mr-2 h-4 w-4" />
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
