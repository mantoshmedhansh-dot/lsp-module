"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  Package,
  MoveRight,
  Plus,
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

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  location: Location;
}

interface Bin {
  id: string;
  code: string;
  zone: Zone;
}

interface SKU {
  id: string;
  code: string;
  name: string;
}

interface InventoryRecord {
  id: string;
  skuId: string;
  binId: string;
  quantity: number;
  reservedQty: number;
  batchNo: string | null;
  sku?: SKU;
  bin?: { id: string; code: string };
}

interface TransferItem {
  skuId: string;
  skuCode: string;
  skuName: string;
  fromBinId: string;
  fromBinCode: string;
  toBinId: string;
  toBinCode: string;
  availableQty: number;
  transferQty: number;
  batchNo?: string;
}

interface TransferHistory {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  remarks: string | null;
  sku?: SKU;
  fromBin?: { id: string; code: string };
  toBin?: { id: string; code: string };
  createdBy?: { id: string; name: string };
}

export default function BinTransfersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("create");

  // Create transfer state
  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceBins, setSourceBins] = useState<Bin[]>([]);
  const [destBins, setDestBins] = useState<Bin[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add item dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    inventoryId: "",
    toBinId: "",
    transferQty: 1,
  });
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // History state
  const [historyData, setHistoryData] = useState<TransferHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const result = await response.json();
        setLocations(Array.isArray(result) ? result : result.locations || []);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }, []);

  const fetchBins = useCallback(async () => {
    if (!selectedLocation) {
      setSourceBins([]);
      setDestBins([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/bins?locationId=${selectedLocation}`);
      if (response.ok) {
        const result = await response.json();
        setSourceBins(result);
        setDestBins(result);
      }
    } catch (error) {
      console.error("Error fetching bins:", error);
    }
  }, [selectedLocation]);

  const fetchInventory = useCallback(async () => {
    if (!selectedLocation) {
      setInventory([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("locationId", selectedLocation);
      if (inventorySearch) params.set("search", inventorySearch);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/inventory?${params}`);
      if (response.ok) {
        const result = await response.json();
        // Filter out inventory with 0 available qty
        const invList = Array.isArray(result) ? result : result.inventory || [];
        setInventory(invList.filter((inv: InventoryRecord) => (inv.quantity - inv.reservedQty) > 0));
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  }, [selectedLocation, inventorySearch]);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams();
      params.set("type", "TRANSFER");
      params.set("page", historyPage.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/v1/inventory/movements?${params}`);
      if (response.ok) {
        const result = await response.json();
        setHistoryData(Array.isArray(result) ? result : result.movements || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  useEffect(() => {
    const debounce = setTimeout(fetchInventory, 300);
    return () => clearTimeout(debounce);
  }, [fetchInventory]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  function handleAddItem() {
    if (!newItem.inventoryId || !newItem.toBinId) {
      toast.error("Please select source inventory and destination bin");
      return;
    }

    const inv = inventory.find((i) => i.id === newItem.inventoryId);
    const toBin = destBins.find((b) => b.id === newItem.toBinId);

    if (!inv || !toBin) return;

    if (inv.binId === newItem.toBinId) {
      toast.error("Source and destination bins cannot be the same");
      return;
    }

    const availableQty = inv.quantity - inv.reservedQty;
    if (newItem.transferQty > availableQty) {
      toast.error(`Transfer quantity exceeds available quantity (${availableQty})`);
      return;
    }

    if (newItem.transferQty <= 0) {
      toast.error("Transfer quantity must be greater than 0");
      return;
    }

    // Check for duplicate
    const exists = items.find(
      (i) => i.skuId === inv.skuId && i.fromBinId === inv.binId && i.toBinId === newItem.toBinId
    );
    if (exists) {
      toast.error("This transfer already exists in the list");
      return;
    }

    const fromBin = sourceBins.find((b) => b.id === inv.binId);

    setItems([
      ...items,
      {
        skuId: inv.skuId,
        skuCode: inv.sku?.code || "Unknown",
        skuName: inv.sku?.name || "Unknown SKU",
        fromBinId: inv.binId,
        fromBinCode: fromBin?.code || inv.bin?.code || "Unknown",
        toBinId: toBin.id,
        toBinCode: toBin.code,
        availableQty,
        transferQty: newItem.transferQty,
        batchNo: inv.batchNo || undefined,
      },
    ]);

    setShowAddDialog(false);
    setNewItem({ inventoryId: "", toBinId: "", transferQty: 1 });
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (items.length === 0) {
      toast.error("Please add at least one transfer item");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        const response = await fetch("/api/v1/inventory/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skuId: item.skuId,
            fromBinId: item.fromBinId,
            toBinId: item.toBinId,
            quantity: item.transferQty,
            batchNo: item.batchNo,
            remarks,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          const result = await response.json();
          console.error("Transfer failed:", result);
          errorCount++;
        }
      } catch (error) {
        console.error("Error transferring inventory:", error);
        errorCount++;
      }
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      toast.success(`${successCount} transfer(s) completed successfully`);
      setItems([]);
      setRemarks("");
      fetchInventory();
      if (errorCount === 0) {
        setActiveTab("history");
        fetchHistory();
      }
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} transfer(s) failed`);
    }
  }

  const selectedInventory = inventory.find((i) => i.id === newItem.inventoryId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/inventory")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bin Transfers</h1>
          <p className="text-muted-foreground">
            Transfer inventory between bins within the same warehouse
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">Create Transfer</TabsTrigger>
          <TabsTrigger value="history">Transfer History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {/* Transfer Form */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transfer Details</CardTitle>
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
                  <Label>Remarks (Optional)</Label>
                  <Textarea
                    placeholder="Additional notes for this transfer..."
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
                    <span className="text-muted-foreground">Total Transfers</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Quantity</span>
                    <span className="font-medium">
                      {items.reduce((s, i) => s + i.transferQty, 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unique SKUs</span>
                    <span className="font-medium">
                      {new Set(items.map((i) => i.skuId)).size}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full mt-6"
                  onClick={handleSubmit}
                  disabled={isSubmitting || items.length === 0}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Processing..." : "Execute Transfers"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transfer Items</CardTitle>
                  <CardDescription>
                    Add items to transfer between bins
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  disabled={!selectedLocation}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transfer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MoveRight className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transfers added yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Add Transfer" to start moving inventory between bins
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>From Bin</TableHead>
                      <TableHead className="text-center">
                        <ArrowRight className="h-4 w-4 inline" />
                      </TableHead>
                      <TableHead>To Bin</TableHead>
                      <TableHead className="text-center">Available</TableHead>
                      <TableHead className="text-center">Transfer Qty</TableHead>
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
                            {item.batchNo && (
                              <Badge variant="outline" className="mt-1">
                                Batch: {item.batchNo}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {item.fromBinCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <MoveRight className="h-4 w-4 text-muted-foreground inline" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="font-mono">
                            {item.toBinCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {item.availableQty}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {item.transferQty}
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
          {/* Refresh Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-end">
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
              <CardTitle>Transfer History</CardTitle>
              <CardDescription>
                Recent bin-to-bin transfers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : !historyData.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transfers found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transfer history will appear here after you execute transfers
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>From Bin</TableHead>
                      <TableHead>To Bin</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Transferred By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{transfer.sku?.code || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {transfer.sku?.name || "Unknown SKU"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {transfer.fromBin?.code || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="font-mono">
                            {transfer.toBin?.code || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {transfer.quantity}
                        </TableCell>
                        <TableCell>{transfer.createdBy?.name || "System"}</TableCell>
                        <TableCell>
                          {format(new Date(transfer.createdAt), "dd MMM yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Transfer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transfer</DialogTitle>
            <DialogDescription>
              Select inventory to transfer and destination bin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Source Inventory *</Label>
              <Popover open={inventoryOpen} onOpenChange={setInventoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={inventoryOpen}
                    className="w-full justify-between"
                  >
                    {selectedInventory ? (
                      <span>
                        {selectedInventory.sku?.code} - {sourceBins.find(b => b.id === selectedInventory.binId)?.code || selectedInventory.bin?.code}
                        ({selectedInventory.quantity - selectedInventory.reservedQty} available)
                      </span>
                    ) : (
                      "Search and select inventory..."
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search by SKU code..."
                      value={inventorySearch}
                      onValueChange={setInventorySearch}
                    />
                    <CommandList>
                      <CommandEmpty>No inventory found with available quantity.</CommandEmpty>
                      <CommandGroup>
                        {inventory.map((inv) => {
                          const bin = sourceBins.find(b => b.id === inv.binId);
                          const available = inv.quantity - inv.reservedQty;
                          return (
                            <CommandItem
                              key={inv.id}
                              value={`${inv.sku?.code || ""} ${bin?.code || inv.bin?.code || ""}`}
                              onSelect={() => {
                                setNewItem({ ...newItem, inventoryId: inv.id });
                                setInventoryOpen(false);
                              }}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div>
                                  <p className="font-medium">{inv.sku?.code || "Unknown"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Bin: {bin?.code || inv.bin?.code || "Unknown"}
                                    {inv.batchNo && ` | Batch: ${inv.batchNo}`}
                                  </p>
                                </div>
                                <Badge variant="outline">{available} avail</Badge>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Destination Bin *</Label>
              <Select
                value={newItem.toBinId}
                onValueChange={(value) =>
                  setNewItem({ ...newItem, toBinId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination bin" />
                </SelectTrigger>
                <SelectContent>
                  {destBins
                    .filter((bin) => bin.id !== selectedInventory?.binId)
                    .map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.code} ({bin.zone.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transfer Quantity *</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setNewItem({
                      ...newItem,
                      transferQty: Math.max(1, newItem.transferQty - 1),
                    })
                  }
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={selectedInventory ? selectedInventory.quantity - selectedInventory.reservedQty : 999}
                  value={newItem.transferQty}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      transferQty: Math.max(1, parseInt(e.target.value) || 1),
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
                      transferQty: newItem.transferQty + 1,
                    })
                  }
                >
                  +
                </Button>
              </div>
              {selectedInventory && (
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {selectedInventory.quantity - selectedInventory.reservedQty} units
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Add Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
