"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Building2,
  Package,
  ShoppingCart,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Brand {
  id: string;
  code: string;
  name: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  company?: {
    id: string;
    name: string;
  };
  _count?: {
    skus: number;
    orders: number;
  };
}

interface Company {
  id: string;
  code: string;
  name: string;
}

export default function BrandsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    companyId: "",
    description: "",
    website: "",
    contactEmail: "",
    contactPhone: "",
    isActive: true,
  });
  const [previewCode, setPreviewCode] = useState<string>("");

  const canManageBrands = session?.user?.role === "SUPER_ADMIN";

  // Generate brand code preview from name (client-side)
  function generateCodePreview(name: string): string {
    if (!name || name.length < 2) return "";

    // Common words to exclude
    const stopWords = new Set(['the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
      'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc', 'brand', 'brands']);

    // Clean and split the name
    const words = name.replace(/[^a-zA-Z\s]/g, '').toLowerCase().split(/\s+/).filter(w => w);
    const meaningfulWords = words.filter(w => !stopWords.has(w));

    // Use meaningful words, or original if none
    const wordsToUse = meaningfulWords.length > 0 ? meaningfulWords : words;

    let prefix: string;
    if (wordsToUse.length >= 3) {
      // Use first letter of first 3 words
      prefix = wordsToUse.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    } else if (wordsToUse.length === 2) {
      // Use first letter of first word + first 2 letters of second word
      prefix = (wordsToUse[0][0] + wordsToUse[1].slice(0, 2)).toUpperCase();
    } else if (wordsToUse.length === 1) {
      // Use first 3 letters of the word
      prefix = wordsToUse[0].slice(0, 3).toUpperCase();
    } else {
      prefix = 'BRD';
    }

    // Ensure prefix is exactly 3 characters
    prefix = prefix.slice(0, 3).padEnd(3, 'X');

    // Show preview with placeholder sequence
    return `${prefix}-0001`;
  }

  function handleNameChange(name: string) {
    setFormData({ ...formData, name });
    // Generate preview code when creating new brand
    if (!editingBrand) {
      const code = generateCodePreview(name);
      setPreviewCode(code);
    }
  }

  useEffect(() => {
    fetchBrands();
    fetchCompanies();
  }, [selectedCompany]);

  async function fetchBrands() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedCompany && selectedCompany !== "all") {
        params.append("companyId", selectedCompany);
      }
      const response = await fetch(`/api/v1/brands?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch brands");
      const data = await response.json();
      setBrands(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast.error("Failed to load brands");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCompanies() {
    try {
      const response = await fetch("/api/v1/companies");
      if (!response.ok) throw new Error("Failed to fetch companies");
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  }

  const filteredBrands = brands.filter((brand) => {
    const matchesSearch =
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const stats = [
    { label: "Total Brands", value: brands.length.toString(), icon: Users, color: "blue" },
    { label: "Active Brands", value: brands.filter(b => b.isActive).length.toString(), icon: Users, color: "green" },
    { label: "Total SKUs", value: brands.reduce((acc, b) => acc + (b._count?.skus || 0), 0).toLocaleString(), icon: Package, color: "purple" },
    { label: "Total Orders", value: brands.reduce((acc, b) => acc + (b._count?.orders || 0), 0).toLocaleString(), icon: ShoppingCart, color: "orange" },
  ];

  function openCreateDialog() {
    setEditingBrand(null);
    setFormData({
      name: "",
      code: "",
      companyId: companies[0]?.id || "",
      description: "",
      website: "",
      contactEmail: "",
      contactPhone: "",
      isActive: true,
    });
    setPreviewCode("");
    setIsDialogOpen(true);
  }

  function openEditDialog(brand: Brand) {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      code: brand.code,
      companyId: brand.companyId,
      description: brand.description || "",
      website: brand.website || "",
      contactEmail: brand.contactEmail || "",
      contactPhone: brand.contactPhone || "",
      isActive: brand.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.companyId) {
      toast.error("Name and company are required");
      return;
    }

    try {
      setIsSaving(true);
      const url = editingBrand ? `/api/v1/brands/${editingBrand.id}` : "/api/v1/brands";
      const method = editingBrand ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save brand");
      }

      toast.success(editingBrand ? "Brand updated" : "Brand created");
      setIsDialogOpen(false);
      fetchBrands();
    } catch (error) {
      console.error("Error saving brand:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save brand");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(brand: Brand) {
    try {
      const response = await fetch(`/api/v1/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !brand.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update brand");

      toast.success(brand.isActive ? "Brand deactivated" : "Brand activated");
      fetchBrands();
    } catch (error) {
      console.error("Error toggling brand status:", error);
      toast.error("Failed to update brand status");
    }
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`Are you sure you want to delete ${brand.name}?`)) return;

    try {
      const response = await fetch(`/api/v1/brands/${brand.id}`, {
        method: "DELETE",
      });

      // Handle 204 No Content (soft delete success)
      if (response.status === 204 || response.ok) {
        toast.success("Brand deleted");
        fetchBrands();
        return;
      }

      const error = await response.json();
      throw new Error(error.detail || error.error || "Failed to delete brand");
    } catch (error) {
      console.error("Error deleting brand:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete brand");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Clients & Brands Management
          </h1>
          <p className="text-muted-foreground">
            Manage all brands and clients across companies in the OMS Master Panel
          </p>
        </div>
        {canManageBrands && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Brand/Client
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className="rounded-lg p-3"
                style={{
                  backgroundColor:
                    stat.color === "blue"
                      ? "#dbeafe"
                      : stat.color === "green"
                        ? "#dcfce7"
                        : stat.color === "purple"
                          ? "#f3e8ff"
                          : "#ffedd5",
                }}
              >
                <stat.icon
                  className="h-5 w-5"
                  style={{
                    color:
                      stat.color === "blue"
                        ? "#2563eb"
                        : stat.color === "green"
                          ? "#16a34a"
                          : stat.color === "purple"
                            ? "#9333ea"
                            : "#ea580c",
                  }}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Brands Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Brands & Clients</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search brands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No brands found</p>
              {canManageBrands && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first brand
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand/Client</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">SKUs</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{brand.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {brand.code}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{brand.company?.name || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{brand.contactEmail || "-"}</p>
                        <p className="text-sm text-muted-foreground">
                          {brand.contactPhone || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {brand._count?.skus || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {(brand._count?.orders || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={brand.isActive ? "default" : "secondary"}
                        className={brand.isActive ? "bg-green-100 text-green-700" : ""}
                      >
                        {brand.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/master/brands/${brand.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canManageBrands && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(brand)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Brand
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(brand)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {brand.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/settings/skus?brandId=${brand.id}`)}>
                                <Package className="mr-2 h-4 w-4" />
                                Manage SKUs
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/orders?brandId=${brand.id}`)}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                View Orders
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(brand)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Brand
                              </DropdownMenuItem>
                            </>
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

      {/* Brand Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Edit Brand" : "Create Brand"}
            </DialogTitle>
            <DialogDescription>
              {editingBrand
                ? "Update the brand details below."
                : "Fill in the details to create a new brand/client."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Brand Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Enter brand name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code">Brand Code {editingBrand && "*"}</Label>
                  <Input
                    id="code"
                    value={editingBrand ? formData.code : (previewCode || "")}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required={!!editingBrand}
                    readOnly={!editingBrand}
                    className={!editingBrand ? "bg-muted font-mono text-blue-600 font-semibold" : "font-mono"}
                    placeholder={editingBrand ? "Brand code" : "Type name to generate"}
                  />
                  {!editingBrand && previewCode && (
                    <p className="text-xs text-green-600 font-medium">Preview: {previewCode}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company *</Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingBrand ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
