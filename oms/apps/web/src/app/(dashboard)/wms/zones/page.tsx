"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Layers,
  Thermometer,
  Snowflake,
  Flame,
  Box,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  temperatureType: string | null;
  minTemp: number | null;
  maxTemp: number | null;
  priority: number;
  isActive: boolean;
  locationId: string;
  binCount: number | null;
  createdAt: string;
  updatedAt: string;
}

const zoneTypes = [
  { value: "SALEABLE", label: "Saleable", description: "Primary storage" },
  { value: "DAMAGED", label: "Damaged", description: "Damaged goods" },
  { value: "QC", label: "QC Hold", description: "Quality check" },
  { value: "RETURNS", label: "Returns", description: "Return processing" },
  { value: "DISPATCH", label: "Dispatch", description: "Outbound staging" },
  { value: "RECEIVING", label: "Receiving", description: "Inbound staging" },
  { value: "BULK", label: "Bulk Storage", description: "Reserve/bulk" },
  { value: "PICK", label: "Pick Zone", description: "Active picking" },
  { value: "STAGING", label: "Staging", description: "Temporary holding" },
  { value: "COLD", label: "Cold Storage", description: "Refrigerated" },
  { value: "FROZEN", label: "Frozen", description: "Deep freeze" },
  { value: "HAZMAT", label: "Hazmat", description: "Hazardous materials" },
];

const temperatureTypes = [
  { value: "AMBIENT", label: "Ambient", icon: Thermometer },
  { value: "COLD", label: "Cold (2-8°C)", icon: Snowflake },
  { value: "FROZEN", label: "Frozen (-18°C)", icon: Flame },
];

const zoneTypeColors: Record<string, string> = {
  SALEABLE: "bg-green-500",
  DAMAGED: "bg-red-500",
  QC: "bg-yellow-500",
  RETURNS: "bg-orange-500",
  DISPATCH: "bg-blue-500",
  RECEIVING: "bg-purple-500",
  BULK: "bg-gray-500",
  PICK: "bg-teal-500",
  STAGING: "bg-indigo-500",
  COLD: "bg-cyan-500",
  FROZEN: "bg-sky-500",
  HAZMAT: "bg-rose-500",
};

// Zone type prefixes for auto-generated codes
const zoneTypePrefixes: Record<string, string> = {
  SALEABLE: "SALE",
  DAMAGED: "DMG",
  QC: "QC",
  RETURNS: "RET",
  DISPATCH: "DSP",
  RECEIVING: "RCV",
  BULK: "BLK",
  PICK: "PCK",
  STAGING: "STG",
  COLD: "CLD",
  FROZEN: "FRZ",
  HAZMAT: "HZM",
};

export default function ZonesPage() {
  const { data: session } = useSession();
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  // Filters
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "SALEABLE",
    description: "",
    temperatureType: "NONE",
    minTemp: "",
    maxTemp: "",
    priority: "100",
    locationId: "",
  });

  const canManageZones = ["SUPER_ADMIN", "ADMIN"].includes(
    session?.user?.role || ""
  );

  // Auto-generate zone code and name based on location and type
  function generateZoneCodeAndName(locationId: string, zoneType: string) {
    const location = locations.find((l) => l.id === locationId);
    if (!location) return { code: "", name: "" };

    // Extract location short code (e.g., "NOI" from "WH-NOI-0002")
    const locationParts = location.code.split("-");
    const locationShortCode = locationParts.length >= 2 ? locationParts[1] : location.code.substring(0, 3).toUpperCase();

    // Get zone type prefix
    const typePrefix = zoneTypePrefixes[zoneType] || zoneType.substring(0, 3).toUpperCase();

    // Count existing zones of this type at this location to generate sequence
    const existingZonesOfType = zones.filter(
      (z) => z.locationId === locationId && z.type === zoneType
    );
    const sequence = String(existingZonesOfType.length + 1).padStart(2, "0");

    // Generate code: TYPE-LOCATION-SEQ (e.g., SALE-NOI-01)
    const code = `${typePrefix}-${locationShortCode}-${sequence}`;

    // Get zone type label for name
    const zoneTypeInfo = zoneTypes.find((t) => t.value === zoneType);
    const typeLabel = zoneTypeInfo?.label || zoneType;

    // Generate name: "Type Zone - Location Name" (e.g., "Saleable Zone - Noida")
    const name = `${typeLabel} Zone - ${location.name}`;

    return { code, name };
  }

  // Update code and name when location or type changes
  function handleLocationChange(locationId: string) {
    const { code, name } = generateZoneCodeAndName(locationId, formData.type);
    setFormData((prev) => ({
      ...prev,
      locationId,
      code,
      name,
    }));
  }

  function handleTypeChange(zoneType: string) {
    const { code, name } = generateZoneCodeAndName(formData.locationId, zoneType);
    setFormData((prev) => ({
      ...prev,
      type: zoneType,
      code,
      name,
    }));
  }

  useEffect(() => {
    fetchLocations();
    fetchZones();
  }, []);

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      setLocations(data);
      if (data.length > 0 && !formData.locationId) {
        setFormData((prev) => ({ ...prev, locationId: data[0].id }));
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    }
  }

  async function fetchZones() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterLocation && filterLocation !== "all") {
        params.append("location_id", filterLocation);
      }
      if (filterType && filterType !== "all") {
        params.append("type", filterType);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/v1/zones?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch zones");
      const data = await response.json();
      setZones(data);
    } catch (error) {
      console.error("Error fetching zones:", error);
      toast.error("Failed to load zones");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchZones();
  }, [filterLocation, filterType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        priority: parseInt(formData.priority) || 100,
        minTemp: formData.minTemp ? parseFloat(formData.minTemp) : null,
        maxTemp: formData.maxTemp ? parseFloat(formData.maxTemp) : null,
        temperatureType: formData.temperatureType === "NONE" ? null : formData.temperatureType,
      };

      const url = editingZone
        ? `/api/v1/zones/${editingZone.id}`
        : "/api/v1/zones";
      const method = editingZone ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save zone");
      }

      toast.success(editingZone ? "Zone updated" : "Zone created");
      setIsDialogOpen(false);
      setEditingZone(null);
      resetForm();
      fetchZones();
    } catch (error) {
      console.error("Error saving zone:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save zone"
      );
    }
  }

  async function handleToggleActive(zone: Zone) {
    try {
      const response = await fetch(`/api/v1/zones/${zone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !zone.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update zone");

      toast.success(zone.isActive ? "Zone deactivated" : "Zone activated");
      fetchZones();
    } catch (error) {
      console.error("Error toggling zone status:", error);
      toast.error("Failed to update zone status");
    }
  }

  function resetForm() {
    setFormData({
      code: "",
      name: "",
      type: "SALEABLE",
      description: "",
      temperatureType: "NONE",
      minTemp: "",
      maxTemp: "",
      priority: "100",
      locationId: locations[0]?.id || "",
    });
  }

  function openEditDialog(zone: Zone) {
    setEditingZone(zone);
    setFormData({
      code: zone.code,
      name: zone.name,
      type: zone.type,
      description: zone.description || "",
      temperatureType: zone.temperatureType || "NONE",
      minTemp: zone.minTemp?.toString() || "",
      maxTemp: zone.maxTemp?.toString() || "",
      priority: zone.priority.toString(),
      locationId: zone.locationId,
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingZone(null);
    // Reset form and auto-generate code/name for first location and default type
    const defaultLocationId = locations[0]?.id || "";
    const defaultType = "SALEABLE";
    const { code, name } = generateZoneCodeAndName(defaultLocationId, defaultType);
    setFormData({
      code,
      name,
      type: defaultType,
      description: "",
      temperatureType: "NONE",
      minTemp: "",
      maxTemp: "",
      priority: "100",
      locationId: defaultLocationId,
    });
    setIsDialogOpen(true);
  }

  const getTemperatureIcon = (tempType: string | null) => {
    if (!tempType) return null;
    const temp = temperatureTypes.find((t) => t.value === tempType);
    if (!temp) return null;
    const Icon = temp.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || "Unknown";
  };

  const filteredZones = zones.filter((zone) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        zone.code.toLowerCase().includes(query) ||
        zone.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zone Management</h1>
          <p className="text-muted-foreground">
            Manage warehouse zones and storage areas
          </p>
        </div>
        {canManageZones && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Zone
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Location:</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Type:</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {zoneTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search zones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zones Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zones</CardTitle>
          <CardDescription>
            {filteredZones.length} zone{filteredZones.length !== 1 ? "s" : ""}{" "}
            found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredZones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No zones found</p>
              {canManageZones && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first zone
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Bins</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell>
                      <Badge variant="outline">{zone.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        {zone.name}
                      </div>
                      {zone.description && (
                        <p className="text-xs text-muted-foreground">
                          {zone.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${zoneTypeColors[zone.type] || "bg-gray-500"} text-white`}
                      >
                        {zone.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getLocationName(zone.locationId)}
                    </TableCell>
                    <TableCell>
                      {zone.temperatureType ? (
                        <div className="flex items-center gap-1">
                          {getTemperatureIcon(zone.temperatureType)}
                          <span className="text-sm">{zone.temperatureType}</span>
                          {zone.minTemp !== null && zone.maxTemp !== null && (
                            <span className="text-xs text-muted-foreground">
                              ({zone.minTemp}° - {zone.maxTemp}°C)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{zone.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Box className="h-3 w-3 text-muted-foreground" />
                        {zone.binCount ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={zone.isActive ? "default" : "secondary"}>
                        {zone.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageZones && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(zone)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(zone)}
                            >
                              {zone.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/wms/bins?zone_id=${zone.id}`)
                              }
                            >
                              <Box className="mr-2 h-4 w-4" />
                              View Bins
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Zone Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Edit Zone" : "Create Zone"}
            </DialogTitle>
            <DialogDescription>
              {editingZone
                ? "Update the zone details below."
                : "Fill in the details to create a new zone."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="locationId">Location *</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={editingZone ? (value) => setFormData({ ...formData, locationId: value }) : handleLocationChange}
                    disabled={!!editingZone}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Zone Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={editingZone ? (value) => setFormData({ ...formData, type: value }) : handleTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {zoneTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${zoneTypeColors[type.value]}`}
                            />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">
                    Zone Code * {!editingZone && <span className="text-xs text-muted-foreground">(Auto-generated)</span>}
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., SALE-NOI-01"
                    disabled={true}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Zone Name * {!editingZone && <span className="text-xs text-muted-foreground">(Auto-generated)</span>}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Saleable Zone - Noida"
                    disabled={!editingZone}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">
                  Priority (lower = higher priority)
                </Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  placeholder="100"
                  min="1"
                  max="999"
                />
              </div>

              {/* Temperature Settings */}
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-base font-medium">
                  Temperature Control (Optional)
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="temperatureType">Type</Label>
                    <Select
                      value={formData.temperatureType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, temperatureType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not controlled" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Not controlled</SelectItem>
                        {temperatureTypes.map((temp) => (
                          <SelectItem key={temp.value} value={temp.value}>
                            {temp.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="minTemp">Min Temp (°C)</Label>
                    <Input
                      id="minTemp"
                      type="number"
                      value={formData.minTemp}
                      onChange={(e) =>
                        setFormData({ ...formData, minTemp: e.target.value })
                      }
                      placeholder="e.g., 2"
                      disabled={formData.temperatureType === "NONE"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxTemp">Max Temp (°C)</Label>
                    <Input
                      id="maxTemp"
                      type="number"
                      value={formData.maxTemp}
                      onChange={(e) =>
                        setFormData({ ...formData, maxTemp: e.target.value })
                      }
                      placeholder="e.g., 8"
                      disabled={formData.temperatureType === "NONE"}
                    />
                  </div>
                </div>
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
              <Button type="submit">
                {editingZone ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
