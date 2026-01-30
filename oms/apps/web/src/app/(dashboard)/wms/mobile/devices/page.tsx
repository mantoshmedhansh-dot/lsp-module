"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Tablet,
  Scan,
  Edit,
  Trash2,
  User,
  MapPin,
  Settings,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface MobileDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  status: string;
  assignedLocationId: string | null;
  assignedLocationName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  lastActiveAt: string | null;
  batteryLevel: number | null;
  registeredAt: string;
}

interface Location {
  id: string;
  locationCode: string;
  locationName: string;
}

interface User {
  id: string;
  name: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<MobileDevice | null>(null);
  const [formData, setFormData] = useState({
    deviceName: "",
    deviceType: "SMARTPHONE",
    manufacturer: "",
    model: "",
    assignedLocationId: "",
    assignedUserId: "",
  });

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/mobile/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const data = await response.json();
        setLocations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/users?role=WAREHOUSE_WORKER");
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDevices(), fetchLocations(), fetchUsers()]);
    setIsLoading(false);
  }, [fetchDevices, fetchLocations, fetchUsers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async () => {
    try {
      const url = editingDevice
        ? `/api/v1/mobile/devices/${editingDevice.id}`
        : "/api/v1/mobile/register";
      const method = editingDevice ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingDevice ? "Device updated" : "Device registered");
        setIsDialogOpen(false);
        setEditingDevice(null);
        resetForm();
        fetchDevices();
      } else {
        toast.error("Failed to save device");
      }
    } catch (error) {
      toast.error("Error saving device");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this device?")) return;
    try {
      const response = await fetch(`/api/v1/mobile/devices/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Device removed");
        fetchDevices();
      }
    } catch (error) {
      toast.error("Failed to remove device");
    }
  };

  const updateDeviceStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/v1/mobile/devices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        toast.success(`Device ${status.toLowerCase()}`);
        fetchDevices();
      }
    } catch (error) {
      toast.error("Failed to update device");
    }
  };

  const resetForm = () => {
    setFormData({
      deviceName: "",
      deviceType: "SMARTPHONE",
      manufacturer: "",
      model: "",
      assignedLocationId: "",
      assignedUserId: "",
    });
  };

  const openEditDialog = (device: MobileDevice) => {
    setEditingDevice(device);
    setFormData({
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer || "",
      model: device.model || "",
      assignedLocationId: device.assignedLocationId || "",
      assignedUserId: device.assignedUserId || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800"><Wifi className="mr-1 h-3 w-3" />Active</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-red-100 text-red-800"><WifiOff className="mr-1 h-3 w-3" />Suspended</Badge>;
      case "DECOMMISSIONED":
        return <Badge variant="secondary">Decommissioned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "TABLET":
        return <Tablet className="h-5 w-5" />;
      case "HANDHELD_SCANNER":
        return <Scan className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const activeDevices = devices.filter((d) => d.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Management</h1>
          <p className="text-muted-foreground">
            Register and manage mobile WMS devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingDevice(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Register Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDevice ? "Edit Device" : "Register Device"}</DialogTitle>
                <DialogDescription>
                  {editingDevice ? "Update device configuration" : "Add a new mobile device"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Device Name</Label>
                  <Input
                    placeholder="e.g., Scanner-01"
                    value={formData.deviceName}
                    onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select
                    value={formData.deviceType}
                    onValueChange={(v) => setFormData({ ...formData, deviceType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMARTPHONE">Smartphone</SelectItem>
                      <SelectItem value="TABLET">Tablet</SelectItem>
                      <SelectItem value="HANDHELD_SCANNER">Handheld Scanner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Manufacturer</Label>
                    <Input
                      placeholder="e.g., Zebra"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      placeholder="e.g., TC52"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Location</Label>
                  <Select
                    value={formData.assignedLocationId}
                    onValueChange={(v) => setFormData({ ...formData, assignedLocationId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.locationName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned User (Optional)</Label>
                  <Select
                    value={formData.assignedUserId}
                    onValueChange={(v) => setFormData({ ...formData, assignedUserId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingDevice ? "Update" : "Register"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDevices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length - activeDevices}</div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
          <CardDescription>Mobile devices for warehouse operations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No devices registered</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Register First Device
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          {getDeviceIcon(device.deviceType)}
                        </div>
                        <div>
                          <p className="font-medium">{device.deviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.manufacturer} {device.model}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{device.deviceType.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      {device.assignedLocationName ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {device.assignedLocationName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {device.assignedUserName ? (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {device.assignedUserName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.lastActiveAt
                        ? new Date(device.lastActiveAt).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {device.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateDeviceStatus(device.id, "SUSPENDED")}
                          >
                            <WifiOff className="h-4 w-4" />
                          </Button>
                        ) : device.status === "SUSPENDED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateDeviceStatus(device.id, "ACTIVE")}
                          >
                            <Wifi className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(device)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(device.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
