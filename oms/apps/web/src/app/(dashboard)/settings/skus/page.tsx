"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Package,
  Filter,
  X,
  Barcode,
  Copy,
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

interface SKU {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  hsn: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  mrp: number | null;
  costPrice: number | null;
  sellingPrice: number | null;
  taxRate: number | null;
  isSerialised: boolean;
  isBatchTracked: boolean;
  barcodes: string[];
  images: string[];
  createdAt: string;
}

interface SKUResponse {
  skus: SKU[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    categories: string[];
    brands: string[];
  };
}

const initialFormData = {
  code: "",
  name: "",
  description: "",
  category: "",
  brand: "",
  hsn: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  mrp: "",
  costPrice: "",
  sellingPrice: "",
  taxRate: "",
  isSerialised: false,
  isBatchTracked: false,
  barcodes: "",
};

export default function SKUMasterPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<SKUResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<SKU | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [page, setPage] = useState(1);

  const canManageSKUs = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const fetchSKUs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (brandFilter) params.set("brand", brandFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/v1/skus?${params}`);
      if (!response.ok) throw new Error("Failed to fetch SKUs");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching SKUs:", error);
      toast.error("Failed to load SKUs");
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, brandFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchSKUs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchSKUs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingSku ? `/api/v1/skus/${editingSku.id}` : "/api/v1/skus";
      const method = editingSku ? "PATCH" : "POST";

      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        brand: formData.brand || null,
        hsn: formData.hsn || null,
        weight: formData.weight || null,
        length: formData.length || null,
        width: formData.width || null,
        height: formData.height || null,
        mrp: formData.mrp || null,
        costPrice: formData.costPrice || null,
        sellingPrice: formData.sellingPrice || null,
        taxRate: formData.taxRate || null,
        isSerialised: formData.isSerialised,
        isBatchTracked: formData.isBatchTracked,
        barcodes: formData.barcodes
          ? formData.barcodes.split(",").map((b) => b.trim())
          : [],
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save SKU");
      }

      toast.success(editingSku ? "SKU updated" : "SKU created");
      setIsDialogOpen(false);
      setEditingSku(null);
      setFormData(initialFormData);
      fetchSKUs();
    } catch (error) {
      console.error("Error saving SKU:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save SKU");
    }
  }

  async function handleDelete(sku: SKU) {
    if (!confirm(`Are you sure you want to delete ${sku.name}?`)) return;

    try {
      const response = await fetch(`/api/v1/v1/skus/${sku.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete SKU");
      }

      toast.success("SKU deleted");
      fetchSKUs();
    } catch (error) {
      console.error("Error deleting SKU:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete SKU"
      );
    }
  }

  function openEditDialog(sku: SKU) {
    setEditingSku(sku);
    setFormData({
      code: sku.code,
      name: sku.name,
      description: sku.description || "",
      category: sku.category || "",
      brand: sku.brand || "",
      hsn: sku.hsn || "",
      weight: sku.weight?.toString() || "",
      length: sku.length?.toString() || "",
      width: sku.width?.toString() || "",
      height: sku.height?.toString() || "",
      mrp: sku.mrp?.toString() || "",
      costPrice: sku.costPrice?.toString() || "",
      sellingPrice: sku.sellingPrice?.toString() || "",
      taxRate: sku.taxRate?.toString() || "",
      isSerialised: sku.isSerialised,
      isBatchTracked: sku.isBatchTracked,
      barcodes: sku.barcodes.join(", "),
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingSku(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setBrandFilter("");
    setPage(1);
  }

  const hasFilters = search || categoryFilter || brandFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU Master</h1>
          <p className="text-muted-foreground">
            Manage products and item master data
          </p>
        </div>
        {canManageSKUs && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add SKU
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, or barcode..."
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
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {data?.filters.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={brandFilter}
                onValueChange={(value) => {
                  setBrandFilter(value === "all" ? "" : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {data?.filters.brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
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

      {/* SKU Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {data?.total || 0} SKUs found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.skus.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No SKUs match your filters" : "No SKUs found"}
              </p>
              {canManageSKUs && !hasFilters && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first SKU
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {sku.code}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(sku.code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {sku.barcodes.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Barcode className="h-3 w-3" />
                            {sku.barcodes[0]}
                            {sku.barcodes.length > 1 && (
                              <span>+{sku.barcodes.length - 1}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{sku.name}</div>
                        {sku.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {sku.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{sku.category || "-"}</TableCell>
                      <TableCell>{sku.brand || "-"}</TableCell>
                      <TableCell className="text-right">
                        {sku.mrp ? `₹${sku.mrp.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {sku.sellingPrice
                          ? `₹${sku.sellingPrice.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {sku.isSerialised && (
                            <Badge variant="secondary" className="text-xs">
                              Serial
                            </Badge>
                          )}
                          {sku.isBatchTracked && (
                            <Badge variant="secondary" className="text-xs">
                              Batch
                            </Badge>
                          )}
                          {!sku.isSerialised && !sku.isBatchTracked && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageSKUs && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditDialog(sku)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {session?.user?.role === "SUPER_ADMIN" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(sku)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* SKU Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSku ? "Edit SKU" : "Create SKU"}</DialogTitle>
            <DialogDescription>
              {editingSku
                ? "Update the product details below."
                : "Fill in the details to create a new SKU."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="tracking">Tracking</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="code">SKU Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="e.g., SKU-001"
                      disabled={!!editingSku}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="hsn">HSN Code</Label>
                    <Input
                      id="hsn"
                      value={formData.hsn}
                      onChange={(e) =>
                        setFormData({ ...formData, hsn: e.target.value })
                      }
                      placeholder="e.g., 61091000"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Blue Cotton T-Shirt (M)"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Product description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="e.g., Apparel"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData({ ...formData, brand: e.target.value })
                      }
                      placeholder="e.g., Nike"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="barcodes">Barcodes (comma-separated)</Label>
                  <Input
                    id="barcodes"
                    value={formData.barcodes}
                    onChange={(e) =>
                      setFormData({ ...formData, barcodes: e.target.value })
                    }
                    placeholder="e.g., 8901234567890, 8901234567891"
                  />
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="mrp">MRP (₹)</Label>
                    <Input
                      id="mrp"
                      type="number"
                      step="0.01"
                      value={formData.mrp}
                      onChange={(e) =>
                        setFormData({ ...formData, mrp: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="costPrice">Cost Price (₹)</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sellingPrice: e.target.value,
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.01"
                      value={formData.taxRate}
                      onChange={(e) =>
                        setFormData({ ...formData, taxRate: e.target.value })
                      }
                      placeholder="e.g., 18"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="weight">Weight (grams)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                      placeholder="e.g., 200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dimensions (cm)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.length}
                      onChange={(e) =>
                        setFormData({ ...formData, length: e.target.value })
                      }
                      placeholder="Length"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.width}
                      onChange={(e) =>
                        setFormData({ ...formData, width: e.target.value })
                      }
                      placeholder="Width"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: e.target.value })
                      }
                      placeholder="Height"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tracking" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isSerialised"
                      checked={formData.isSerialised}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isSerialised: checked as boolean,
                        })
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="isSerialised">Serial Number Tracking</Label>
                      <p className="text-sm text-muted-foreground">
                        Track individual items by unique serial numbers (e.g.,
                        electronics, high-value items)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isBatchTracked"
                      checked={formData.isBatchTracked}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          isBatchTracked: checked as boolean,
                        })
                      }
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="isBatchTracked">Batch/Lot Tracking</Label>
                      <p className="text-sm text-muted-foreground">
                        Track items by batch/lot number with expiry dates (e.g.,
                        food, pharmaceuticals)
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">{editingSku ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
