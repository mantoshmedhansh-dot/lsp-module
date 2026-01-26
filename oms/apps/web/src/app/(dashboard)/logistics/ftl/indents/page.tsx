"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Truck,
  MapPin,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FTL_INDENT_STATUSES, getStatusConfig } from "@/lib/constants/statuses";

interface FTLIndent {
  id: string;
  indentNumber: string;
  vendorId: string;
  vendorName: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  originCity: string;
  originAddress: string;
  destinationCity: string;
  destinationAddress: string;
  pickupDate: string;
  expectedDeliveryDate: string;
  status: string;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  agreedRate: number;
  advanceAmount: number | null;
  balanceAmount: number | null;
  weightKg: number | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface VehicleType {
  id: string;
  code: string;
  name: string;
}

// Use centralized status config
const INDENT_STATUSES = FTL_INDENT_STATUSES;

export default function FTLIndentsPage() {
  const [indents, setIndents] = useState<FTLIndent[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState<FTLIndent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: "",
    vehicleTypeId: "",
    originCity: "",
    originAddress: "",
    destinationCity: "",
    destinationAddress: "",
    pickupDate: "",
    expectedDeliveryDate: "",
    agreedRate: "",
    advanceAmount: "",
    weightKg: "",
    remarks: "",
  });

  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "",
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    remarks: "",
  });

  const fetchIndents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (vendorFilter) params.set("vendor_id", vendorFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/ftl/indents?${params}`);
      if (!response.ok) throw new Error("Failed to fetch indents");
      const result = await response.json();
      setIndents(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching indents:", error);
      toast.error("Failed to load indents");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, vendorFilter]);

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

  useEffect(() => {
    fetchVendors();
    fetchVehicleTypes();
  }, []);

  useEffect(() => {
    fetchIndents();
  }, [fetchIndents]);

  function resetForm() {
    setFormData({
      vendorId: "",
      vehicleTypeId: "",
      originCity: "",
      originAddress: "",
      destinationCity: "",
      destinationAddress: "",
      pickupDate: "",
      expectedDeliveryDate: "",
      agreedRate: "",
      advanceAmount: "",
      weightKg: "",
      remarks: "",
    });
  }

  async function handleCreateIndent() {
    if (!formData.vendorId || !formData.vehicleTypeId || !formData.originCity || !formData.destinationCity) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/v1/ftl/indents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: formData.vendorId,
          vehicle_type_id: formData.vehicleTypeId,
          origin_city: formData.originCity,
          origin_address: formData.originAddress,
          destination_city: formData.destinationCity,
          destination_address: formData.destinationAddress,
          pickup_date: formData.pickupDate || null,
          expected_delivery_date: formData.expectedDeliveryDate || null,
          agreed_rate: formData.agreedRate ? parseFloat(formData.agreedRate) : 0,
          advance_amount: formData.advanceAmount ? parseFloat(formData.advanceAmount) : null,
          weight_kg: formData.weightKg ? parseFloat(formData.weightKg) : null,
          remarks: formData.remarks || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to create indent");
      toast.success("Indent created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchIndents();
    } catch (error) {
      console.error("Error creating indent:", error);
      toast.error("Failed to create indent");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateStatus() {
    if (!selectedIndent || !statusUpdateData.status) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/v1/ftl/indents/${selectedIndent.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusUpdateData.status,
          vehicle_number: statusUpdateData.vehicleNumber || null,
          driver_name: statusUpdateData.driverName || null,
          driver_phone: statusUpdateData.driverPhone || null,
          remarks: statusUpdateData.remarks || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      toast.success("Status updated successfully");
      setIsStatusDialogOpen(false);
      setSelectedIndent(null);
      fetchIndents();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsSaving(false);
    }
  }

  function openStatusDialog(indent: FTLIndent) {
    setSelectedIndent(indent);
    setStatusUpdateData({
      status: indent.status,
      vehicleNumber: indent.vehicleNumber || "",
      driverName: indent.driverName || "",
      driverPhone: indent.driverPhone || "",
      remarks: "",
    });
    setIsStatusDialogOpen(true);
  }

  function openViewDialog(indent: FTLIndent) {
    setSelectedIndent(indent);
    setIsViewDialogOpen(true);
  }

  function getStatusBadge(status: string) {
    const statusConfig = INDENT_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-gray-100 text-gray-800"}>
        {statusConfig?.label || status}
      </Badge>
    );
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Stats
  const stats = {
    total: indents.length,
    inTransit: indents.filter((i) => i.status === "IN_TRANSIT").length,
    delivered: indents.filter((i) => i.status === "DELIVERED" || i.status === "COMPLETED").length,
    pending: indents.filter((i) => ["DRAFT", "REQUESTED", "CONFIRMED"].includes(i.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FTL Indents</h1>
          <p className="text-muted-foreground">
            Manage full truck load bookings and track shipments
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Indent
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Indents</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Transit</p>
                <p className="text-2xl font-bold">{stats.inTransit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{stats.delivered}</p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
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
                placeholder="Search by indent number, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {INDENT_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Indents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Indents</CardTitle>
          <CardDescription>
            {indents.length} indent(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indent #</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>Rate</TableHead>
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
              ) : indents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No indents found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                indents.map((indent) => (
                  <TableRow key={indent.id}>
                    <TableCell>
                      <div className="font-medium">{indent.indentNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(indent.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {indent.originCity} → {indent.destinationCity}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{indent.vendorName}</div>
                    </TableCell>
                    <TableCell>
                      <div>{indent.vehicleTypeName}</div>
                      {indent.vehicleNumber && (
                        <div className="text-xs text-muted-foreground">
                          {indent.vehicleNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {indent.pickupDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(indent.pickupDate)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(indent.agreedRate)}
                      </div>
                      {indent.advanceAmount && (
                        <div className="text-xs text-muted-foreground">
                          Adv: {formatCurrency(indent.advanceAmount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(indent.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(indent)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openStatusDialog(indent)}>
                            <Clock className="mr-2 h-4 w-4" />
                            Update Status
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

      {/* Create Indent Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create FTL Indent</DialogTitle>
            <DialogDescription>
              Book a full truck load shipment with a vendor
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Vehicle Type *</Label>
                <Select
                  value={formData.vehicleTypeId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vehicleTypeId: value })
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
              <h4 className="font-medium mb-3">Origin</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>City *</Label>
                  <Input
                    value={formData.originCity}
                    onChange={(e) =>
                      setFormData({ ...formData, originCity: e.target.value })
                    }
                    placeholder="e.g., Mumbai"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.originAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, originAddress: e.target.value })
                    }
                    placeholder="Full pickup address"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Destination</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>City *</Label>
                  <Input
                    value={formData.destinationCity}
                    onChange={(e) =>
                      setFormData({ ...formData, destinationCity: e.target.value })
                    }
                    placeholder="e.g., Delhi"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.destinationAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, destinationAddress: e.target.value })
                    }
                    placeholder="Full delivery address"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Schedule & Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Pickup Date</Label>
                  <Input
                    type="date"
                    value={formData.pickupDate}
                    onChange={(e) =>
                      setFormData({ ...formData, pickupDate: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expected Delivery Date</Label>
                  <Input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedDeliveryDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="grid gap-2">
                  <Label>Agreed Rate (INR) *</Label>
                  <Input
                    type="number"
                    value={formData.agreedRate}
                    onChange={(e) =>
                      setFormData({ ...formData, agreedRate: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Advance Amount</Label>
                  <Input
                    type="number"
                    value={formData.advanceAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, advanceAmount: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Weight (KG)</Label>
                  <Input
                    type="number"
                    value={formData.weightKg}
                    onChange={(e) =>
                      setFormData({ ...formData, weightKg: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
                placeholder="Any special instructions..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateIndent} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Indent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Indent Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Indent Details</DialogTitle>
            <DialogDescription>
              {selectedIndent?.indentNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedIndent && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedIndent.status)}
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Route
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Origin</p>
                    <p className="font-medium">{selectedIndent.originCity}</p>
                    {selectedIndent.originAddress && (
                      <p className="text-sm text-muted-foreground">
                        {selectedIndent.originAddress}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{selectedIndent.destinationCity}</p>
                    {selectedIndent.destinationAddress && (
                      <p className="text-sm text-muted-foreground">
                        {selectedIndent.destinationAddress}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Vehicle & Vendor
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{selectedIndent.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle Type</p>
                    <p className="font-medium">{selectedIndent.vehicleTypeName}</p>
                  </div>
                  {selectedIndent.vehicleNumber && (
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle Number</p>
                      <p className="font-medium">{selectedIndent.vehicleNumber}</p>
                    </div>
                  )}
                  {selectedIndent.driverName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Driver</p>
                      <p className="font-medium">
                        {selectedIndent.driverName}
                        {selectedIndent.driverPhone && ` (${selectedIndent.driverPhone})`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Schedule & Pricing
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pickup Date</p>
                    <p className="font-medium">
                      {selectedIndent.pickupDate
                        ? formatDate(selectedIndent.pickupDate)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">
                      {selectedIndent.expectedDeliveryDate
                        ? formatDate(selectedIndent.expectedDeliveryDate)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agreed Rate</p>
                    <p className="font-medium">
                      {formatCurrency(selectedIndent.agreedRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Advance</p>
                    <p className="font-medium">
                      {selectedIndent.advanceAmount
                        ? formatCurrency(selectedIndent.advanceAmount)
                        : "-"}
                    </p>
                  </div>
                  {selectedIndent.weightKg && (
                    <div>
                      <p className="text-sm text-muted-foreground">Weight</p>
                      <p className="font-medium">{selectedIndent.weightKg} kg</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedIndent.remarks && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Remarks</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedIndent.remarks}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {selectedIndent && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                openStatusDialog(selectedIndent);
              }}>
                Update Status
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Indent Status</DialogTitle>
            <DialogDescription>
              {selectedIndent?.indentNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status *</Label>
              <Select
                value={statusUpdateData.status}
                onValueChange={(value) =>
                  setStatusUpdateData({ ...statusUpdateData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {INDENT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(statusUpdateData.status === "VEHICLE_ASSIGNED" ||
              statusUpdateData.status === "IN_TRANSIT") && (
              <>
                <div className="grid gap-2">
                  <Label>Vehicle Number</Label>
                  <Input
                    value={statusUpdateData.vehicleNumber}
                    onChange={(e) =>
                      setStatusUpdateData({
                        ...statusUpdateData,
                        vehicleNumber: e.target.value,
                      })
                    }
                    placeholder="e.g., MH12AB1234"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Driver Name</Label>
                    <Input
                      value={statusUpdateData.driverName}
                      onChange={(e) =>
                        setStatusUpdateData({
                          ...statusUpdateData,
                          driverName: e.target.value,
                        })
                      }
                      placeholder="Driver name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Driver Phone</Label>
                    <Input
                      value={statusUpdateData.driverPhone}
                      onChange={(e) =>
                        setStatusUpdateData({
                          ...statusUpdateData,
                          driverPhone: e.target.value,
                        })
                      }
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Textarea
                value={statusUpdateData.remarks}
                onChange={(e) =>
                  setStatusUpdateData({
                    ...statusUpdateData,
                    remarks: e.target.value,
                  })
                }
                placeholder="Any notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isSaving}>
              {isSaving ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
