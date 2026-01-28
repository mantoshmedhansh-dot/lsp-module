"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  MapPin,
  Warehouse,
  Store,
  Building,
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
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  } | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  gst: string | null;
  isActive: boolean;
  companyId?: string;
  company?: {
    id: string;
    name: string;
    code: string;
  } | null;
  _count?: {
    zones: number;
  };
}

const locationTypes = [
  { value: "WAREHOUSE", label: "Warehouse", icon: Warehouse },
  { value: "STORE", label: "Store", icon: Store },
  { value: "HUB", label: "Hub", icon: Building },
  { value: "VIRTUAL", label: "Virtual", icon: MapPin },
];

export default function LocationsPage() {
  const { data: session } = useSession();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "WAREHOUSE",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    gst: "",
  });
  const [previewCode, setPreviewCode] = useState<string>("");

  const canManageLocations = ["SUPER_ADMIN", "ADMIN"].includes(
    session?.user?.role || ""
  );

  // Location type prefixes for client-side preview
  const LOCATION_TYPE_PREFIX: Record<string, string> = {
    WAREHOUSE: "WH",
    STORE: "ST",
    HUB: "HB",
    VIRTUAL: "VT",
  };

  // Generate location code preview from name and type (client-side)
  function generateCodePreview(name: string, type: string): string {
    if (!name || name.length < 2) return "";

    const typePrefix = LOCATION_TYPE_PREFIX[type] || "LC";

    // Common words to exclude
    const stopWords = new Set(['the', 'and', 'of', 'for', 'in', 'a', 'an', 'main', 'central', 'primary']);

    // Clean and split the name
    const words = name.replace(/[^a-zA-Z\s]/g, '').toLowerCase().split(/\s+/).filter(w => w);
    const meaningfulWords = words.filter(w => !stopWords.has(w));

    // Use meaningful words, or original if none
    const wordsToUse = meaningfulWords.length > 0 ? meaningfulWords : words;

    let namePrefix: string;
    if (wordsToUse.length >= 2) {
      namePrefix = (wordsToUse[0][0] + wordsToUse[1][0] +
        (wordsToUse.length > 2 ? wordsToUse[wordsToUse.length - 1][0] :
          (wordsToUse[0].length > 1 ? wordsToUse[0][1] : 'X'))).toUpperCase();
    } else if (wordsToUse.length === 1) {
      namePrefix = wordsToUse[0].slice(0, 3).toUpperCase();
    } else {
      namePrefix = 'LOC';
    }

    // Ensure prefix is exactly 3 characters
    namePrefix = namePrefix.slice(0, 3).padEnd(3, 'X');

    // Show preview with placeholder sequence (actual number assigned on create)
    return `${typePrefix}-${namePrefix}-0001`;
  }

  function handleNameChange(name: string) {
    setFormData({ ...formData, name });
    // Generate preview code when creating new location
    if (!editingLocation) {
      const code = generateCodePreview(name, formData.type);
      setPreviewCode(code);
    }
  }

  function handleTypeChange(type: string) {
    setFormData({ ...formData, type });
    // Regenerate preview code when type changes
    if (!editingLocation && formData.name) {
      const code = generateCodePreview(formData.name, type);
      setPreviewCode(code);
    }
  }

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingLocation
        ? `/api/v1/locations/${editingLocation.id}`
        : "/api/v1/locations";
      const method = editingLocation ? "PATCH" : "POST";

      // When creating, don't send code - let backend auto-generate it
      // Add companyId from session for new locations
      const payload = editingLocation
        ? formData
        : { ...formData, code: undefined, companyId: session?.user?.companyId };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save location");
      }

      toast.success(editingLocation ? "Location updated" : "Location created");
      setIsDialogOpen(false);
      setEditingLocation(null);
      resetForm();
      fetchLocations();
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save location"
      );
    }
  }

  async function handleToggleActive(location: Location) {
    try {
      const response = await fetch(`/api/v1/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !location.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update location");

      toast.success(
        location.isActive ? "Location deactivated" : "Location activated"
      );
      fetchLocations();
    } catch (error) {
      console.error("Error toggling location status:", error);
      toast.error("Failed to update location status");
    }
  }

  async function handleDelete(location: Location) {
    if (
      !confirm(
        `Are you sure you want to delete ${location.name}? This will also delete all associated zones and bins.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/v1/locations/${location.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete location");
      }

      toast.success("Location deleted");
      fetchLocations();
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete location"
      );
    }
  }

  function resetForm() {
    setFormData({
      code: "",
      name: "",
      type: "WAREHOUSE",
      address: {
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
      },
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      gst: "",
    });
    setPreviewCode("");
  }

  function openEditDialog(location: Location) {
    setEditingLocation(location);
    setFormData({
      code: location.code,
      name: location.name,
      type: location.type,
      address: {
        line1: location.address?.line1 || "",
        line2: location.address?.line2 || "",
        city: location.address?.city || "",
        state: location.address?.state || "",
        pincode: location.address?.pincode || "",
        country: location.address?.country || "India",
      },
      contactPerson: location.contactPerson || "",
      contactPhone: location.contactPhone || "",
      contactEmail: location.contactEmail || "",
      gst: location.gst || "",
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingLocation(null);
    resetForm();
    setIsDialogOpen(true);
  }

  const getLocationIcon = (type: string) => {
    const locationType = locationTypes.find((t) => t.value === type);
    const Icon = locationType?.icon || MapPin;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Location Management
          </h1>
          <p className="text-muted-foreground">
            Manage warehouses, stores, and hubs
          </p>
        </div>
        {canManageLocations && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            A list of all locations across companies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No locations found</p>
              {canManageLocations && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first location
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
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zones</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>
                      <Badge variant="outline">{location.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getLocationIcon(location.type)}
                        {location.name}
                      </div>
                      {location.company?.name && (
                        <p className="text-xs text-muted-foreground">
                          {location.company.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{location.type}</TableCell>
                    <TableCell>
                      {location.address?.city || "-"}
                      {location.address?.state && (
                        <span className="text-muted-foreground">
                          , {location.address.state}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={location.isActive ? "default" : "secondary"}
                      >
                        {location.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{location._count?.zones ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {canManageLocations && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(location)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(location)}
                            >
                              {location.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            {session?.user?.role === "SUPER_ADMIN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(location)}
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
          )}
        </CardContent>
      </Card>

      {/* Location Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Create Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the location details below."
                : "Fill in the details to create a new location."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Location Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Mumbai Main Warehouse"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Location Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={handleTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {locationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="code">Location Code {editingLocation && "*"}</Label>
                <Input
                  id="code"
                  value={editingLocation ? formData.code : (previewCode || "")}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder={editingLocation ? "Location code" : "Enter name & type to generate"}
                  readOnly={!editingLocation}
                  className={!editingLocation ? "bg-muted font-mono text-blue-600 font-semibold" : "font-mono"}
                  required={!!editingLocation}
                />
                {!editingLocation && previewCode && (
                  <p className="text-xs text-green-600 font-medium">Auto-generated: {previewCode}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <div className="grid gap-2">
                  <Input
                    placeholder="Address Line 1"
                    value={formData.address.line1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, line1: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="Address Line 2"
                    value={formData.address.line2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, line2: e.target.value },
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="City"
                      value={formData.address.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, city: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="State"
                      value={formData.address.state}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: { ...formData.address, state: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Pincode"
                      value={formData.address.pincode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            pincode: e.target.value,
                          },
                        })
                      }
                    />
                    <Input
                      placeholder="Country"
                      value={formData.address.country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          address: {
                            ...formData.address,
                            country: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                    placeholder="Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPhone: e.target.value })
                    }
                    placeholder="Phone number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, contactEmail: e.target.value })
                    }
                    placeholder="Email"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gst">GST Number (Location-specific)</Label>
                <Input
                  id="gst"
                  value={formData.gst}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gst: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., 27AABCU9603R1ZM"
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
              <Button type="submit">
                {editingLocation ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
