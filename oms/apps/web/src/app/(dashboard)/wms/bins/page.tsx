"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Box,
  Filter,
  Search,
  Layers,
  Package,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Zone {
  id: string;
  code: string;
  name: string;
  type: string;
  locationId: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface Bin {
  id: string;
  code: string;
  name: string | null;
  binType: string | null;
  description: string | null;
  aisle: string | null;
  rack: string | null;
  level: string | null;
  position: string | null;
  pickSequence: number;
  isPickFace: boolean;
  isReserve: boolean;
  isStaging: boolean;
  isActive: boolean;
  zoneId: string;
  maxWeight: number | null;
  maxVolume: number | null;
  maxUnits: number | null;
  currentUnits: number;
  fullAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

const binTypes = [
  { value: "FLOOR", label: "Floor" },
  { value: "SHELF", label: "Shelf" },
  { value: "PALLET", label: "Pallet" },
  { value: "PICK_FACE", label: "Pick Face" },
  { value: "RESERVE", label: "Reserve" },
  { value: "STAGING", label: "Staging" },
  { value: "QC_HOLD", label: "QC Hold" },
];

const binTypePrefixes: Record<string, string> = {
  FLOOR: "FLR",
  SHELF: "SHF",
  PALLET: "PLT",
  PICK_FACE: "PCK",
  RESERVE: "RSV",
  STAGING: "STG",
  QC_HOLD: "QCH",
};

export default function BinsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedZoneId = searchParams.get("zone_id");

  const [bins, setBins] = useState<Bin[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);

  // Filters
  const [filterZone, setFilterZone] = useState<string>(preselectedZoneId || "all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    binType: "SHELF",
    description: "",
    aisle: "",
    rack: "",
    level: "",
    position: "",
    pickSequence: "0",
    isPickFace: false,
    isReserve: false,
    isStaging: false,
    maxUnits: "",
    zoneId: "",
  });

  const [bulkFormData, setBulkFormData] = useState({
    zoneId: "",
    prefix: "A",
    binType: "SHELF",
    count: "10",
    startNumber: "1",
    aisle: "",
    isPickFace: false,
    isReserve: false,
  });

  const canManageBins = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    fetchLocations();
    fetchZones();
  }, []);

  useEffect(() => {
    fetchBins();
  }, [filterZone, filterLocation, filterType]);

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    }
  }

  async function fetchZones() {
    try {
      const response = await fetch("/api/v1/zones");
      if (!response.ok) throw new Error("Failed to fetch zones");
      const data = await response.json();
      setZones(data);
      if (data.length > 0 && !formData.zoneId) {
        const defaultZoneId = preselectedZoneId || data[0].id;
        setFormData((prev) => ({ ...prev, zoneId: defaultZoneId }));
        setBulkFormData((prev) => ({ ...prev, zoneId: defaultZoneId }));
      }
    } catch (error) {
      console.error("Error fetching zones:", error);
      toast.error("Failed to load zones");
    }
  }

  async function fetchBins() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterZone && filterZone !== "all") {
        params.append("zone_id", filterZone);
      }
      if (filterLocation && filterLocation !== "all") {
        params.append("location_id", filterLocation);
      }
      if (filterType && filterType !== "all") {
        params.append("bin_type", filterType);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/v1/bins?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch bins");
      const data = await response.json();
      setBins(data);
    } catch (error) {
      console.error("Error fetching bins:", error);
      toast.error("Failed to load bins");
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-generate bin code and name based on zone and type
  function generateBinCodeAndName(zoneId: string, binType: string) {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return { code: "", name: "" };

    // Get zone short code
    const zoneParts = zone.code.split("-");
    const zoneShortCode = zoneParts[0] || zone.code.substring(0, 4).toUpperCase();

    // Get bin type prefix
    const typePrefix = binTypePrefixes[binType] || binType.substring(0, 3).toUpperCase();

    // Count existing bins of this type in this zone
    const existingBinsOfType = bins.filter(
      (b) => b.zoneId === zoneId && b.binType === binType
    );
    const sequence = String(existingBinsOfType.length + 1).padStart(3, "0");

    // Generate code: ZONE-TYPE-SEQ (e.g., SALE-SHF-001)
    const code = `${zoneShortCode}-${typePrefix}-${sequence}`;

    // Get bin type label
    const binTypeInfo = binTypes.find((t) => t.value === binType);
    const typeLabel = binTypeInfo?.label || binType;

    // Generate name
    const name = `${typeLabel} ${sequence} - ${zone.name}`;

    return { code, name };
  }

  function handleZoneChange(zoneId: string) {
    const { code, name } = generateBinCodeAndName(zoneId, formData.binType);
    setFormData((prev) => ({
      ...prev,
      zoneId,
      code,
      name,
    }));
  }

  function handleBinTypeChange(binType: string) {
    const { code, name } = generateBinCodeAndName(formData.zoneId, binType);
    setFormData((prev) => ({
      ...prev,
      binType,
      code,
      name,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        pickSequence: parseInt(formData.pickSequence) || 0,
        maxUnits: formData.maxUnits ? parseInt(formData.maxUnits) : null,
      };

      const url = editingBin
        ? `/api/v1/bins/${editingBin.id}`
        : "/api/v1/bins/bulk";
      const method = editingBin ? "PATCH" : "POST";

      // For single bin creation, use the zone nested endpoint
      const singleBinUrl = `/api/v1/locations/${getLocationIdFromZone(formData.zoneId)}/zones/${formData.zoneId}/bins`;

      const response = await fetch(editingBin ? url : singleBinUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save bin");
      }

      toast.success(editingBin ? "Bin updated" : "Bin created");
      setIsDialogOpen(false);
      setEditingBin(null);
      resetForm();
      fetchBins();
    } catch (error) {
      console.error("Error saving bin:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save bin"
      );
    }
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();

    try {
      const payload = {
        zoneId: bulkFormData.zoneId,
        prefix: bulkFormData.prefix,
        binType: bulkFormData.binType,
        count: parseInt(bulkFormData.count) || 10,
        startNumber: parseInt(bulkFormData.startNumber) || 1,
        aisle: bulkFormData.aisle || null,
        isPickFace: bulkFormData.isPickFace,
        isReserve: bulkFormData.isReserve,
      };

      const response = await fetch("/api/v1/bins/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create bins");
      }

      const createdBins = await response.json();
      toast.success(`Created ${createdBins.length} bins`);
      setIsBulkDialogOpen(false);
      resetBulkForm();
      fetchBins();
    } catch (error) {
      console.error("Error creating bins:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create bins"
      );
    }
  }

  function getLocationIdFromZone(zoneId: string): string {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.locationId || "";
  }

  async function handleToggleActive(bin: Bin) {
    try {
      const response = await fetch(`/api/v1/bins/${bin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !bin.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update bin");

      toast.success(bin.isActive ? "Bin deactivated" : "Bin activated");
      fetchBins();
    } catch (error) {
      console.error("Error toggling bin status:", error);
      toast.error("Failed to update bin status");
    }
  }

  function resetForm() {
    const defaultZoneId = zones[0]?.id || "";
    const { code, name } = generateBinCodeAndName(defaultZoneId, "SHELF");
    setFormData({
      code,
      name,
      binType: "SHELF",
      description: "",
      aisle: "",
      rack: "",
      level: "",
      position: "",
      pickSequence: "0",
      isPickFace: false,
      isReserve: false,
      isStaging: false,
      maxUnits: "",
      zoneId: defaultZoneId,
    });
  }

  function resetBulkForm() {
    setBulkFormData({
      zoneId: zones[0]?.id || "",
      prefix: "A",
      binType: "SHELF",
      count: "10",
      startNumber: "1",
      aisle: "",
      isPickFace: false,
      isReserve: false,
    });
  }

  function openEditDialog(bin: Bin) {
    setEditingBin(bin);
    setFormData({
      code: bin.code,
      name: bin.name || "",
      binType: bin.binType || "SHELF",
      description: bin.description || "",
      aisle: bin.aisle || "",
      rack: bin.rack || "",
      level: bin.level || "",
      position: bin.position || "",
      pickSequence: bin.pickSequence.toString(),
      isPickFace: bin.isPickFace,
      isReserve: bin.isReserve,
      isStaging: bin.isStaging,
      maxUnits: bin.maxUnits?.toString() || "",
      zoneId: bin.zoneId,
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingBin(null);
    const defaultZoneId = preselectedZoneId || zones[0]?.id || "";
    const defaultBinType = "SHELF";
    const { code, name } = generateBinCodeAndName(defaultZoneId, defaultBinType);
    setFormData({
      code,
      name,
      binType: defaultBinType,
      description: "",
      aisle: "",
      rack: "",
      level: "",
      position: "",
      pickSequence: "0",
      isPickFace: false,
      isReserve: false,
      isStaging: false,
      maxUnits: "",
      zoneId: defaultZoneId,
    });
    setIsDialogOpen(true);
  }

  function openBulkDialog() {
    const defaultZoneId = preselectedZoneId || zones[0]?.id || "";
    setBulkFormData({
      zoneId: defaultZoneId,
      prefix: "A",
      binType: "SHELF",
      count: "10",
      startNumber: "1",
      aisle: "",
      isPickFace: false,
      isReserve: false,
    });
    setIsBulkDialogOpen(true);
  }

  const getZoneName = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.name || "Unknown";
  };

  const filteredBins = bins.filter((bin) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        bin.code.toLowerCase().includes(query) ||
        (bin.name && bin.name.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bin Management</h1>
          <p className="text-muted-foreground">
            Manage storage bins within warehouse zones
          </p>
        </div>
        {canManageBins && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openBulkDialog}>
              <Layers className="mr-2 h-4 w-4" />
              Bulk Create
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Bin
            </Button>
          </div>
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
              <Label className="text-sm">Zone:</Label>
              <Select value={filterZone} onValueChange={setFilterZone}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
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
                  {binTypes.map((type) => (
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
                placeholder="Search bins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bins Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bins</CardTitle>
          <CardDescription>
            {filteredBins.length} bin{filteredBins.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredBins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Box className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No bins found</p>
              {canManageBins && (
                <div className="flex gap-2 mt-2">
                  <Button variant="link" onClick={openBulkDialog}>
                    Bulk create bins
                  </Button>
                  <span className="text-muted-foreground">or</span>
                  <Button variant="link" onClick={openCreateDialog}>
                    Add single bin
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBins.map((bin) => (
                  <TableRow key={bin.id}>
                    <TableCell>
                      <Badge variant="outline">{bin.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4" />
                        {bin.name || bin.code}
                      </div>
                      {bin.fullAddress && (
                        <p className="text-xs text-muted-foreground">
                          {bin.fullAddress}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {bin.binType || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getZoneName(bin.zoneId)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {bin.aisle && <span>Aisle {bin.aisle}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {bin.isPickFace && (
                          <Badge variant="outline" className="text-xs">Pick</Badge>
                        )}
                        {bin.isReserve && (
                          <Badge variant="outline" className="text-xs">Reserve</Badge>
                        )}
                        {bin.isStaging && (
                          <Badge variant="outline" className="text-xs">Stage</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {bin.maxUnits ? (
                        <span className="text-sm">
                          {bin.currentUnits}/{bin.maxUnits}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={bin.isActive ? "default" : "secondary"}>
                        {bin.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageBins && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(bin)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(bin)}>
                              {bin.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/inventory?bin_id=${bin.id}`)
                              }
                            >
                              <Package className="mr-2 h-4 w-4" />
                              View Inventory
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

      {/* Single Bin Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBin ? "Edit Bin" : "Create Bin"}
            </DialogTitle>
            <DialogDescription>
              {editingBin
                ? "Update the bin details below."
                : "Fill in the details to create a new bin."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="zoneId">Zone *</Label>
                  <Select
                    value={formData.zoneId}
                    onValueChange={editingBin ? (value) => setFormData({ ...formData, zoneId: value }) : handleZoneChange}
                    disabled={!!editingBin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name} ({zone.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="binType">Bin Type *</Label>
                  <Select
                    value={formData.binType}
                    onValueChange={editingBin ? (value) => setFormData({ ...formData, binType: value }) : handleBinTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {binTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">
                    Bin Code * {!editingBin && <span className="text-xs text-muted-foreground">(Auto-generated)</span>}
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
                    placeholder="e.g., SALE-SHF-001"
                    disabled={true}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Bin Name {!editingBin && <span className="text-xs text-muted-foreground">(Auto-generated)</span>}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Shelf 001 - Saleable Zone"
                    disabled={!editingBin}
                  />
                </div>
              </div>

              {/* Location Details */}
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-base font-medium">Location Details</Label>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="aisle">Aisle</Label>
                    <Input
                      id="aisle"
                      value={formData.aisle}
                      onChange={(e) =>
                        setFormData({ ...formData, aisle: e.target.value.toUpperCase() })
                      }
                      placeholder="A"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rack">Rack</Label>
                    <Input
                      id="rack"
                      value={formData.rack}
                      onChange={(e) =>
                        setFormData({ ...formData, rack: e.target.value })
                      }
                      placeholder="01"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      placeholder="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                      placeholder="01"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="maxUnits">Max Units</Label>
                  <Input
                    id="maxUnits"
                    type="number"
                    value={formData.maxUnits}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUnits: e.target.value })
                    }
                    placeholder="100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pickSequence">Pick Sequence</Label>
                  <Input
                    id="pickSequence"
                    type="number"
                    value={formData.pickSequence}
                    onChange={(e) =>
                      setFormData({ ...formData, pickSequence: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-base font-medium">Bin Flags</Label>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPickFace"
                      checked={formData.isPickFace}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isPickFace: checked as boolean })
                      }
                    />
                    <Label htmlFor="isPickFace">Pick Face</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isReserve"
                      checked={formData.isReserve}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isReserve: checked as boolean })
                      }
                    />
                    <Label htmlFor="isReserve">Reserve</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isStaging"
                      checked={formData.isStaging}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isStaging: checked as boolean })
                      }
                    />
                    <Label htmlFor="isStaging">Staging</Label>
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
                {editingBin ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Create Bins</DialogTitle>
            <DialogDescription>
              Create multiple bins at once with sequential codes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bulkZoneId">Zone *</Label>
                <Select
                  value={bulkFormData.zoneId}
                  onValueChange={(value) =>
                    setBulkFormData({ ...bulkFormData, zoneId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name} ({zone.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="prefix">Prefix *</Label>
                  <Input
                    id="prefix"
                    value={bulkFormData.prefix}
                    onChange={(e) =>
                      setBulkFormData({
                        ...bulkFormData,
                        prefix: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="A"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Bins will be named: {bulkFormData.prefix}-01, {bulkFormData.prefix}-02, etc.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bulkBinType">Bin Type</Label>
                  <Select
                    value={bulkFormData.binType}
                    onValueChange={(value) =>
                      setBulkFormData({ ...bulkFormData, binType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {binTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="count">Number of Bins *</Label>
                  <Input
                    id="count"
                    type="number"
                    value={bulkFormData.count}
                    onChange={(e) =>
                      setBulkFormData({ ...bulkFormData, count: e.target.value })
                    }
                    placeholder="10"
                    min="1"
                    max="100"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="startNumber">Start Number</Label>
                  <Input
                    id="startNumber"
                    type="number"
                    value={bulkFormData.startNumber}
                    onChange={(e) =>
                      setBulkFormData({ ...bulkFormData, startNumber: e.target.value })
                    }
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bulkAisle">Aisle (Optional)</Label>
                <Input
                  id="bulkAisle"
                  value={bulkFormData.aisle}
                  onChange={(e) =>
                    setBulkFormData({ ...bulkFormData, aisle: e.target.value.toUpperCase() })
                  }
                  placeholder="A"
                />
              </div>

              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bulkIsPickFace"
                    checked={bulkFormData.isPickFace}
                    onCheckedChange={(checked) =>
                      setBulkFormData({ ...bulkFormData, isPickFace: checked as boolean })
                    }
                  />
                  <Label htmlFor="bulkIsPickFace">Pick Face</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bulkIsReserve"
                    checked={bulkFormData.isReserve}
                    onCheckedChange={(checked) =>
                      setBulkFormData({ ...bulkFormData, isReserve: checked as boolean })
                    }
                  />
                  <Label htmlFor="bulkIsReserve">Reserve</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBulkDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Create {bulkFormData.count} Bins
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
