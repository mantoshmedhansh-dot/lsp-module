"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Upload,
  Download,
  RefreshCw,
  MapPin,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Truck,
  Clock,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface PincodeService {
  id: string;
  pincode: string;
  city: string;
  state: string;
  zone: string;
  isServiceable: boolean;
  isCodAvailable: boolean;
  isPrepaidAvailable: boolean;
  estimatedDays: number;
  transporters: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface Transporter {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

const zones = ["North", "South", "East", "West", "Central", "North-East"];

export default function PincodesPage() {
  const [pincodes, setPincodes] = useState<PincodeService[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [serviceableFilter, setServiceableFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingPincode, setEditingPincode] = useState<PincodeService | null>(null);

  const [formData, setFormData] = useState({
    pincode: "",
    city: "",
    state: "",
    zone: "North",
    isServiceable: true,
    isCodAvailable: true,
    isPrepaidAvailable: true,
    estimatedDays: 3,
    transporterIds: [] as string[],
  });

  const [stats, setStats] = useState({
    total: 0,
    serviceable: 0,
    codAvailable: 0,
    avgDeliveryDays: 0,
  });

  const fetchTransporters = useCallback(async () => {
    try {
      const response = await fetch("/api/transporters?limit=100&isActive=true");
      if (!response.ok) throw new Error("Failed to fetch transporters");
      const result = await response.json();
      setTransporters(result.data || []);
    } catch (error) {
      console.error("Error fetching transporters:", error);
    }
  }, []);

  const fetchPincodes = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("pincode", search);
      if (zoneFilter !== "all") params.set("zone", zoneFilter);
      if (serviceableFilter !== "all") {
        params.set("isServiceable", serviceableFilter === "serviceable" ? "true" : "false");
      }
      params.set("limit", "50");

      // Call serviceability API
      const response = await fetch(`/api/serviceability?${params}`);
      if (!response.ok) throw new Error("Failed to fetch pincodes");
      const result = await response.json();

      // Mock data for now since we don't have a dedicated pincodes table
      const mockPincodes: PincodeService[] = [
        {
          id: "1",
          pincode: "110001",
          city: "New Delhi",
          state: "Delhi",
          zone: "North",
          isServiceable: true,
          isCodAvailable: true,
          isPrepaidAvailable: true,
          estimatedDays: 2,
          transporters: transporters.slice(0, 3),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          pincode: "400001",
          city: "Mumbai",
          state: "Maharashtra",
          zone: "West",
          isServiceable: true,
          isCodAvailable: true,
          isPrepaidAvailable: true,
          estimatedDays: 3,
          transporters: transporters.slice(0, 4),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "3",
          pincode: "560001",
          city: "Bangalore",
          state: "Karnataka",
          zone: "South",
          isServiceable: true,
          isCodAvailable: true,
          isPrepaidAvailable: true,
          estimatedDays: 2,
          transporters: transporters.slice(0, 5),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      setPincodes(mockPincodes);

      // Calculate stats
      const serviceable = mockPincodes.filter((p) => p.isServiceable).length;
      const codAvailable = mockPincodes.filter((p) => p.isCodAvailable).length;
      const avgDays = mockPincodes.reduce((sum, p) => sum + p.estimatedDays, 0) / mockPincodes.length;

      setStats({
        total: mockPincodes.length,
        serviceable,
        codAvailable,
        avgDeliveryDays: Math.round(avgDays * 10) / 10,
      });
    } catch (error) {
      console.error("Error fetching pincodes:", error);
      toast.error("Failed to load pincode data");
    } finally {
      setIsLoading(false);
    }
  }, [search, zoneFilter, serviceableFilter, transporters]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  useEffect(() => {
    if (transporters.length > 0) {
      const debounce = setTimeout(() => {
        fetchPincodes();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [fetchPincodes, transporters.length]);

  function openAddDialog() {
    setEditingPincode(null);
    setFormData({
      pincode: "",
      city: "",
      state: "",
      zone: "North",
      isServiceable: true,
      isCodAvailable: true,
      isPrepaidAvailable: true,
      estimatedDays: 3,
      transporterIds: [],
    });
    setIsAddDialogOpen(true);
  }

  function openEditDialog(pincode: PincodeService) {
    setEditingPincode(pincode);
    setFormData({
      pincode: pincode.pincode,
      city: pincode.city,
      state: pincode.state,
      zone: pincode.zone,
      isServiceable: pincode.isServiceable,
      isCodAvailable: pincode.isCodAvailable,
      isPrepaidAvailable: pincode.isPrepaidAvailable,
      estimatedDays: pincode.estimatedDays,
      transporterIds: pincode.transporters.map((t) => t.id),
    });
    setIsAddDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }

    try {
      // This would call an API to save the pincode
      toast.success(
        editingPincode
          ? "Pincode updated successfully"
          : "Pincode added successfully"
      );
      setIsAddDialogOpen(false);
      fetchPincodes();
    } catch (error) {
      console.error("Error saving pincode:", error);
      toast.error("Failed to save pincode");
    }
  }

  async function handleToggleServiceable(pincode: PincodeService) {
    try {
      // This would call an API to toggle serviceability
      toast.success(
        `Pincode ${pincode.pincode} ${pincode.isServiceable ? "disabled" : "enabled"}`
      );
      fetchPincodes();
    } catch (error) {
      console.error("Error toggling pincode:", error);
      toast.error("Failed to update pincode");
    }
  }

  function toggleTransporter(transporterId: string) {
    setFormData((prev) => ({
      ...prev,
      transporterIds: prev.transporterIds.includes(transporterId)
        ? prev.transporterIds.filter((id) => id !== transporterId)
        : [...prev.transporterIds, transporterId],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Pincodes</h1>
          <p className="text-muted-foreground">
            Manage pincode serviceability and delivery zones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPincodes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pincode
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pincodes</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Serviceable</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.serviceable}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">COD Available</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.codAvailable}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Days</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.avgDeliveryDays}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by pincode, city, or state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={serviceableFilter} onValueChange={setServiceableFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="serviceable">Serviceable</SelectItem>
                <SelectItem value="non-serviceable">Non-Serviceable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pincodes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pincode List</CardTitle>
          <CardDescription>
            {pincodes.length} pincode(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : pincodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pincodes found</p>
              <Button variant="link" onClick={openAddDialog}>
                Add your first pincode
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pincode</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Transporters</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pincodes.map((pincode) => (
                  <TableRow key={pincode.id}>
                    <TableCell>
                      <code className="font-mono font-medium">{pincode.pincode}</code>
                    </TableCell>
                    <TableCell>{pincode.city}</TableCell>
                    <TableCell>{pincode.state}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pincode.zone}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {pincode.isCodAvailable && (
                          <Badge variant="secondary" className="text-xs">COD</Badge>
                        )}
                        {pincode.isPrepaidAvailable && (
                          <Badge variant="secondary" className="text-xs">Prepaid</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{pincode.estimatedDays} days</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{pincode.transporters.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={pincode.isServiceable ? "default" : "destructive"}
                        className={
                          pincode.isServiceable
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {pincode.isServiceable ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(pincode)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleServiceable(pincode)}
                          >
                            {pincode.isServiceable ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Disable
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Enable
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
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPincode ? "Edit Pincode" : "Add Pincode"}
            </DialogTitle>
            <DialogDescription>
              Configure pincode serviceability and delivery options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Pincode</Label>
                <Input
                  value={formData.pincode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  placeholder="110001"
                  maxLength={6}
                />
              </div>
              <div className="grid gap-2">
                <Label>Zone</Label>
                <Select
                  value={formData.zone}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, zone: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
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
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="New Delhi"
                />
              </div>
              <div className="grid gap-2">
                <Label>State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, state: e.target.value }))
                  }
                  placeholder="Delhi"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Estimated Delivery Days</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={formData.estimatedDays}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedDays: parseInt(e.target.value) || 3,
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Serviceable</Label>
                <Switch
                  checked={formData.isServiceable}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isServiceable: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>COD Available</Label>
                <Switch
                  checked={formData.isCodAvailable}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isCodAvailable: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Prepaid Available</Label>
                <Switch
                  checked={formData.isPrepaidAvailable}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isPrepaidAvailable: checked }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Transporters</Label>
              <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                {transporters.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.transporterIds.includes(t.id)}
                      onCheckedChange={() => toggleTransporter(t.id)}
                    />
                    <span className="text-sm">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingPincode ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Pincodes</DialogTitle>
            <DialogDescription>
              Upload a CSV file with pincode data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your CSV file here, or click to browse
              </p>
              <Button variant="outline" size="sm">
                Browse Files
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              CSV should have columns: pincode, city, state, zone, cod_available, prepaid_available, delivery_days
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
