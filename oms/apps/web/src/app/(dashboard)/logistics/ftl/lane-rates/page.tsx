"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  RefreshCw,
  ArrowRight,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
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

interface LaneRate {
  id: string;
  originCity: string;
  originState: string | null;
  destinationCity: string;
  destinationState: string | null;
  distanceKm: number | null;
  baseRate: number;
  perKmRate: number | null;
  loadingCharges: number | null;
  unloadingCharges: number | null;
  tollCharges: number | null;
  transitDays: number;
  vehicleTypeId: string;
  vendorId: string;
  vehicleTypeName: string | null;
  vendorName: string | null;
  isActive: boolean;
  validFrom: string;
  validTo: string | null;
}

interface VehicleType {
  id: string;
  code: string;
  name: string;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

export default function LaneRatesPage() {
  const [laneRates, setLaneRates] = useState<LaneRate[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<LaneRate | null>(null);

  // Filters
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState("");

  const [formData, setFormData] = useState({
    originCity: "",
    originState: "",
    destinationCity: "",
    destinationState: "",
    distanceKm: "",
    baseRate: "",
    perKmRate: "",
    loadingCharges: "",
    unloadingCharges: "",
    tollCharges: "",
    transitDays: 1,
    vehicleTypeId: "",
    vendorId: "",
    isActive: true,
  });

  const fetchLaneRates = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (filterOrigin) params.set("origin_city", filterOrigin);
      if (filterDestination) params.set("destination_city", filterDestination);
      if (filterVendor) params.set("vendor_id", filterVendor);
      if (filterVehicleType) params.set("vehicle_type_id", filterVehicleType);

      const response = await fetch(`/api/v1/ftl/lane-rates?${params}`);
      if (!response.ok) throw new Error("Failed to fetch lane rates");
      const result = await response.json();
      setLaneRates(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching lane rates:", error);
      toast.error("Failed to load lane rates");
    } finally {
      setIsLoading(false);
    }
  }, [filterOrigin, filterDestination, filterVendor, filterVehicleType]);

  const fetchVehicleTypes = async () => {
    try {
      const response = await fetch("/api/v1/ftl/vehicle-types?is_active=true&limit=100");
      if (!response.ok) throw new Error("Failed to fetch vehicle types");
      const result = await response.json();
      setVehicleTypes(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/v1/ftl/vendors?is_active=true&limit=100");
      if (!response.ok) throw new Error("Failed to fetch vendors");
      const result = await response.json();
      setVendors(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  useEffect(() => {
    fetchVehicleTypes();
    fetchVendors();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchLaneRates();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchLaneRates]);

  function openCreateDialog() {
    setEditingRate(null);
    setFormData({
      originCity: "",
      originState: "",
      destinationCity: "",
      destinationState: "",
      distanceKm: "",
      baseRate: "",
      perKmRate: "",
      loadingCharges: "",
      unloadingCharges: "",
      tollCharges: "",
      transitDays: 1,
      vehicleTypeId: "",
      vendorId: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(rate: LaneRate) {
    setEditingRate(rate);
    setFormData({
      originCity: rate.originCity,
      originState: rate.originState || "",
      destinationCity: rate.destinationCity,
      destinationState: rate.destinationState || "",
      distanceKm: rate.distanceKm?.toString() || "",
      baseRate: rate.baseRate.toString(),
      perKmRate: rate.perKmRate?.toString() || "",
      loadingCharges: rate.loadingCharges?.toString() || "",
      unloadingCharges: rate.unloadingCharges?.toString() || "",
      tollCharges: rate.tollCharges?.toString() || "",
      transitDays: rate.transitDays,
      vehicleTypeId: rate.vehicleTypeId,
      vendorId: rate.vendorId,
      isActive: rate.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const url = editingRate
        ? `/api/v1/ftl/lane-rates/${editingRate.id}`
        : "/api/v1/ftl/lane-rates";
      const method = editingRate ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCity: formData.originCity,
          originState: formData.originState || null,
          destinationCity: formData.destinationCity,
          destinationState: formData.destinationState || null,
          distanceKm: formData.distanceKm ? parseInt(formData.distanceKm) : null,
          baseRate: parseFloat(formData.baseRate),
          perKmRate: formData.perKmRate ? parseFloat(formData.perKmRate) : null,
          loadingCharges: formData.loadingCharges ? parseFloat(formData.loadingCharges) : null,
          unloadingCharges: formData.unloadingCharges ? parseFloat(formData.unloadingCharges) : null,
          tollCharges: formData.tollCharges ? parseFloat(formData.tollCharges) : null,
          transitDays: formData.transitDays,
          vehicleTypeId: formData.vehicleTypeId,
          vendorId: formData.vendorId,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save lane rate");
      }

      toast.success(
        editingRate
          ? "Lane rate updated successfully"
          : "Lane rate created successfully"
      );
      setIsDialogOpen(false);
      fetchLaneRates();
    } catch (error) {
      console.error("Error saving lane rate:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save lane rate");
    }
  }

  async function handleToggleActive(rate: LaneRate) {
    try {
      const response = await fetch(`/api/v1/ftl/lane-rates/${rate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rate.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update lane rate");

      toast.success(`Lane rate ${rate.isActive ? "deactivated" : "activated"}`);
      fetchLaneRates();
    } catch (error) {
      console.error("Error toggling lane rate:", error);
      toast.error("Failed to update lane rate");
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function calculateTotalRate(rate: LaneRate): number {
    let total = rate.baseRate;
    if (rate.loadingCharges) total += rate.loadingCharges;
    if (rate.unloadingCharges) total += rate.unloadingCharges;
    if (rate.tollCharges) total += rate.tollCharges;
    return total;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FTL Lane Rates</h1>
          <p className="text-muted-foreground">
            Manage lane-wise rates for FTL shipments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLaneRates}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lane Rate
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Origin City</Label>
              <Input
                placeholder="Filter by origin"
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Destination City</Label>
              <Input
                placeholder="Filter by destination"
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vendor</Label>
              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="All vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All vendors</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
              <Select value={filterVehicleType} onValueChange={setFilterVehicleType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {vehicleTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lane Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lane Rate Matrix</CardTitle>
          <CardDescription>
            {laneRates.length} lane rate(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : laneRates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <IndianRupee className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No lane rates configured</p>
              <Button variant="link" onClick={openCreateDialog}>
                Add your first lane rate
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lane</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Additional</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>TAT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laneRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rate.originCity}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{rate.destinationCity}</span>
                      </div>
                      {rate.distanceKm && (
                        <div className="text-xs text-muted-foreground">
                          {rate.distanceKm} km
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rate.vendorName || "Unknown"}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{rate.vehicleTypeName || "Unknown"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(rate.baseRate)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {rate.loadingCharges && (
                          <div>Loading: {formatCurrency(rate.loadingCharges)}</div>
                        )}
                        {rate.unloadingCharges && (
                          <div>Unloading: {formatCurrency(rate.unloadingCharges)}</div>
                        )}
                        {rate.tollCharges && (
                          <div>Toll: {formatCurrency(rate.tollCharges)}</div>
                        )}
                        {!rate.loadingCharges && !rate.unloadingCharges && !rate.tollCharges && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-green-600">
                        {formatCurrency(calculateTotalRate(rate))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{rate.transitDays} day(s)</span>
                      </div>
                    </TableCell>
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
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(rate)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(rate)}>
                            {rate.isActive ? (
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
              {editingRate ? "Edit Lane Rate" : "Add Lane Rate"}
            </DialogTitle>
            <DialogDescription>
              Configure FTL lane-wise shipping rate
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="border p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3">Lane Definition</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Origin City *</Label>
                    <Input
                      value={formData.originCity}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, originCity: e.target.value }))
                      }
                      placeholder="e.g., Mumbai"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Origin State</Label>
                    <Input
                      value={formData.originState}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, originState: e.target.value }))
                      }
                      placeholder="e.g., Maharashtra"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Destination City *</Label>
                    <Input
                      value={formData.destinationCity}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, destinationCity: e.target.value }))
                      }
                      placeholder="e.g., Delhi"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Destination State</Label>
                    <Input
                      value={formData.destinationState}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, destinationState: e.target.value }))
                      }
                      placeholder="e.g., Delhi"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  value={formData.distanceKm}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, distanceKm: e.target.value }))
                  }
                  placeholder="Optional"
                  className="max-w-[200px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Vendor *</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, vendorId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Vehicle Type *</Label>
                <Select
                  value={formData.vehicleTypeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, vehicleTypeId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>
                        {vt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Base Rate (INR) *</Label>
                  <Input
                    type="number"
                    value={formData.baseRate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, baseRate: e.target.value }))
                    }
                    placeholder="e.g., 25000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Per KM Rate (INR)</Label>
                  <Input
                    type="number"
                    value={formData.perKmRate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, perKmRate: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="grid gap-2">
                  <Label>Loading Charges</Label>
                  <Input
                    type="number"
                    value={formData.loadingCharges}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, loadingCharges: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unloading Charges</Label>
                  <Input
                    type="number"
                    value={formData.unloadingCharges}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, unloadingCharges: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Toll Charges</Label>
                  <Input
                    type="number"
                    value={formData.tollCharges}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tollCharges: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="grid gap-2">
                <Label>Transit Days *</Label>
                <Input
                  type="number"
                  value={formData.transitDays}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, transitDays: parseInt(e.target.value) || 1 }))
                  }
                  min={1}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formData.originCity ||
                !formData.destinationCity ||
                !formData.baseRate ||
                !formData.vehicleTypeId ||
                !formData.vendorId
              }
            >
              {editingRate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
