"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Truck,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  XCircle,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FTLVendor {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  paymentTermDays: number;
  defaultTATDays: number;
  reliabilityScore: number | null;
  isActive: boolean;
  createdAt: string;
}

export default function FTLVendorsPage() {
  const [vendors, setVendors] = useState<FTLVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<FTLVendor | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    panNumber: "",
    paymentTermDays: 30,
    creditLimit: "",
    defaultTATDays: 3,
    isActive: true,
  });

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/ftl/vendors?${params}`);
      if (!response.ok) throw new Error("Failed to fetch vendors");
      const result = await response.json();
      setVendors(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      toast.error("Failed to load FTL vendors");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVendors();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchVendors]);

  function openCreateDialog() {
    setEditingVendor(null);
    setFormData({
      code: "",
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gstNumber: "",
      panNumber: "",
      paymentTermDays: 30,
      creditLimit: "",
      defaultTATDays: 3,
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(vendor: FTLVendor) {
    setEditingVendor(vendor);
    setFormData({
      code: vendor.code,
      name: vendor.name,
      contactPerson: vendor.contactPerson || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: "",
      city: vendor.city || "",
      state: vendor.state || "",
      pincode: "",
      gstNumber: vendor.gstNumber || "",
      panNumber: "",
      paymentTermDays: vendor.paymentTermDays,
      creditLimit: "",
      defaultTATDays: vendor.defaultTATDays,
      isActive: vendor.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const url = editingVendor
        ? `/api/v1/ftl/vendors/${editingVendor.id}`
        : "/api/v1/ftl/vendors";
      const method = editingVendor ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          contactPerson: formData.contactPerson || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          pincode: formData.pincode || null,
          gstNumber: formData.gstNumber || null,
          panNumber: formData.panNumber || null,
          paymentTermDays: formData.paymentTermDays,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
          defaultTATDays: formData.defaultTATDays,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save vendor");
      }

      toast.success(
        editingVendor
          ? "Vendor updated successfully"
          : "Vendor created successfully"
      );
      setIsDialogOpen(false);
      fetchVendors();
    } catch (error) {
      console.error("Error saving vendor:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save vendor");
    }
  }

  async function handleToggleActive(vendor: FTLVendor) {
    try {
      const response = await fetch(`/api/v1/ftl/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update vendor");

      toast.success(`Vendor ${vendor.isActive ? "deactivated" : "activated"}`);
      fetchVendors();
    } catch (error) {
      console.error("Error toggling vendor:", error);
      toast.error("Failed to update vendor");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FTL Vendors</h1>
          <p className="text-muted-foreground">
            Manage Full Truck Load transport vendors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchVendors}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <CardHeader>
          <CardTitle>FTL Vendors</CardTitle>
          <CardDescription>
            {vendors.length} vendor(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No FTL vendors configured</p>
              <Button variant="link" onClick={openCreateDialog}>
                Add your first vendor
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>TAT</TableHead>
                  <TableHead>Reliability</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Truck className="h-4 w-4 text-orange-600" />
                        </div>
                        <span className="font-medium">{vendor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vendor.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {vendor.contactPerson && (
                          <div className="text-sm">{vendor.contactPerson}</div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.city && (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {vendor.city}{vendor.state && `, ${vendor.state}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{vendor.paymentTermDays} days</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{vendor.defaultTATDays} days</span>
                    </TableCell>
                    <TableCell>
                      {vendor.reliabilityScore !== null ? (
                        <Badge
                          variant={vendor.reliabilityScore >= 80 ? "default" : vendor.reliabilityScore >= 60 ? "secondary" : "destructive"}
                          className={
                            vendor.reliabilityScore >= 80
                              ? "bg-green-100 text-green-800"
                              : vendor.reliabilityScore >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {vendor.reliabilityScore}%
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={vendor.isActive ? "default" : "secondary"}
                        className={
                          vendor.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {vendor.isActive ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(vendor)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(vendor)}
                          >
                            {vendor.isActive ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? "Edit FTL Vendor" : "Add FTL Vendor"}
            </DialogTitle>
            <DialogDescription>
              Configure full truck load transport vendor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Vendor Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g., VRL001"
                  disabled={!!editingVendor}
                />
              </div>
              <div className="grid gap-2">
                <Label>Vendor Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., VRL Logistics"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Contact Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Contact Person</Label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))
                    }
                    placeholder="Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="9876543210"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="vendor@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Address</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Full address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>City</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="City"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>State</Label>
                    <Input
                      value={formData.state}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, state: e.target.value }))
                      }
                      placeholder="State"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Pincode</Label>
                    <Input
                      value={formData.pincode}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, pincode: e.target.value }))
                      }
                      placeholder="400001"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Business Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>GST Number</Label>
                  <Input
                    value={formData.gstNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
                    }
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>PAN Number</Label>
                  <Input
                    value={formData.panNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, panNumber: e.target.value.toUpperCase() }))
                    }
                    placeholder="AAAAA0000A"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Payment & Service Terms</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Payment Terms (Days)</Label>
                  <Input
                    type="number"
                    value={formData.paymentTermDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentTermDays: parseInt(e.target.value) || 30 }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Credit Limit</Label>
                  <Input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, creditLimit: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Default TAT (Days)</Label>
                  <Input
                    type="number"
                    value={formData.defaultTATDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, defaultTATDays: parseInt(e.target.value) || 3 }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.code || !formData.name}
            >
              {editingVendor ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
