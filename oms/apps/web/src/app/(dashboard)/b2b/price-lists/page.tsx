"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  DollarSign,
  Calendar,
  Users,
  Package,
  Tag,
  RefreshCw,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

interface PriceList {
  id: string;
  code: string;
  name: string;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  basedOnMRP: boolean;
  roundingMethod: string | null;
  isActive: boolean;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "SCHEDULED";
  company: {
    id: string;
    name: string;
  };
  _count: {
    items: number;
    customers: number;
    customerGroups: number;
  };
}

interface SKU {
  id: string;
  code: string;
  name: string;
  mrp: number | null;
  sellingPrice: number | null;
}

interface PriceListItem {
  skuId: string;
  fixedPrice: string;
  discountPercent: string;
  markup: string;
  minOrderQty: string;
  maxOrderQty: string;
}

const initialFormData = {
  code: "",
  name: "",
  description: "",
  effectiveFrom: "",
  effectiveTo: "",
  basedOnMRP: false,
  roundingMethod: "",
  isActive: true,
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  EXPIRED: "bg-red-100 text-red-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
};

export default function PriceListsPage() {
  const { data: session } = useSession();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [priceItems, setPriceItems] = useState<PriceListItem[]>([]);
  const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
  });

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const fetchPriceLists = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/price-lists?limit=100");
      if (!response.ok) throw new Error("Failed to fetch price lists");
      const result = await response.json();
      setPriceLists(result.data || []);

      // Calculate stats
      const data = result.data || [];
      setStats({
        total: data.length,
        active: data.filter((p: PriceList) => p.status === "ACTIVE").length,
        scheduled: data.filter((p: PriceList) => p.status === "SCHEDULED").length,
        expired: data.filter((p: PriceList) => p.status === "EXPIRED").length,
      });
    } catch (error) {
      console.error("Error fetching price lists:", error);
      toast.error("Failed to load price lists");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSKUs = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/skus?limit=500");
      if (!response.ok) throw new Error("Failed to fetch SKUs");
      const result = await response.json();
      setSKUs(result.skus || []);
    } catch (error) {
      console.error("Error fetching SKUs:", error);
    }
  }, []);

  useEffect(() => {
    fetchPriceLists();
    fetchSKUs();
  }, [fetchPriceLists, fetchSKUs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingPriceList
        ? `/api/v1/price-lists/${editingPriceList.id}`
        : "/api/v1/price-lists";
      const method = editingPriceList ? "PATCH" : "POST";

      const payload = {
        companyId: session?.user?.companyId,
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null,
        basedOnMRP: formData.basedOnMRP,
        roundingMethod: formData.roundingMethod || null,
        isActive: formData.isActive,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save price list");
      }

      toast.success(editingPriceList ? "Price list updated" : "Price list created");
      setIsDialogOpen(false);
      setEditingPriceList(null);
      setFormData(initialFormData);
      fetchPriceLists();
    } catch (error) {
      console.error("Error saving price list:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save price list"
      );
    }
  }

  async function handleDelete(priceList: PriceList) {
    if (!confirm(`Are you sure you want to delete "${priceList.name}"?`)) return;

    try {
      const response = await fetch(`/api/v1/price-lists/${priceList.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete price list");
      }

      toast.success("Price list deleted");
      fetchPriceLists();
    } catch (error) {
      console.error("Error deleting price list:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete price list"
      );
    }
  }

  async function handleSaveItems() {
    if (!selectedPriceList) return;

    try {
      const validItems = priceItems.filter((item) => item.skuId);

      const response = await fetch(`/api/v1/price-lists/${selectedPriceList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((item) => ({
            skuId: item.skuId,
            fixedPrice: item.fixedPrice || null,
            discountPercent: item.discountPercent || null,
            markup: item.markup || null,
            minOrderQty: item.minOrderQty ? parseInt(item.minOrderQty) : null,
            maxOrderQty: item.maxOrderQty ? parseInt(item.maxOrderQty) : null,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save items");
      }

      toast.success("Price list items saved");
      setIsItemsDialogOpen(false);
      setSelectedPriceList(null);
      setPriceItems([]);
      fetchPriceLists();
    } catch (error) {
      console.error("Error saving items:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save items"
      );
    }
  }

  async function openItemsDialog(priceList: PriceList) {
    setSelectedPriceList(priceList);

    try {
      const response = await fetch(`/api/v1/price-lists/${priceList.id}`);
      if (!response.ok) throw new Error("Failed to fetch price list");
      const data = await response.json();

      // Map existing items
      const existingItems = (data.items || []).map(
        (item: {
          skuId: string;
          fixedPrice: number | null;
          discountPercent: number | null;
          markup: number | null;
          minOrderQty: number | null;
          maxOrderQty: number | null;
        }) => ({
          skuId: item.skuId,
          fixedPrice: item.fixedPrice?.toString() || "",
          discountPercent: item.discountPercent?.toString() || "",
          markup: item.markup?.toString() || "",
          minOrderQty: item.minOrderQty?.toString() || "",
          maxOrderQty: item.maxOrderQty?.toString() || "",
        })
      );

      setPriceItems(
        existingItems.length > 0
          ? existingItems
          : [
              {
                skuId: "",
                fixedPrice: "",
                discountPercent: "",
                markup: "",
                minOrderQty: "",
                maxOrderQty: "",
              },
            ]
      );
      setIsItemsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching price list:", error);
      toast.error("Failed to load price list items");
    }
  }

  function openEditDialog(priceList: PriceList) {
    setEditingPriceList(priceList);
    setFormData({
      code: priceList.code,
      name: priceList.name,
      description: priceList.description || "",
      effectiveFrom: priceList.effectiveFrom.split("T")[0],
      effectiveTo: priceList.effectiveTo?.split("T")[0] || "",
      basedOnMRP: priceList.basedOnMRP,
      roundingMethod: priceList.roundingMethod || "",
      isActive: priceList.isActive,
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingPriceList(null);
    setFormData({
      ...initialFormData,
      effectiveFrom: new Date().toISOString().split("T")[0],
    });
    setIsDialogOpen(true);
  }

  function addPriceItem() {
    setPriceItems([
      ...priceItems,
      {
        skuId: "",
        fixedPrice: "",
        discountPercent: "",
        markup: "",
        minOrderQty: "",
        maxOrderQty: "",
      },
    ]);
  }

  function removePriceItem(index: number) {
    setPriceItems(priceItems.filter((_, i) => i !== index));
  }

  function updatePriceItem(index: number, field: keyof PriceListItem, value: string) {
    const updated = [...priceItems];
    updated[index] = { ...updated[index], [field]: value };
    setPriceItems(updated);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Price Lists</h1>
          <p className="text-muted-foreground">
            Manage B2B pricing, discounts, and tiered pricing
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Price List
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Price Lists</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Price Lists Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Price Lists</CardTitle>
              <CardDescription>
                {priceLists.length} price list(s) configured
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPriceLists}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : priceLists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No price lists found</p>
              {canManage && (
                <Button variant="link" onClick={openCreateDialog}>
                  Create your first price list
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Effective Period</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceLists.map((priceList) => (
                  <TableRow key={priceList.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {priceList.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{priceList.name}</div>
                      {priceList.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {priceList.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(priceList.effectiveFrom), "dd MMM yyyy")}
                      </div>
                      {priceList.effectiveTo && (
                        <div className="text-xs text-muted-foreground">
                          to {format(new Date(priceList.effectiveTo), "dd MMM yyyy")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {priceList._count.items}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {priceList._count.customers + priceList._count.customerGroups}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[priceList.status]}>
                        {priceList.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openItemsDialog(priceList)}>
                              <Package className="mr-2 h-4 w-4" />
                              Manage Items
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(priceList)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {session?.user?.role === "SUPER_ADMIN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(priceList)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPriceList ? "Edit Price List" : "Create Price List"}
            </DialogTitle>
            <DialogDescription>
              {editingPriceList
                ? "Update the price list details."
                : "Configure a new price list for B2B customers."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., PL-2024-Q1"
                    disabled={!!editingPriceList}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roundingMethod">Rounding</Label>
                  <Select
                    value={formData.roundingMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, roundingMethod: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="ROUND_UP">Round Up</SelectItem>
                      <SelectItem value="ROUND_DOWN">Round Down</SelectItem>
                      <SelectItem value="ROUND_NEAREST">Round Nearest</SelectItem>
                      <SelectItem value="ROUND_99">End in .99</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Wholesale Pricing Q1 2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Price list description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effectiveFrom">Effective From *</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, effectiveFrom: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effectiveTo">Effective To</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) =>
                      setFormData({ ...formData, effectiveTo: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="basedOnMRP"
                    checked={formData.basedOnMRP}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, basedOnMRP: checked as boolean })
                    }
                  />
                  <Label htmlFor="basedOnMRP" className="font-normal">
                    Calculate discounts based on MRP (instead of selling price)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked as boolean })
                    }
                  />
                  <Label htmlFor="isActive" className="font-normal">
                    Active
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingPriceList ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Items Management Dialog */}
      <Dialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Items - {selectedPriceList?.name}
            </DialogTitle>
            <DialogDescription>
              Configure pricing for individual SKUs. You can set fixed prices,
              percentage discounts, or markup from base price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addPriceItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add SKU
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">SKU</TableHead>
                  <TableHead>Fixed Price</TableHead>
                  <TableHead>Discount %</TableHead>
                  <TableHead>Markup %</TableHead>
                  <TableHead>Min Qty</TableHead>
                  <TableHead>Max Qty</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={item.skuId}
                        onValueChange={(value) =>
                          updatePriceItem(index, "skuId", value)
                        }
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
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.fixedPrice}
                        onChange={(e) =>
                          updatePriceItem(index, "fixedPrice", e.target.value)
                        }
                        placeholder="0.00"
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.discountPercent}
                        onChange={(e) =>
                          updatePriceItem(index, "discountPercent", e.target.value)
                        }
                        placeholder="0"
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.markup}
                        onChange={(e) =>
                          updatePriceItem(index, "markup", e.target.value)
                        }
                        placeholder="0"
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.minOrderQty}
                        onChange={(e) =>
                          updatePriceItem(index, "minOrderQty", e.target.value)
                        }
                        placeholder="1"
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.maxOrderQty}
                        onChange={(e) =>
                          updatePriceItem(index, "maxOrderQty", e.target.value)
                        }
                        placeholder="No limit"
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePriceItem(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {priceItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No items added. Click &quot;Add SKU&quot; to configure pricing.
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsItemsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveItems}>Save Items</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
