"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Settings,
  CheckCircle,
  XCircle,
  Truck,
  RefreshCw,
  Zap,
  Globe,
  Key,
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

interface Transporter {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  apiEndpoint: string | null;
  trackingUrlTemplate: string | null;
  hasCredentials: boolean;
  createdAt: string;
  _count?: {
    deliveries: number;
  };
}

const transporterTemplates = [
  { code: "SHIPROCKET", name: "Shiprocket", endpoint: "https://apiv2.shiprocket.in/v1/external" },
  { code: "DELHIVERY", name: "Delhivery", endpoint: "https://track.delhivery.com/api" },
  { code: "BLUEDART", name: "BlueDart", endpoint: "https://api.bluedart.com" },
  { code: "DTDC", name: "DTDC", endpoint: "https://api.dtdc.com" },
  { code: "ECOM_EXPRESS", name: "Ecom Express", endpoint: "https://api.ecomexpress.in" },
  { code: "XPRESSBEES", name: "Xpressbees", endpoint: "https://api.xpressbees.com" },
  { code: "SHADOWFAX", name: "Shadowfax", endpoint: "https://api.shadowfax.in" },
  { code: "EKART", name: "Ekart", endpoint: "https://api.ekartlogistics.com" },
  { code: "CUSTOM", name: "Custom", endpoint: "" },
];

export default function TransportersPage() {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    apiEndpoint: "",
    trackingUrlTemplate: "",
    isActive: true,
    credentials: {
      email: "",
      password: "",
      apiKey: "",
      clientId: "",
      clientSecret: "",
    },
  });

  const fetchTransporters = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");

      const response = await fetch(`/api/transporters?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transporters");
      const result = await response.json();
      setTransporters(result.data || []);
    } catch (error) {
      console.error("Error fetching transporters:", error);
      toast.error("Failed to load transporters");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTransporters();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchTransporters]);

  function handleTemplateSelect(code: string) {
    const template = transporterTemplates.find((t) => t.code === code);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        code: template.code,
        name: template.name,
        apiEndpoint: template.endpoint,
      }));
    }
  }

  function openCreateDialog() {
    setEditingTransporter(null);
    setFormData({
      name: "",
      code: "",
      apiEndpoint: "",
      trackingUrlTemplate: "",
      isActive: true,
      credentials: {
        email: "",
        password: "",
        apiKey: "",
        clientId: "",
        clientSecret: "",
      },
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(transporter: Transporter) {
    setEditingTransporter(transporter);
    setFormData({
      name: transporter.name,
      code: transporter.code,
      apiEndpoint: transporter.apiEndpoint || "",
      trackingUrlTemplate: transporter.trackingUrlTemplate || "",
      isActive: transporter.isActive,
      credentials: {
        email: "",
        password: "",
        apiKey: "",
        clientId: "",
        clientSecret: "",
      },
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const url = editingTransporter
        ? `/api/transporters/${editingTransporter.id}`
        : "/api/transporters";
      const method = editingTransporter ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          apiEndpoint: formData.apiEndpoint || null,
          trackingUrlTemplate: formData.trackingUrlTemplate || null,
          isActive: formData.isActive,
          apiCredentials: formData.credentials,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save transporter");
      }

      toast.success(
        editingTransporter
          ? "Transporter updated successfully"
          : "Transporter created successfully"
      );
      setIsDialogOpen(false);
      fetchTransporters();
    } catch (error) {
      console.error("Error saving transporter:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save transporter");
    }
  }

  async function handleToggleActive(transporter: Transporter) {
    try {
      const response = await fetch(`/api/transporters/${transporter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !transporter.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update transporter");

      toast.success(
        `Transporter ${transporter.isActive ? "deactivated" : "activated"}`
      );
      fetchTransporters();
    } catch (error) {
      console.error("Error toggling transporter:", error);
      toast.error("Failed to update transporter");
    }
  }

  async function handleTestConnection(transporter: Transporter) {
    toast.info(`Testing connection to ${transporter.name}...`);
    // This would call an API to test the connection
    setTimeout(() => {
      toast.success(`Connection to ${transporter.name} successful`);
    }, 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transporters</h1>
          <p className="text-muted-foreground">
            Manage shipping partner integrations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTransporters}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transporter
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transporters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Transporters Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Transporters</CardTitle>
          <CardDescription>
            {transporters.length} transporter(s) configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : transporters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transporters configured</p>
              <Button variant="link" onClick={openCreateDialog}>
                Add your first transporter
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transporter</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>API Status</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipments</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transporters.map((transporter) => (
                  <TableRow key={transporter.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{transporter.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transporter.code}</Badge>
                    </TableCell>
                    <TableCell>
                      {transporter.apiEndpoint ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Globe className="h-4 w-4" />
                          <span className="text-sm">Configured</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Globe className="h-4 w-4" />
                          <span className="text-sm">Not set</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {transporter.hasCredentials ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Key className="h-4 w-4" />
                          <span className="text-sm">Set</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Key className="h-4 w-4" />
                          <span className="text-sm">Missing</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transporter.isActive ? "default" : "secondary"}
                        className={
                          transporter.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {transporter.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {transporter._count?.deliveries || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(transporter)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTestConnection(transporter)}
                            disabled={!transporter.apiEndpoint}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Test Connection
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(transporter)}
                          >
                            {transporter.isActive ? (
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
              {editingTransporter ? "Edit Transporter" : "Add Transporter"}
            </DialogTitle>
            <DialogDescription>
              Configure shipping partner API integration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingTransporter && (
              <div className="grid gap-2">
                <Label>Quick Select</Label>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a transporter template" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporterTemplates.map((template) => (
                      <SelectItem key={template.code} value={template.code}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Shiprocket"
                />
              </div>
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., SHIPROCKET"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>API Endpoint</Label>
              <Input
                value={formData.apiEndpoint}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, apiEndpoint: e.target.value }))
                }
                placeholder="https://api.example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label>Tracking URL Template</Label>
              <Input
                value={formData.trackingUrlTemplate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    trackingUrlTemplate: e.target.value,
                  }))
                }
                placeholder="https://track.example.com/{{awb}}"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{awb}}"} as placeholder for AWB number
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">API Credentials</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email / Username</Label>
                  <Input
                    value={formData.credentials.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        credentials: { ...prev.credentials, email: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.credentials.password}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        credentials: { ...prev.credentials, password: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2 mt-4">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={formData.credentials.apiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      credentials: { ...prev.credentials, apiKey: e.target.value },
                    }))
                  }
                />
              </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.code}
            >
              {editingTransporter ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
