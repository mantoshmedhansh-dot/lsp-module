"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  RefreshCw,
  Package,
  Filter,
  Search,
  Eye,
  Edit2,
  Trash2,
  Check,
  X,
  Boxes,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface BundleItem {
  id: string;
  componentSkuId: string;
  componentSku: { id: string; code: string; name: string };
  quantity: number;
  isOptional: boolean;
}

interface Bundle {
  id: string;
  bundleSkuId: string;
  bundleSku: { id: string; code: string; name: string };
  name: string;
  description?: string;
  type: string;
  pricingType: string;
  fixedPrice?: number;
  discountPercent?: number;
  items: BundleItem[];
  isActive: boolean;
  _count: { items: number };
  createdAt: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
}

const bundleTypes = [
  { value: "KIT", label: "Kit" },
  { value: "COMBO", label: "Combo" },
  { value: "ASSEMBLY", label: "Assembly" },
  { value: "VIRTUAL", label: "Virtual" },
];

const pricingTypes = [
  { value: "FIXED", label: "Fixed Price" },
  { value: "COMPONENT_SUM", label: "Sum of Components" },
  { value: "DISCOUNTED", label: "Discounted" },
];

export default function BundlesPage() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    bundleSkuId: "",
    name: "",
    description: "",
    type: "KIT",
    pricingType: "FIXED",
    fixedPrice: "",
    discountPercent: "",
    items: [] as { componentSkuId: string; quantity: number; isOptional: boolean }[],
  });

  const [newItem, setNewItem] = useState({ componentSkuId: "", quantity: 1, isOptional: false });

  // Fetch bundles
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bundles", typeFilter, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/v1/bundles?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch SKUs
  const { data: skusData } = useQuery({
    queryKey: ["skus"],
    queryFn: async () => {
      const res = await fetch("/api/v1/skus?limit=200");
      if (!res.ok) throw new Error("Failed to fetch SKUs");
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/v1/bundles", {
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
      toast.success("Bundle created");
      setShowCreateDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/bundles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Bundle deleted");
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      bundleSkuId: "",
      name: "",
      description: "",
      type: "KIT",
      pricingType: "FIXED",
      fixedPrice: "",
      discountPercent: "",
      items: [],
    });
    setNewItem({ componentSkuId: "", quantity: 1, isOptional: false });
  };

  const addItem = () => {
    if (!newItem.componentSkuId) return;
    if (formData.items.some((i) => i.componentSkuId === newItem.componentSkuId)) {
      toast.error("Component already added");
      return;
    }
    setFormData({
      ...formData,
      items: [...formData.items, { ...newItem }],
    });
    setNewItem({ componentSkuId: "", quantity: 1, isOptional: false });
  };

  const removeItem = (componentSkuId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.componentSkuId !== componentSkuId),
    });
  };

  const bundles: Bundle[] = data?.data || [];
  const skus: SKU[] = skusData?.data || [];
  const totalPages = data?.totalPages || 1;

  const getSkuName = (skuId: string) => {
    const sku = skus.find((s) => s.id === skuId);
    return sku ? `${sku.code} - ${sku.name}` : skuId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SKU Bundles</h1>
          <p className="text-muted-foreground">
            Create and manage product bundles, kits, and combos
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
                Create Bundle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Bundle</DialogTitle>
                <DialogDescription>
                  Create a new product bundle with components
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bundle SKU *</Label>
                    <Select
                      value={formData.bundleSkuId}
                      onValueChange={(v) => setFormData({ ...formData, bundleSkuId: v })}
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
                    <Label>Bundle Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Summer Combo Pack"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bundleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pricing Type</Label>
                    <Select
                      value={formData.pricingType}
                      onValueChange={(v) => setFormData({ ...formData, pricingType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.pricingType === "FIXED" && (
                  <div className="space-y-2">
                    <Label>Fixed Price</Label>
                    <Input
                      type="number"
                      value={formData.fixedPrice}
                      onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                )}
                {formData.pricingType === "DISCOUNTED" && (
                  <div className="space-y-2">
                    <Label>Discount Percent</Label>
                    <Input
                      type="number"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Bundle description..."
                  />
                </div>

                {/* Components */}
                <div className="space-y-2">
                  <Label>Bundle Components *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={newItem.componentSkuId}
                      onValueChange={(v) => setNewItem({ ...newItem, componentSkuId: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select component SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {skus
                          .filter((s) => s.id !== formData.bundleSkuId)
                          .map((sku) => (
                            <SelectItem key={sku.id} value={sku.id}>
                              {sku.code} - {sku.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-20"
                      value={newItem.quantity}
                      onChange={(e) =>
                        setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                      }
                      min={1}
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newItem.isOptional}
                        onCheckedChange={(c) => setNewItem({ ...newItem, isOptional: c })}
                      />
                      <span className="text-sm">Optional</span>
                    </div>
                    <Button type="button" onClick={addItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.items.length > 0 && (
                    <div className="border rounded-lg p-2 space-y-2 mt-2">
                      {formData.items.map((item) => (
                        <div
                          key={item.componentSkuId}
                          className="flex items-center justify-between bg-muted/50 p-2 rounded"
                        >
                          <span className="text-sm">{getSkuName(item.componentSkuId)}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">x{item.quantity}</Badge>
                            {item.isOptional && (
                              <Badge variant="secondary">Optional</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeItem(item.componentSkuId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={
                    !formData.bundleSkuId ||
                    !formData.name ||
                    formData.items.length === 0 ||
                    createMutation.isPending
                  }
                >
                  {createMutation.isPending ? "Creating..." : "Create Bundle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bundles..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {bundleTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
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
          <CardTitle>Bundles</CardTitle>
          <CardDescription>{data?.total || 0} total bundles</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : bundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No bundles found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bundle SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Components</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundles.map((bundle) => (
                    <TableRow key={bundle.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{bundle.bundleSku.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {bundle.bundleSku.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{bundle.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{bundle.type}</Badge>
                      </TableCell>
                      <TableCell>{bundle._count.items} items</TableCell>
                      <TableCell>
                        {bundle.pricingType === "FIXED" && bundle.fixedPrice
                          ? `₹${Number(bundle.fixedPrice).toLocaleString()}`
                          : bundle.pricingType}
                      </TableCell>
                      <TableCell>
                        {bundle.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedBundle(bundle);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Delete this bundle?")) {
                                deleteMutation.mutate(bundle.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bundle Details</DialogTitle>
          </DialogHeader>
          {selectedBundle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Bundle SKU</Label>
                  <p className="font-medium">{selectedBundle.bundleSku.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedBundle.type}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{selectedBundle.name}</p>
              </div>
              {selectedBundle.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedBundle.description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Components</Label>
                <div className="mt-2 space-y-2">
                  {selectedBundle.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-muted/50 p-2 rounded"
                    >
                      <div>
                        <p className="font-medium">{item.componentSku.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.componentSku.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">x{item.quantity}</Badge>
                        {item.isOptional && <Badge variant="secondary">Optional</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
