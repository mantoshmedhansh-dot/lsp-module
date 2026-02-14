"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Upload,
  Download,
  Clock,
  MapPin,
  Truck,
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

interface PTLTATMatrix {
  id: string;
  vendorId: string;
  vendorName: string;
  originZone: string;
  destinationZone: string;
  transitDays: number;
  minTransitDays: number;
  maxTransitDays: number;
  cutoffTime: string | null;
  isActive: boolean;
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

export default function PTLTATMatrixPage() {
  const [tatEntries, setTatEntries] = useState<PTLTATMatrix[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PTLTATMatrix | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: "",
    originZone: "",
    destinationZone: "",
    transitDays: "",
    minTransitDays: "",
    maxTransitDays: "",
    cutoffTime: "",
    isActive: true,
  });

  const fetchTATEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (vendorFilter) params.set("vendor_id", vendorFilter);
      if (originFilter) params.set("origin_zone", originFilter);
      if (destinationFilter) params.set("destination_zone", destinationFilter);
      params.set("limit", "200");

      const response = await fetch(`/api/v1/ptl/tat-matrix?${params}`);
      if (!response.ok) throw new Error("Failed to fetch TAT matrix");
      const result = await response.json();
      setTatEntries(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching TAT entries:", error);
      toast.error("Failed to load TAT matrix");
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
    fetchTATEntries();
  }, [fetchTATEntries]);

  function resetForm() {
    setFormData({
      vendorId: "",
      originZone: "",
      destinationZone: "",
      transitDays: "",
      minTransitDays: "",
      maxTransitDays: "",
      cutoffTime: "",
      isActive: true,
    });
    setEditingEntry(null);
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(entry: PTLTATMatrix) {
    setEditingEntry(entry);
    setFormData({
      vendorId: entry.vendorId,
      originZone: entry.originZone,
      destinationZone: entry.destinationZone,
      transitDays: entry.transitDays.toString(),
      minTransitDays: entry.minTransitDays.toString(),
      maxTransitDays: entry.maxTransitDays.toString(),
      cutoffTime: entry.cutoffTime || "",
      isActive: entry.isActive,
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
        transit_days: parseInt(formData.transitDays) || 0,
        min_transit_days: parseInt(formData.minTransitDays) || 0,
        max_transit_days: parseInt(formData.maxTransitDays) || 0,
        cutoff_time: formData.cutoffTime || null,
        is_active: formData.isActive,
      };

      const url = editingEntry
        ? `/api/v1/ptl/tat-matrix/${editingEntry.id}`
        : "/api/v1/ptl/tat-matrix";
      const method = editingEntry ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save TAT entry");
      toast.success(editingEntry ? "TAT entry updated" : "TAT entry created");
      setIsDialogOpen(false);
      resetForm();
      fetchTATEntries();
    } catch (error) {
      console.error("Error saving TAT entry:", error);
      toast.error("Failed to save TAT entry");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(entry: PTLTATMatrix) {
    if (!confirm("Are you sure you want to delete this TAT entry?")) return;

    try {
      const response = await fetch(`/api/v1/ptl/tat-matrix/${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete TAT entry");
      toast.success("TAT entry deleted");
      fetchTATEntries();
    } catch (error) {
      console.error("Error deleting TAT entry:", error);
      toast.error("Failed to delete TAT entry");
    }
  }

  async function handleToggleActive(entry: PTLTATMatrix) {
    try {
      const response = await fetch(`/api/v1/ptl/tat-matrix/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !entry.isActive }),
      });
      if (!response.ok) throw new Error("Failed to update TAT entry");
      toast.success(entry.isActive ? "TAT entry deactivated" : "TAT entry activated");
      fetchTATEntries();
    } catch (error) {
      console.error("Error toggling TAT entry:", error);
      toast.error("Failed to update TAT entry");
    }
  }

  function formatTransitDays(min: number, max: number): string {
    if (min === max) return `${min} day(s)`;
    return `${min}-${max} day(s)`;
  }

  // Export TAT matrix to CSV
  const handleExport = () => {
    if (tatEntries.length === 0) {
      toast.error("No data to export");
      return;
    }
    const columns: ExportColumn[] = [
      { key: "vendorName", header: "Vendor" },
      { key: "originZone", header: "Origin Zone" },
      { key: "destinationZone", header: "Destination Zone" },
      { key: "transitDays", header: "Transit Days" },
      { key: "minTransitDays", header: "Min Days" },
      { key: "maxTransitDays", header: "Max Days" },
      { key: "cutoffTime", header: "Cutoff Time", formatter: (v) => v || "" },
      { key: "isActive", header: "Status", formatter: (v) => v ? "Active" : "Inactive" },
    ];
    exportToCSV(tatEntries, columns, "ptl_tat_matrix");
    toast.success("TAT matrix exported successfully");
  };

  // Stats
  const avgTransitDays =
    tatEntries.length > 0
      ? Math.round(
          tatEntries.reduce((sum, e) => sum + e.transitDays, 0) / tatEntries.length
        )
      : 0;

  const stats = {
    total: tatEntries.length,
    active: tatEntries.filter((e) => e.isActive).length,
    vendors: new Set(tatEntries.map((e) => e.vendorId)).size,
    avgTransit: avgTransitDays,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PTL TAT Matrix</h1>
          <p className="text-muted-foreground">
            Manage transit time (TAT) matrix for PTL shipments by lane and vendor
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
            Add TAT Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Entries</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-purple-600" />
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
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Transit</p>
                <p className="text-2xl font-bold">{stats.avgTransit} days</p>
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
          <CardTitle>TAT Matrix</CardTitle>
          <CardDescription>
            {tatEntries.length} entry(ies) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Transit Days</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Cutoff Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : tatEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No TAT entries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tatEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{entry.vendorName}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.originZone}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.destinationZone}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entry.transitDays} day(s)</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {formatTransitDays(entry.minTransitDays, entry.maxTransitDays)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.cutoffTime || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.isActive ? "default" : "secondary"}
                        className={
                          entry.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {entry.isActive ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(entry)}>
                            {entry.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(entry)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit TAT Entry" : "Add TAT Entry"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update the transit time configuration"
                : "Add a new TAT entry to the matrix"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Transit Time</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Standard TAT *</Label>
                  <Input
                    type="number"
                    value={formData.transitDays}
                    onChange={(e) =>
                      setFormData({ ...formData, transitDays: e.target.value })
                    }
                    placeholder="3"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Min Days</Label>
                  <Input
                    type="number"
                    value={formData.minTransitDays}
                    onChange={(e) =>
                      setFormData({ ...formData, minTransitDays: e.target.value })
                    }
                    placeholder="2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max Days</Label>
                  <Input
                    type="number"
                    value={formData.maxTransitDays}
                    onChange={(e) =>
                      setFormData({ ...formData, maxTransitDays: e.target.value })
                    }
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cutoff Time</Label>
                <Input
                  type="time"
                  value={formData.cutoffTime}
                  onChange={(e) =>
                    setFormData({ ...formData, cutoffTime: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Orders placed after this time move to next day
                </p>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingEntry ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
