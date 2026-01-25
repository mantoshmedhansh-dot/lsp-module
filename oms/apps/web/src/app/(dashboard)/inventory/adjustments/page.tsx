"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  Plus,
  Minus,
  RefreshCw,
  ArrowLeft,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Bin {
  id: string;
  code: string;
  zone: {
    code: string;
    name: string;
    type: string;
    location: Location;
  };
}

interface SKU {
  id: string;
  code: string;
  name: string;
}

interface AdjustmentItem {
  skuId: string;
  skuCode: string;
  skuName: string;
  binId: string;
  binCode: string;
  currentQty: number;
  adjustedQty: number;
  newQty: number;
  batchNo?: string;
}

interface Adjustment {
  id: string;
  adjustmentNo: string;
  reason: string;
  remarks: string | null;
  createdAt: string;
  location: Location;
  adjustedBy: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    skuId: string;
    binId: string;
    previousQty: number;
    adjustedQty: number;
    newQty: number;
    sku?: SKU;
    bin?: { id: string; code: string };
  }>;
  _count: {
    items: number;
  };
}

interface AdjustmentsResponse {
  adjustments: Adjustment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const adjustmentReasons = [
  { value: "DAMAGE", label: "Damaged Stock" },
  { value: "EXPIRY", label: "Expired Stock" },
  { value: "THEFT", label: "Theft / Lost" },
  { value: "FOUND", label: "Found Stock" },
  { value: "CYCLE_COUNT", label: "Cycle Count" },
  { value: "CORRECTION", label: "Data Correction" },
  { value: "OTHER", label: "Other" },
];

export default function StockAdjustmentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("create");

  // Create adjustment state
  const [locations, setLocations] = useState<Location[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add item dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    skuId: "",
    binId: "",
    adjustedQty: 0,
  });
  const [skuSearch, setSkuSearch] = useState("");
  const [skuOpen, setSkuOpen] = useState(false);

  // History state
  const [historyData, setHistoryData] = useState<AdjustmentsResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const result = await response.json();
        // API returns array directly, not { locations: [...] }
        setLocations(Array.isArray(result) ? result : result.locations || []);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }, []);

  const fetchBins = useCallback(async () => {
    if (!selectedLocation) {
      setBins([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/bins?locationId=${selectedLocation}`);
      if (response.ok) {
        const result = await response.json();
        setBins(result);
      }
    } catch (error) {
      console.error("Error fetching bins:", error);
    }
  }, [selectedLocation]);

  const fetchSkus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (skuSearch) params.set("search", skuSearch);
      params.set("limit", "50");

      const response = await fetch(`/api/v1/skus?${params}`);
      if (response.ok) {
        const result = await response.json();
        // API returns array directly, not { skus: [...] }
        setSkus(Array.isArray(result) ? result : result.skus || []);
      }
    } catch (error) {
      console.error("Error fetching SKUs:", error);
    }
  }, [skuSearch]);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams();
      if (historySearch) params.set("search", historySearch);
      params.set("page", historyPage.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/v1/inventory/adjustments?${params}`);
      if (response.ok) {
        const result = await response.json();
        setHistoryData(result);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyPage]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  useEffect(() => {
    const debounce = setTimeout(fetchSkus, 300);
    return () => clearTimeout(debounce);
  }, [fetchSkus]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  async function getCurrentStock(skuId: string, binId: string) {
    try {
      const response = await fetch(
        `/api/v1/inventory?skuId=${skuId}&binId=${binId}&limit=1`
      );
      if (response.ok) {
        const result = await response.json();
        // API returns array directly, not { inventory: [...] }
        const inventory = Array.isArray(result) ? result : result.inventory || [];
        return inventory[0]?.quantity || 0;
      }
    } catch (error) {
      console.error("Error fetching current stock:", error);
    }
    return 0;
  }

  async function handleAddItem() {
    if (!newItem.skuId || !newItem.binId) {
      toast.error("Please select SKU and bin");
      return;
    }

    const sku = skus.find((s) => s.id === newItem.skuId);
    const bin = bins.find((b) => b.id === newItem.binId);

    if (!sku || !bin) return;

    // Check for duplicate
    const exists = items.find(
      (i) => i.skuId === newItem.skuId && i.binId === newItem.binId
    );
    if (exists) {
      toast.error("This SKU/Bin combination already added");
      return;
    }

    const currentQty = await getCurrentStock(newItem.skuId, newItem.binId);
    const newQty = currentQty + newItem.adjustedQty;

    if (newQty < 0) {
      toast.error("Adjustment would result in negative stock");
      return;
    }

    setItems([
      ...items,
      {
        skuId: sku.id,
        skuCode: sku.code,
        skuName: sku.name,
        binId: bin.id,
        binCode: bin.code,
        currentQty,
        adjustedQty: newItem.adjustedQty,
        newQty,
      },
    ]);

    setShowAddDialog(false);
    setNewItem({ skuId: "", binId: "", adjustedQty: 0 });
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!selectedLocation) {
      toast.error("Please select a location");
      return;
    }
    if (!selectedReason) {
      toast.error("Please select a reason");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocation,
          reason: selectedReason,
          remarks,
          items: items.map((item) => ({
            skuId: item.skuId,
            binId: item.binId,
            adjustedQty: item.adjustedQty,
            batchNo: item.batchNo,
          })),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        // Reset form
        setSelectedReason("");
        setRemarks("");
        setItems([]);
        // Switch to history tab
        setActiveTab("history");
        fetchHistory();
      } else {
        toast.error(result.error || "Failed to create adjustment");
      }
    } catch (error) {
      console.error("Error creating adjustment:", error);
      toast.error("Failed to create adjustment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/inventory")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Adjustment</h1>
          <p className="text-muted-foreground">
            Adjust inventory quantities with reason tracking
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">Create Adjustment</TabsTrigger>
          <TabsTrigger value="history">Adjustment History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {/* Adjustment Form */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Adjustment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Location *</Label>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reason *</Label>
                  <Select
                    value={selectedReason}
                    onValueChange={setSelectedReason}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {adjustmentReasons.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Items</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Increase</span>
                    <span className="font-medium text-green-600">
                      +{items.filter((i) => i.adjustedQty > 0).reduce((s, i) => s + i.adjustedQty, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Decrease</span>
                    <span className="font-medium text-red-600">
                      {items.filter((i) => i.adjustedQty < 0).reduce((s, i) => s + i.adjustedQty, 0)}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full mt-6"
                  onClick={handleSubmit}
                  disabled={isSubmitting || items.length === 0}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Adjustment"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Adjustment Items</CardTitle>
                  <CardDescription>
                    Add SKUs to adjust with quantity changes
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  disabled={!selectedLocation}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No items added yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Add Item" to start adding adjustment items
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead className="text-center">Current Qty</TableHead>
                      <TableHead className="text-center">Adjustment</TableHead>
                      <TableHead className="text-center">New Qty</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.skuCode}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.skuName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{item.binCode}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.currentQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              item.adjustedQty > 0 ? "default" : "destructive"
                            }
                          >
                            {item.adjustedQty > 0 ? (
                              <Plus className="mr-1 h-3 w-3" />
                            ) : (
                              <Minus className="mr-1 h-3 w-3" />
                            )}
                            {Math.abs(item.adjustedQty)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {item.newQty}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by adjustment number..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={fetchHistory}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card>
            <CardHeader>
              <CardTitle>Adjustment History</CardTitle>
              <CardDescription>
                {historyData?.total || 0} adjustments found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : !historyData?.adjustments.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No adjustments found</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Adjustment No</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.adjustments.map((adj) => (
                        <TableRow key={adj.id}>
                          <TableCell>
                            <span className="font-medium">{adj.adjustmentNo}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {adjustmentReasons.find((r) => r.value === adj.reason)?.label || adj.reason}
                            </Badge>
                          </TableCell>
                          <TableCell>{adj.location.name}</TableCell>
                          <TableCell>{adj._count.items} items</TableCell>
                          <TableCell>{adj.adjustedBy.name}</TableCell>
                          <TableCell>
                            {format(new Date(adj.createdAt), "dd MMM yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {historyData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {historyData.page} of {historyData.totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setHistoryPage((p) =>
                              Math.min(historyData.totalPages, p + 1)
                            )
                          }
                          disabled={historyPage === historyData.totalPages}
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
        </TabsContent>
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Adjustment Item</DialogTitle>
            <DialogDescription>
              Select SKU, bin, and adjustment quantity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>SKU *</Label>
              <Popover open={skuOpen} onOpenChange={setSkuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={skuOpen}
                    className="w-full justify-between"
                  >
                    {newItem.skuId
                      ? skus.find((s) => s.id === newItem.skuId)?.code
                      : "Search and select SKU..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search SKU..."
                      value={skuSearch}
                      onValueChange={setSkuSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No SKU found.</CommandEmpty>
                      <CommandGroup>
                        {skus.map((sku) => (
                          <CommandItem
                            key={sku.id}
                            value={sku.code}
                            onSelect={() => {
                              setNewItem({ ...newItem, skuId: sku.id });
                              setSkuOpen(false);
                            }}
                          >
                            <div>
                              <p className="font-medium">{sku.code}</p>
                              <p className="text-sm text-muted-foreground">
                                {sku.name}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Bin *</Label>
              <Select
                value={newItem.binId}
                onValueChange={(value) =>
                  setNewItem({ ...newItem, binId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bin" />
                </SelectTrigger>
                <SelectContent>
                  {bins.map((bin) => (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.code} ({bin.zone.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Adjustment Quantity *</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setNewItem({
                      ...newItem,
                      adjustedQty: newItem.adjustedQty - 1,
                    })
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={newItem.adjustedQty}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      adjustedQty: parseInt(e.target.value) || 0,
                    })
                  }
                  className="text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setNewItem({
                      ...newItem,
                      adjustedQty: newItem.adjustedQty + 1,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use positive numbers to add stock, negative to remove
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
