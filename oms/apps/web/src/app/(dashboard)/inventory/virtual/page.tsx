"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  RefreshCw,
  Layers,
  Filter,
  Search,
  Edit2,
  Trash2,
  ShoppingCart,
  Package,
  Shield,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VirtualInventory {
  id: string;
  skuId: string;
  sku: { id: string; code: string; name: string };
  locationId: string;
  location: { id: string; code: string; name: string };
  type: string;
  channel?: string;
  quantity: number;
  allocatedQty: number;
  validFrom?: string;
  validTo?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  CHANNEL_RESERVE: { label: "Channel Reserve", color: "bg-blue-100 text-blue-800", icon: ShoppingCart },
  PREORDER: { label: "Pre-order", color: "bg-purple-100 text-purple-800", icon: Clock },
  PROMOTIONAL: { label: "Promotional", color: "bg-orange-100 text-orange-800", icon: Package },
  SAFETY_STOCK: { label: "Safety Stock", color: "bg-green-100 text-green-800", icon: Shield },
};

export default function VirtualInventoryPage() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<VirtualInventory | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    skuId: "",
    locationId: "",
    type: "CHANNEL_RESERVE",
    channel: "",
    quantity: 0,
    validFrom: "",
    validTo: "",
    notes: "",
  });

  // Fetch virtual inventory
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["virtual-inventory", typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/virtual-inventory?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Fetch SKUs
  const { data: skusData } = useQuery({
    queryKey: ["skus"],
    queryFn: async () => {
      const res = await fetch("/api/v1/skus?limit=100");
      if (!res.ok) throw new Error("Failed to fetch SKUs");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/v1/virtual-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Virtual inventory created");
      setShowCreateDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["virtual-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/virtual-inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Virtual inventory updated");
      setEditingItem(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["virtual-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/virtual-inventory/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Virtual inventory deleted");
      queryClient.invalidateQueries({ queryKey: ["virtual-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      skuId: "",
      locationId: "",
      type: "CHANNEL_RESERVE",
      channel: "",
      quantity: 0,
      validFrom: "",
      validTo: "",
      notes: "",
    });
  };

  const openEditDialog = (item: VirtualInventory) => {
    setEditingItem(item);
    setFormData({
      skuId: item.skuId,
      locationId: item.locationId,
      type: item.type,
      channel: item.channel || "",
      quantity: item.quantity,
      validFrom: item.validFrom?.split("T")[0] || "",
      validTo: item.validTo?.split("T")[0] || "",
      notes: item.notes || "",
    });
  };

  const virtualInventory: VirtualInventory[] = data?.data || [];
  const locations: Location[] = locationsData?.data || [];
  const skus: SKU[] = skusData?.data || [];
  const totalPages = data?.totalPages || 1;

  // Filter by search
  const filteredInventory = virtualInventory.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.sku.code.toLowerCase().includes(query) ||
      item.sku.name.toLowerCase().includes(query) ||
      item.location.name.toLowerCase().includes(query)
    );
  });

  // Summary stats
  const stats = {
    channelReserve: virtualInventory
      .filter((i) => i.type === "CHANNEL_RESERVE")
      .reduce((sum, i) => sum + i.quantity, 0),
    preorder: virtualInventory
      .filter((i) => i.type === "PREORDER")
      .reduce((sum, i) => sum + i.quantity, 0),
    promotional: virtualInventory
      .filter((i) => i.type === "PROMOTIONAL")
      .reduce((sum, i) => sum + i.quantity, 0),
    safetyStock: virtualInventory
      .filter((i) => i.type === "SAFETY_STOCK")
      .reduce((sum, i) => sum + i.quantity, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual Inventory</h1>
          <p className="text-muted-foreground">
            Manage channel reserves, pre-orders, and safety stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Virtual Inventory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Virtual Inventory</DialogTitle>
                <DialogDescription>
                  Reserve inventory for channels, pre-orders, or safety stock
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Select
                    value={formData.skuId}
                    onValueChange={(v) => setFormData({ ...formData, skuId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map((sku) => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.code} - {sku.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(v) => setFormData({ ...formData, locationId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valid From</Label>
                    <Input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid To</Label>
                    <Input
                      type="date"
                      value={formData.validTo}
                      onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.skuId || !formData.locationId || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(typeConfig).map(([type, config]) => {
          const Icon = config.icon;
          const quantity = stats[type.toLowerCase().replace("_", "") as keyof typeof stats] || 0;
          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {config.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{quantity.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">units reserved</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU or location..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Virtual Inventory</CardTitle>
          <CardDescription>{data?.total || 0} total entries</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No virtual inventory found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const config = typeConfig[item.type] || typeConfig.CHANNEL_RESERVE;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.sku.code}</p>
                            <p className="text-xs text-muted-foreground">{item.sku.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>{item.location.name}</TableCell>
                        <TableCell>
                          <Badge className={config.color}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.allocatedQty.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {item.validFrom || item.validTo ? (
                            <span className="text-xs">
                              {item.validFrom?.split("T")[0] || "—"} to{" "}
                              {item.validTo?.split("T")[0] || "—"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No limit</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this virtual inventory?")) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Virtual Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingItem &&
                updateMutation.mutate({
                  id: editingItem.id,
                  data: {
                    quantity: formData.quantity,
                    validFrom: formData.validFrom,
                    validTo: formData.validTo,
                    notes: formData.notes,
                  },
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
