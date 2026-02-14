"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  Upload,
  Download,
  IndianRupee,
  Package,
  MapPin,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { exportToCSV, type ExportColumn } from "@/lib/utils";

interface PTLRateMatrix {
  id: string;
  vendorId: string;
  vendorName: string;
  originZone: string;
  destinationZone: string;
  minWeightKg: number;
  maxWeightKg: number;
  ratePerKg: number;
  minCharge: number;
  fuelSurchargePercent: number;
  odaCharge: number;
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

const ZONES = [
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "CENTRAL",
  "NORTHEAST",
  "LOCAL",
  "METRO",
  "REST_OF_INDIA",
];

const WEIGHT_SLABS = [
  { min: 0, max: 5, label: "0-5 kg" },
  { min: 5, max: 10, label: "5-10 kg" },
  { min: 10, max: 20, label: "10-20 kg" },
  { min: 20, max: 50, label: "20-50 kg" },
  { min: 50, max: 100, label: "50-100 kg" },
  { min: 100, max: 500, label: "100-500 kg" },
  { min: 500, max: 1000, label: "500-1000 kg" },
];

export default function PTLRateMatrixPage() {
  const [rates, setRates] = useState<PTLRateMatrix[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<PTLRateMatrix | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: "",
    originZone: "",
    destinationZone: "",
    minWeightKg: "",
    maxWeightKg: "",
    ratePerKg: "",
    minCharge: "",
    fuelSurchargePercent: "",
    odaCharge: "",
    validFrom: "",
    validTo: "",
    isActive: true,
  });

  const fetchRates = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (vendorFilter) params.set("vendor_id", vendorFilter);
      if (originFilter) params.set("origin_zone", originFilter);
      if (destinationFilter) params.set("destination_zone", destinationFilter);
      params.set("limit", "200");

      const response = await fetch(`/api/v1/ptl/rate-matrix?${params}`);
      if (!response.ok) throw new Error("Failed to fetch rates");
      const result = await response.json();
      setRates(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching rates:", error);
      toast.error("Failed to load rates");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, vendorFilter, originFilter, destinationFilter]);

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/v1/transporters?is_active=true&limit=100");
      if (!response.ok) throw new Error("Failed to fetch vendors");
      const result = await response.json();
      setVendors(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  function resetForm() {
    setFormData({
      vendorId: "",
      originZone: "",
      destinationZone: "",
      minWeightKg: "",
      maxWeightKg: "",
      ratePerKg: "",
      minCharge: "",
      fuelSurchargePercent: "",
      odaCharge: "",
      validFrom: "",
      validTo: "",
      isActive: true,
    });
    setEditingRate(null);
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(rate: PTLRateMatrix) {
    setEditingRate(rate);
    setFormData({
      vendorId: rate.vendorId,
      originZone: rate.originZone,
      destinationZone: rate.destinationZone,
      minWeightKg: rate.minWeightKg.toString(),
      maxWeightKg: rate.maxWeightKg.toString(),
      ratePerKg: rate.ratePerKg.toString(),
      minCharge: rate.minCharge.toString(),
      fuelSurchargePercent: rate.fuelSurchargePercent.toString(),
      odaCharge: rate.odaCharge.toString(),
      validFrom: rate.validFrom?.split("T")[0] || "",
      validTo: rate.validTo?.split("T")[0] || "",
      isActive: rate.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.vendorId || !formData.originZone || !formData.destinationZone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        vendor_id: formData.vendorId,
        origin_zone: formData.originZone,
        destination_zone: formData.destinationZone,
        min_weight_kg: parseFloat(formData.minWeightKg) || 0,
        max_weight_kg: parseFloat(formData.maxWeightKg) || 0,
        rate_per_kg: parseFloat(formData.ratePerKg) || 0,
        min_charge: parseFloat(formData.minCharge) || 0,
        fuel_surcharge_percent: parseFloat(formData.fuelSurchargePercent) || 0,
        oda_charge: parseFloat(formData.odaCharge) || 0,
        valid_from: formData.validFrom || null,
        valid_to: formData.validTo || null,
        is_active: formData.isActive,
      };

      const url = editingRate
        ? `/api/v1/ptl/rate-matrix/${editingRate.id}`
        : "/api/v1/ptl/rate-matrix";
      const method = editingRate ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save rate");
      toast.success(editingRate ? "Rate updated" : "Rate created");
      setIsDialogOpen(false);
      resetForm();
      fetchRates();
    } catch (error) {
      console.error("Error saving rate:", error);
      toast.error("Failed to save rate");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(rate: PTLRateMatrix) {
    if (!confirm("Are you sure you want to delete this rate?")) return;

    try {
      const response = await fetch(`/api/v1/ptl/rate-matrix/${rate.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rate");
      toast.success("Rate deleted");
      fetchRates();
    } catch (error) {
      console.error("Error deleting rate:", error);
      toast.error("Failed to delete rate");
    }
  }

  async function handleToggleActive(rate: PTLRateMatrix) {
    try {
      const response = await fetch(`/api/v1/ptl/rate-matrix/${rate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rate.isActive }),
      });
      if (!response.ok) throw new Error("Failed to update rate");
      toast.success(rate.isActive ? "Rate deactivated" : "Rate activated");
      fetchRates();
    } catch (error) {
      console.error("Error toggling rate:", error);
      toast.error("Failed to update rate");
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatWeight(minKg: number, maxKg: number): string {
    return `${minKg}-${maxKg} kg`;
  }

  // Export rate matrix to CSV
  const handleExport = () => {
    if (rates.length === 0) {
      toast.error("No data to export");
      return;
    }
    const columns: ExportColumn[] = [
      { key: "vendorName", header: "Vendor" },
      { key: "originZone", header: "Origin Zone" },
      { key: "destinationZone", header: "Destination Zone" },
      { key: "minWeightKg", header: "Min Weight (kg)" },
      { key: "maxWeightKg", header: "Max Weight (kg)" },
      { key: "ratePerKg", header: "Rate/kg (INR)" },
      { key: "minCharge", header: "Min Charge (INR)" },
      { key: "fuelSurchargePercent", header: "Fuel Surcharge %" },
      { key: "odaCharge", header: "ODA Charge (INR)" },
      { key: "isActive", header: "Status", formatter: (v) => v ? "Active" : "Inactive" },
      { key: "validFrom", header: "Valid From", formatter: (v) => v ? new Date(v).toLocaleDateString() : "" },
      { key: "validTo", header: "Valid To", formatter: (v) => v ? new Date(v).toLocaleDateString() : "" },
    ];
    exportToCSV(rates, columns, "ptl_rate_matrix");
    toast.success("Rate matrix exported successfully");
  };

  // Stats
  const stats = {
    total: rates.length,
    active: rates.filter((r) => r.isActive).length,
    vendors: new Set(rates.map((r) => r.vendorId)).size,
    lanes: new Set(rates.map((r) => `${r.originZone}-${r.destinationZone}`)).size,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PTL Rate Matrix</h1>
          <p className="text-muted-foreground">
            Manage N×N origin-destination rate matrix for PTL shipments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rate
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Rates</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rates</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendors</p>
                <p className="text-2xl font-bold">{stats.vendors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Lanes</p>
                <p className="text-2xl font-bold">{stats.lanes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Origin Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Origins</SelectItem>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={destinationFilter} onValueChange={setDestinationFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Dest Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Destinations</SelectItem>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
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
          <CardTitle>Rate Matrix</CardTitle>
          <CardDescription>
            {rates.length} rate(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Weight Slab</TableHead>
                <TableHead>Rate/kg</TableHead>
                <TableHead>Min Charge</TableHead>
                <TableHead>Fuel %</TableHead>
                <TableHead>ODA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No rates found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className="font-medium">{rate.vendorName}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.originZone}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.destinationZone}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatWeight(rate.minWeightKg, rate.maxWeightKg)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(rate.ratePerKg)}
                    </TableCell>
                    <TableCell>{formatCurrency(rate.minCharge)}</TableCell>
                    <TableCell>{rate.fuelSurchargePercent}%</TableCell>
                    <TableCell>{formatCurrency(rate.odaCharge)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={rate.isActive ? "default" : "secondary"}
                        className={
                          rate.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {rate.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(rate)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(rate)}>
                            {rate.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(rate)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Rate" : "Add Rate"}
            </DialogTitle>
            <DialogDescription>
              {editingRate
                ? "Update the PTL rate configuration"
                : "Add a new rate entry to the matrix"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Vendor *</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vendorId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Origin Zone *</Label>
                <Select
                  value={formData.originZone}
                  onValueChange={(value) =>
                    setFormData({ ...formData, originZone: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Destination Zone *</Label>
                <Select
                  value={formData.destinationZone}
                  onValueChange={(value) =>
                    setFormData({ ...formData, destinationZone: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Min Weight (kg) *</Label>
                <Input
                  type="number"
                  value={formData.minWeightKg}
                  onChange={(e) =>
                    setFormData({ ...formData, minWeightKg: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>Max Weight (kg) *</Label>
                <Input
                  type="number"
                  value={formData.maxWeightKg}
                  onChange={(e) =>
                    setFormData({ ...formData, maxWeightKg: e.target.value })
                  }
                  placeholder="100"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Pricing</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <Label>Rate/kg (INR) *</Label>
                  <Input
                    type="number"
                    value={formData.ratePerKg}
                    onChange={(e) =>
                      setFormData({ ...formData, ratePerKg: e.target.value })
                    }
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Min Charge</Label>
                  <Input
                    type="number"
                    value={formData.minCharge}
                    onChange={(e) =>
                      setFormData({ ...formData, minCharge: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Fuel Surcharge %</Label>
                  <Input
                    type="number"
                    value={formData.fuelSurchargePercent}
                    onChange={(e) =>
                      setFormData({ ...formData, fuelSurchargePercent: e.target.value })
                    }
                    placeholder="0"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>ODA Charge</Label>
                  <Input
                    type="number"
                    value={formData.odaCharge}
                    onChange={(e) =>
                      setFormData({ ...formData, odaCharge: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Validity</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Valid From</Label>
                  <Input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, validFrom: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Valid To</Label>
                  <Input
                    type="date"
                    value={formData.validTo}
                    onChange={(e) =>
                      setFormData({ ...formData, validTo: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingRate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
