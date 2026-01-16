"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Layers,
  Palette,
  Ruler,
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
import { toast } from "sonner";

interface SKU {
  id: string;
  code: string;
  name: string;
  mrp: number | null;
  sellingPrice: number | null;
  isActive?: boolean;
}

interface VariantAttribute {
  attributeId: string;
  attributeCode: string;
  attributeName: string;
  attributeType: string;
  valueId: string;
  value: string;
  displayName: string | null;
}

interface Variant {
  id: string;
  variantSku: SKU;
  attributes: VariantAttribute[];
}

interface VariantResponse {
  parentSku: {
    id: string;
    code: string;
    name: string;
    isVariantParent: boolean;
  };
  variants: Variant[];
  total: number;
}

interface AttributeValue {
  id: string;
  value: string;
  displayName: string | null;
  hexCode: string | null;
  sizeOrder: number | null;
}

interface AttributeWithValues {
  id: string;
  code: string;
  name: string;
  type: string;
  values: AttributeValue[];
}

interface AvailableSKU {
  id: string;
  code: string;
  name: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  SIZE: <Ruler className="h-4 w-4" />,
  COLOR: <Palette className="h-4 w-4" />,
  MATERIAL: <Layers className="h-4 w-4" />,
  CUSTOM: <Tag className="h-4 w-4" />,
};

export default function SKUVariantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();

  const [variantData, setVariantData] = useState<VariantResponse | null>(null);
  const [attributes, setAttributes] = useState<AttributeWithValues[]>([]);
  const [availableSKUs, setAvailableSKUs] = useState<AvailableSKU[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAttributeDialogOpen, setIsAttributeDialogOpen] = useState(false);

  // Add variant form
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Add attribute form
  const [newAttribute, setNewAttribute] = useState({
    code: "",
    name: "",
    type: "SIZE",
    values: "",
  });

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const fetchVariants = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/skus/${id}/variants`);
      if (!response.ok) throw new Error("Failed to fetch variants");
      const result = await response.json();
      setVariantData(result);
    } catch (error) {
      console.error("Error fetching variants:", error);
      toast.error("Failed to load variants");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchAttributes = useCallback(async () => {
    try {
      const response = await fetch("/api/variant-attributes");
      if (!response.ok) throw new Error("Failed to fetch attributes");
      const result = await response.json();
      setAttributes(result.data || []);
    } catch (error) {
      console.error("Error fetching attributes:", error);
    }
  }, []);

  const fetchAvailableSKUs = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/skus?limit=100`);
      if (!response.ok) throw new Error("Failed to fetch SKUs");
      const result = await response.json();
      // Filter out current SKU and already linked variants
      const linkedIds = variantData?.variants.map((v) => v.variantSku.id) || [];
      const available = (result.skus || []).filter(
        (sku: AvailableSKU) => sku.id !== id && !linkedIds.includes(sku.id)
      );
      setAvailableSKUs(available);
    } catch (error) {
      console.error("Error fetching SKUs:", error);
    }
  }, [id, variantData]);

  useEffect(() => {
    fetchVariants();
    fetchAttributes();
  }, [fetchVariants, fetchAttributes]);

  useEffect(() => {
    if (isAddDialogOpen) {
      fetchAvailableSKUs();
    }
  }, [isAddDialogOpen, fetchAvailableSKUs]);

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedSkuId) {
      toast.error("Please select a variant SKU");
      return;
    }

    const attributeValueIds = Object.values(selectedAttributes).filter(Boolean);
    if (attributeValueIds.length === 0) {
      toast.error("Please select at least one attribute value");
      return;
    }

    try {
      const response = await fetch(`/api/v1/skus/${id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantSkuId: selectedSkuId,
          attributeValueIds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add variant");
      }

      toast.success("Variant added successfully");
      setIsAddDialogOpen(false);
      setSelectedSkuId("");
      setSelectedAttributes({});
      fetchVariants();
    } catch (error) {
      console.error("Error adding variant:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add variant");
    }
  }

  async function handleDeleteVariant(variantId: string) {
    if (!confirm("Are you sure you want to remove this variant?")) return;

    try {
      const response = await fetch(`/api/v1/skus/${id}/variants?variantId=${variantId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete variant");
      }

      toast.success("Variant removed");
      fetchVariants();
    } catch (error) {
      console.error("Error deleting variant:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete variant");
    }
  }

  async function handleCreateAttribute(e: React.FormEvent) {
    e.preventDefault();

    try {
      // Parse values
      const values = newAttribute.values
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((value) => ({
          value,
          displayName: value,
        }));

      if (values.length === 0) {
        toast.error("Please enter at least one value");
        return;
      }

      const response = await fetch("/api/variant-attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: session?.user?.companyId,
          code: newAttribute.code.toUpperCase(),
          name: newAttribute.name,
          type: newAttribute.type,
          values,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create attribute");
      }

      toast.success("Attribute created");
      setIsAttributeDialogOpen(false);
      setNewAttribute({ code: "", name: "", type: "SIZE", values: "" });
      fetchAttributes();
    } catch (error) {
      console.error("Error creating attribute:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create attribute");
    }
  }

  function getAttributeTypeColor(type: string) {
    switch (type) {
      case "SIZE":
        return "bg-blue-100 text-blue-800";
      case "COLOR":
        return "bg-pink-100 text-pink-800";
      case "MATERIAL":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SKU Variants</h1>
            {variantData?.parentSku && (
              <p className="text-muted-foreground">
                Managing variants for{" "}
                <Badge variant="outline" className="font-mono">
                  {variantData.parentSku.code}
                </Badge>{" "}
                - {variantData.parentSku.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setIsAttributeDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Variant
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Attributes Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Variant Attributes</CardTitle>
          <CardDescription>
            Define attributes like Size, Color, Material for product variants
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attributes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No attributes defined yet. Add attributes to create variants.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {attributes.map((attr) => (
                <Card key={attr.id} className="border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {typeIcons[attr.type] || <Tag className="h-4 w-4" />}
                        {attr.name}
                      </CardTitle>
                      <Badge className={getAttributeTypeColor(attr.type)}>
                        {attr.type}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {attr.code}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {attr.values.slice(0, 8).map((value) => (
                        <Badge key={value.id} variant="secondary" className="text-xs">
                          {attr.type === "COLOR" && value.hexCode && (
                            <span
                              className="w-3 h-3 rounded-full mr-1 inline-block"
                              style={{ backgroundColor: value.hexCode }}
                            />
                          )}
                          {value.displayName || value.value}
                        </Badge>
                      ))}
                      {attr.values.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{attr.values.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variants Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Variants</CardTitle>
              <CardDescription>
                {variantData?.total || 0} variants linked to this SKU
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchVariants}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !variantData?.variants.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No variants defined</p>
              {canManage && (
                <Button
                  variant="link"
                  onClick={() => setIsAddDialogOpen(true)}
                  className="mt-2"
                >
                  Add your first variant
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant SKU</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantData.variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="font-mono">
                          {variant.variantSku.code}
                        </Badge>
                        <p className="text-sm mt-1">{variant.variantSku.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {variant.attributes.map((attr) => (
                          <Badge
                            key={attr.valueId}
                            className={getAttributeTypeColor(attr.attributeType)}
                          >
                            {attr.attributeName}: {attr.displayName || attr.value}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {variant.variantSku.mrp
                        ? `₹${variant.variantSku.mrp.toLocaleString()}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {variant.variantSku.sellingPrice
                        ? `₹${variant.variantSku.sellingPrice.toLocaleString()}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={variant.variantSku.isActive !== false ? "default" : "secondary"}
                      >
                        {variant.variantSku.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVariant(variant.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Variant Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Variant</DialogTitle>
            <DialogDescription>
              Link an existing SKU as a variant with specific attribute values.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddVariant}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Variant SKU *</Label>
                <Select value={selectedSkuId} onValueChange={setSelectedSkuId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a SKU to link as variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSKUs.map((sku) => (
                      <SelectItem key={sku.id} value={sku.id}>
                        {sku.code} - {sku.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {attributes.length > 0 && (
                <div className="space-y-3">
                  <Label>Select Attribute Values *</Label>
                  {attributes.map((attr) => (
                    <div key={attr.id} className="space-y-2">
                      <Label className="text-sm text-muted-foreground flex items-center gap-2">
                        {typeIcons[attr.type]}
                        {attr.name}
                      </Label>
                      <Select
                        value={selectedAttributes[attr.id] || ""}
                        onValueChange={(value) =>
                          setSelectedAttributes({
                            ...selectedAttributes,
                            [attr.id]: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${attr.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {attr.values.map((value) => (
                            <SelectItem key={value.id} value={value.id}>
                              {value.displayName || value.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {attributes.length === 0 && (
                <div className="text-center py-4 text-muted-foreground border rounded-md">
                  <p>No attributes available.</p>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setIsAttributeDialogOpen(true);
                    }}
                  >
                    Create an attribute first
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={attributes.length === 0}>
                Add Variant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Attribute Dialog */}
      <Dialog open={isAttributeDialogOpen} onOpenChange={setIsAttributeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Attribute</DialogTitle>
            <DialogDescription>
              Define a new attribute type like Size, Color, or Material.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAttribute}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attrCode">Code *</Label>
                  <Input
                    id="attrCode"
                    value={newAttribute.code}
                    onChange={(e) =>
                      setNewAttribute({
                        ...newAttribute,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., SIZE"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attrType">Type *</Label>
                  <Select
                    value={newAttribute.type}
                    onValueChange={(value) =>
                      setNewAttribute({ ...newAttribute, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIZE">Size</SelectItem>
                      <SelectItem value="COLOR">Color</SelectItem>
                      <SelectItem value="MATERIAL">Material</SelectItem>
                      <SelectItem value="PATTERN">Pattern</SelectItem>
                      <SelectItem value="STYLE">Style</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attrName">Display Name *</Label>
                <Input
                  id="attrName"
                  value={newAttribute.name}
                  onChange={(e) =>
                    setNewAttribute({ ...newAttribute, name: e.target.value })
                  }
                  placeholder="e.g., Size"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attrValues">Values (comma-separated) *</Label>
                <Input
                  id="attrValues"
                  value={newAttribute.values}
                  onChange={(e) =>
                    setNewAttribute({ ...newAttribute, values: e.target.value })
                  }
                  placeholder="e.g., S, M, L, XL, XXL"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter multiple values separated by commas
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAttributeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Attribute</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
