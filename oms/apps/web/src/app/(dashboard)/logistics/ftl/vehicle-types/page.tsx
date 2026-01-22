"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Truck,
  RefreshCw,
  Box,
  Ruler,
  Weight,
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

interface VehicleType {
  id: string;
  code: string;
  name: string;
  category: string;
  capacityKg: number;
  capacityVolumeCBM: number | null;
  lengthFt: number | null;
  widthFt: number | null;
  heightFt: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

const vehicleCategories = [
  { value: "TATA_ACE", label: "Tata Ace", capacity: "750 kg" },
  { value: "PICKUP_8FT", label: "Pickup 8ft", capacity: "1 ton" },
  { value: "TATA_407", label: "Tata 407", capacity: "2.5 ton" },
  { value: "TRUCK_14FT", label: "Truck 14ft", capacity: "4 ton" },
  { value: "TRUCK_17FT", label: "Truck 17ft", capacity: "5 ton" },
  { value: "TRUCK_19FT", label: "Truck 19ft", capacity: "7 ton" },
  { value: "TRUCK_22FT", label: "Truck 22ft", capacity: "9 ton" },
  { value: "TRUCK_24FT", label: "Truck 24ft", capacity: "10 ton" },
  { value: "TRAILER_32FT", label: "Trailer 32ft", capacity: "15 ton" },
  { value: "TRAILER_40FT", label: "Trailer 40ft", capacity: "21 ton" },
  { value: "CONTAINER_20FT", label: "Container 20ft", capacity: "18 ton" },
  { value: "CONTAINER_40FT", label: "Container 40ft", capacity: "26 ton" },
];

export default function VehicleTypesPage() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<VehicleType | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category: "TRUCK_22FT",
    capacityKg: 9000,
    capacityVolumeCBM: "",
    lengthFt: "",
    widthFt: "",
    heightFt: "",
    description: "",
    isActive: true,
  });

  const fetchVehicleTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "100");

      const response = await fetch(`/api/v1/ftl/vehicle-types?${params}`);
      if (!response.ok) throw new Error("Failed to fetch vehicle types");
      const result = await response.json();
      setVehicleTypes(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
      toast.error("Failed to load vehicle types");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicleTypes();
  }, [fetchVehicleTypes]);

  function handleCategoryChange(category: string) {
    const cat = vehicleCategories.find((c) => c.value === category);
    setFormData((prev) => ({
      ...prev,
      category,
      name: cat?.label || prev.name,
    }));
  }

  function openCreateDialog() {
    setEditingType(null);
    setFormData({
      code: "",
      name: "",
      category: "TRUCK_22FT",
      capacityKg: 9000,
      capacityVolumeCBM: "",
      lengthFt: "",
      widthFt: "",
      heightFt: "",
      description: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(vehicleType: VehicleType) {
    setEditingType(vehicleType);
    setFormData({
      code: vehicleType.code,
      name: vehicleType.name,
      category: vehicleType.category,
      capacityKg: vehicleType.capacityKg,
      capacityVolumeCBM: vehicleType.capacityVolumeCBM?.toString() || "",
      lengthFt: vehicleType.lengthFt?.toString() || "",
      widthFt: vehicleType.widthFt?.toString() || "",
      heightFt: vehicleType.heightFt?.toString() || "",
      description: vehicleType.description || "",
      isActive: vehicleType.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const url = editingType
        ? `/api/v1/ftl/vehicle-types/${editingType.id}`
        : "/api/v1/ftl/vehicle-types";
      const method = editingType ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          category: formData.category,
          capacityKg: formData.capacityKg,
          capacityVolumeCBM: formData.capacityVolumeCBM ? parseFloat(formData.capacityVolumeCBM) : null,
          lengthFt: formData.lengthFt ? parseFloat(formData.lengthFt) : null,
          widthFt: formData.widthFt ? parseFloat(formData.widthFt) : null,
          heightFt: formData.heightFt ? parseFloat(formData.heightFt) : null,
          description: formData.description || null,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save vehicle type");
      }

      toast.success(
        editingType
          ? "Vehicle type updated successfully"
          : "Vehicle type created successfully"
      );
      setIsDialogOpen(false);
      fetchVehicleTypes();
    } catch (error) {
      console.error("Error saving vehicle type:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save vehicle type");
    }
  }

  async function handleToggleActive(vehicleType: VehicleType) {
    try {
      const response = await fetch(`/api/v1/ftl/vehicle-types/${vehicleType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !vehicleType.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update vehicle type");

      toast.success(`Vehicle type ${vehicleType.isActive ? "deactivated" : "activated"}`);
      fetchVehicleTypes();
    } catch (error) {
      console.error("Error toggling vehicle type:", error);
      toast.error("Failed to update vehicle type");
    }
  }

  function formatCapacity(kg: number): string {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1)} ton`;
    }
    return `${kg} kg`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicle Types</h1>
          <p className="text-muted-foreground">
            Manage FTL vehicle type master data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchVehicleTypes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle Type
          </Button>
        </div>
      </div>

      {/* Vehicle Types Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Types</CardTitle>
          <CardDescription>
            {vehicleTypes.length} vehicle type(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : vehicleTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vehicle types configured</p>
              <Button variant="link" onClick={openCreateDialog}>
                Add your first vehicle type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Weight Capacity</TableHead>
                  <TableHead>Volume (CBM)</TableHead>
                  <TableHead>Dimensions (LxWxH ft)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleTypes.map((vt) => (
                  <TableRow key={vt.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{vt.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vt.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{vt.category.replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Weight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{formatCapacity(vt.capacityKg)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {vt.capacityVolumeCBM ? (
                        <div className="flex items-center gap-1">
                          <Box className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{vt.capacityVolumeCBM} m³</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {vt.lengthFt && vt.widthFt && vt.heightFt ? (
                        <div className="flex items-center gap-1">
                          <Ruler className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {vt.lengthFt} x {vt.widthFt} x {vt.heightFt}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={vt.isActive ? "default" : "secondary"}
                        className={
                          vt.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {vt.isActive ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(vt)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(vt)}>
                            {vt.isActive ? (
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Vehicle Type" : "Add Vehicle Type"}
            </DialogTitle>
            <DialogDescription>
              Configure vehicle type specifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g., TRUCK22"
                  disabled={!!editingType}
                />
              </div>
              <div className="grid gap-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label} ({cat.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Display Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., 22ft Truck"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Weight Capacity (kg) *</Label>
                <Input
                  type="number"
                  value={formData.capacityKg}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, capacityKg: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Volume Capacity (CBM)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.capacityVolumeCBM}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, capacityVolumeCBM: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Length (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.lengthFt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lengthFt: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Width (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.widthFt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, widthFt: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Height (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.heightFt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, heightFt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional notes"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
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
              disabled={!formData.code || !formData.name || !formData.capacityKg}
            >
              {editingType ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
