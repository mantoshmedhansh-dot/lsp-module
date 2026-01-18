"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Package,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Filter,
  ArrowRightLeft,
  Plus,
  Boxes,
  MapPin,
  TrendingDown,
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

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  location: Location;
  bins: Bin[];
}

interface Bin {
  id: string;
  code: string;
  name: string | null;
  zone?: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

interface Inventory {
  id: string;
  quantity: number;
  reservedQty: number;
  availableQty?: number;
  batchNo: string | null;
  lotNo: string | null;
  expiryDate: string | null;
  // Nested objects (full format)
  sku?: {
    id: string;
    code: string;
    name: string;
    category: string | null;
    brand: string | null;
    reorderLevel: number | null;
    images: string[];
  };
  bin?: {
    id: string;
    code: string;
    name: string | null;
    zone?: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
  };
  location?: Location;
  // Flat IDs (brief format from backend)
  skuId?: string;
  binId?: string;
  locationId?: string;
}

interface InventoryResponse {
  inventory: Inventory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalQuantity: number;
    totalReserved: number;
    availableQuantity: number;
    uniqueSkus: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

const viewTabs = [
  { value: "all", label: "All Stock" },
  { value: "lowStock", label: "Low Stock" },
  { value: "outOfStock", label: "Out of Stock" },
];

export default function InventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  // Move dialog
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [moveData, setMoveData] = useState({
    toBinId: "",
    quantity: 1,
  });

  const fetchInventory = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (locationFilter) params.set("locationId", locationFilter);
      if (zoneFilter) params.set("zoneId", zoneFilter);
      if (activeTab === "lowStock") params.set("lowStock", "true");
      if (activeTab === "outOfStock") params.set("outOfStock", "true");
      params.set("page", page.toString());
      params.set("limit", "50");

      const response = await fetch(`/api/v1/inventory?${params}`);
      if (!response.ok) throw new Error("Failed to fetch inventory");
      const result = await response.json();

      // Handle both array format (backend) and wrapped format
      if (Array.isArray(result)) {
        // Calculate stats from array
        const totalQuantity = result.reduce((sum: number, inv: { quantity?: number }) => sum + (inv.quantity || 0), 0);
        const totalReserved = result.reduce((sum: number, inv: { reservedQty?: number }) => sum + (inv.reservedQty || 0), 0);
        const uniqueSkus = new Set(result.map((inv: { skuId?: string }) => inv.skuId)).size;

        setData({
          inventory: result,
          total: result.length,
          page: page,
          limit: 50,
          totalPages: 1,
          stats: {
            totalQuantity,
            totalReserved,
            availableQuantity: totalQuantity - totalReserved,
            uniqueSkus,
            lowStockCount: 0,
            outOfStockCount: result.filter((inv: { quantity?: number }) => (inv.quantity || 0) === 0).length,
          },
        });
      } else {
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  }, [search, locationFilter, zoneFilter, activeTab, page]);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const result = await response.json();
        setLocations(result.locations || result);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationFilter) params.set("locationId", locationFilter);
      params.set("includeBins", "true");

      const response = await fetch(`/api/v1/zones?${params}`);
      if (response.ok) {
        const result = await response.json();
        setZones(result);

        // Extract bins from zones
        const allBins: Bin[] = [];
        result.forEach((zone: Zone) => {
          if (zone.bins) {
            zone.bins.forEach((bin) => {
              allBins.push({
                ...bin,
                zone: {
                  id: zone.id,
                  code: zone.code,
                  name: zone.name,
                  type: zone.type,
                },
              });
            });
          }
        });
        setBins(allBins);
      }
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  }, [locationFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchInventory();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchInventory]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  function openMoveDialog(inventory: Inventory) {
    setSelectedInventory(inventory);
    setMoveData({
      toBinId: "",
      quantity: Math.min(1, inventory.quantity - inventory.reservedQty),
    });
    setShowMoveDialog(true);
  }

  async function handleMove() {
    if (!selectedInventory || !moveData.toBinId) {
      toast.error("Please select destination bin");
      return;
    }

    try {
      const response = await fetch("/api/v1/inventory/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId: selectedInventory.sku?.id || selectedInventory.skuId,
          fromBinId: selectedInventory.bin?.id || selectedInventory.binId,
          toBinId: moveData.toBinId,
          quantity: moveData.quantity,
          batchNo: selectedInventory.batchNo,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setShowMoveDialog(false);
        fetchInventory();
      } else {
        toast.error(result.error || "Failed to move inventory");
      }
    } catch (error) {
      console.error("Error moving inventory:", error);
      toast.error("Failed to move inventory");
    }
  }

  function clearFilters() {
    setSearch("");
    setLocationFilter("");
    setZoneFilter("");
    setActiveTab("all");
    setPage(1);
  }

  const hasFilters = search || locationFilter || zoneFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            View and manage stock levels
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInventory}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/inventory/adjustment")}>
            <Plus className="mr-2 h-4 w-4" />
            Stock Adjustment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.stats.totalQuantity.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.stats.uniqueSkus} unique SKUs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data.stats.availableQuantity.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Reserved: {data.stats.totalReserved.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {data.stats.lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Items below reorder level
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {data.stats.outOfStockCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Items with zero stock
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {viewTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
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
                placeholder="Search by SKU code, name, or bin..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={locationFilter}
                onValueChange={(value) => {
                  setLocationFilter(value === "all" ? "" : value);
                  setZoneFilter("");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Location" />
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

              <Select
                value={zoneFilter}
                onValueChange={(value) => {
                  setZoneFilter(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.code} - {zone.name}
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
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock List</CardTitle>
          <CardDescription>
            {data?.total || 0} inventory records found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.inventory.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No inventory matches your filters" : "No inventory found"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Location / Bin</TableHead>
                    <TableHead className="text-center">On Hand</TableHead>
                    <TableHead className="text-center">Reserved</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inventory.map((inv) => {
                    const available = inv.availableQty ?? (inv.quantity - inv.reservedQty);
                    const isLowStock =
                      inv.sku?.reorderLevel && inv.quantity <= inv.sku.reorderLevel;
                    const isOutOfStock = inv.quantity === 0;

                    // Handle both nested objects and flat IDs
                    const skuCode = inv.sku?.code || inv.skuId?.slice(0, 8) || "-";
                    const skuName = inv.sku?.name || "SKU Details";
                    const skuCategory = inv.sku?.category;
                    const binCode = inv.bin?.code || inv.binId?.slice(0, 8) || "-";
                    const zoneCode = inv.bin?.zone?.code || "";
                    const locationCode = inv.location?.code || inv.locationId?.slice(0, 8) || "";

                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{skuCode}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {skuName}
                            </p>
                            {skuCategory && (
                              <p className="text-xs text-muted-foreground">
                                {skuCategory}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{binCode}</p>
                              <p className="text-xs text-muted-foreground">
                                {zoneCode}{zoneCode && locationCode ? " • " : ""}{locationCode}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-lg font-bold">
                          {inv.quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {inv.reservedQty > 0 ? (
                            <span className="text-yellow-600 font-medium">
                              {inv.reservedQty}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-bold ${
                              available > 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {available}
                          </span>
                        </TableCell>
                        <TableCell>
                          {inv.batchNo ? (
                            <span className="text-sm font-mono">{inv.batchNo}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isOutOfStock ? (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Out of Stock
                            </Badge>
                          ) : isLowStock ? (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {available > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openMoveDialog(inv)}
                            >
                              <ArrowRightLeft className="mr-1 h-3 w-3" />
                              Move
                            </Button>
                          )}
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

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Inventory</DialogTitle>
            <DialogDescription>
              Transfer stock to another bin location
            </DialogDescription>
          </DialogHeader>

          {selectedInventory && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>SKU</span>
                  <span className="font-medium">{selectedInventory.sku?.code || selectedInventory.skuId?.slice(0, 8) || "-"}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>From Bin</span>
                  <span className="font-medium">{selectedInventory.bin?.code || selectedInventory.binId?.slice(0, 8) || "-"}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Available</span>
                  <span className="font-medium">
                    {selectedInventory.quantity - selectedInventory.reservedQty}
                  </span>
                </div>
              </div>

              <div>
                <Label>Destination Bin</Label>
                <Select
                  value={moveData.toBinId}
                  onValueChange={(value) =>
                    setMoveData({ ...moveData, toBinId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {bins
                      .filter((b) => b.id !== (selectedInventory.bin?.id || selectedInventory.binId))
                      .map((bin) => (
                        <SelectItem key={bin.id} value={bin.id}>
                          {bin.code} ({bin.zone?.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity to Move</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedInventory.quantity - selectedInventory.reservedQty}
                  value={moveData.quantity}
                  onChange={(e) =>
                    setMoveData({
                      ...moveData,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
