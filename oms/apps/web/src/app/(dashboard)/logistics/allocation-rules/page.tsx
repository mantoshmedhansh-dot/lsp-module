"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  Edit,
  Trash2,
  ArrowUpDown,
  Settings,
  MoreHorizontal,
  Loader2,
  RefreshCw,
  Truck,
  ListChecks,
  History,
} from "lucide-react";
import { toast } from "sonner";

interface AllocationRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priority: number;
  shipmentType: string | null;
  conditions: Record<string, unknown> | null;
  transporterId: string | null;
  transporterName?: string;
  useCSRScoring: boolean;
  csrConfigId: string | null;
  csrConfigName?: string;
  fallbackTransporterId: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

interface Transporter {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface CSRConfig {
  id: string;
  name: string;
  isDefault: boolean;
}

const SHIPMENT_TYPES = [
  { value: "B2C", label: "B2C Courier" },
  { value: "B2B", label: "B2B / PTL" },
  { value: "FTL", label: "FTL" },
];

export default function AllocationRulesPage() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [csrConfigs, setCSRConfigs] = useState<CSRConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AllocationRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    priority: "10",
    shipmentType: "",
    transporterId: "",
    useCSRScoring: false,
    csrConfigId: "",
    fallbackTransporterId: "",
    isActive: true,
  });

  const fetchRules = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);

      const response = await fetch("/api/v1/allocation-config/rules?limit=100");
      if (!response.ok) throw new Error("Failed to fetch rules");
      const result = await response.json();
      setRules(Array.isArray(result) ? result : result.data || []);

      if (showRefreshing) toast.success("Rules refreshed");
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to load allocation rules");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchTransporters = async () => {
    try {
      const response = await fetch("/api/v1/transporters?isActive=true&limit=100");
      if (!response.ok) return;
      const result = await response.json();
      setTransporters(Array.isArray(result) ? result : result.items || []);
    } catch (error) {
      console.error("Error fetching transporters:", error);
    }
  };

  const fetchCSRConfigs = async () => {
    try {
      const response = await fetch("/api/v1/allocation-config/csr-configs?limit=50");
      if (!response.ok) return;
      const result = await response.json();
      setCSRConfigs(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching CSR configs:", error);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchTransporters();
    fetchCSRConfigs();
  }, [fetchRules]);

  function resetForm() {
    setFormData({
      code: "",
      name: "",
      description: "",
      priority: "10",
      shipmentType: "",
      transporterId: "",
      useCSRScoring: false,
      csrConfigId: "",
      fallbackTransporterId: "",
      isActive: true,
    });
    setEditingRule(null);
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(rule: AllocationRule) {
    setEditingRule(rule);
    setFormData({
      code: rule.code,
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority.toString(),
      shipmentType: rule.shipmentType || "",
      transporterId: rule.transporterId || "",
      useCSRScoring: rule.useCSRScoring,
      csrConfigId: rule.csrConfigId || "",
      fallbackTransporterId: rule.fallbackTransporterId || "",
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.code || !formData.name) {
      toast.error("Please fill in code and name");
      return;
    }

    if (!formData.transporterId && !formData.useCSRScoring) {
      toast.error("Either select a transporter or enable CSR scoring");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        priority: parseInt(formData.priority) || 10,
        shipment_type: formData.shipmentType || null,
        transporter_id: formData.transporterId || null,
        use_csr_scoring: formData.useCSRScoring,
        csr_config_id: formData.csrConfigId || null,
        fallback_transporter_id: formData.fallbackTransporterId || null,
        is_active: formData.isActive,
      };

      const url = editingRule
        ? `/api/v1/allocation-config/rules/${editingRule.id}`
        : "/api/v1/allocation-config/rules";
      const method = editingRule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save rule");
      }

      toast.success(editingRule ? "Rule updated" : "Rule created");
      setIsDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (error: unknown) {
      console.error("Error saving rule:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(rule: AllocationRule) {
    if (!confirm(`Are you sure you want to deactivate "${rule.name}"?`)) return;

    try {
      const response = await fetch(`/api/v1/allocation-config/rules/${rule.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      toast.success("Rule deactivated");
      fetchRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    }
  }

  async function handleToggleActive(rule: AllocationRule) {
    try {
      const response = await fetch(`/api/v1/allocation-config/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.isActive }),
      });
      if (!response.ok) throw new Error("Failed to update rule");
      toast.success(rule.isActive ? "Rule deactivated" : "Rule activated");
      fetchRules();
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error("Failed to update rule");
    }
  }

  const statusColors: Record<string, string> = {
    true: "bg-green-100 text-green-800",
    false: "bg-gray-100 text-gray-800",
  };

  // Stats
  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.isActive).length,
    usingCSR: rules.filter((r) => r.useCSRScoring).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocation Rules</h1>
          <p className="text-muted-foreground">
            Configure automatic courier allocation based on order attributes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchRules(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Using CSR Scoring</p>
                <p className="text-2xl font-bold">{stats.usingCSR}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rule Configuration</CardTitle>
          <CardDescription>
            Rules are evaluated in priority order. First matching rule wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No allocation rules configured</p>
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">
                    <div className="flex items-center gap-1">
                      Priority
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned Courier</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono">{rule.priority}</TableCell>
                    <TableCell className="font-medium">{rule.code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-muted-foreground">
                            {rule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.shipmentType ? (
                        <Badge variant="outline">{rule.shipmentType}</Badge>
                      ) : (
                        <span className="text-muted-foreground">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.transporterName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.useCSRScoring ? (
                        <Badge className="bg-purple-100 text-purple-800">
                          CSR Scoring
                        </Badge>
                      ) : (
                        <Badge variant="outline">Direct</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[String(rule.isActive)]}>
                        {rule.isActive ? "Active" : "Inactive"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(rule)}>
                            {rule.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(rule)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "New Allocation Rule"}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the allocation rule configuration"
                : "Configure a new courier allocation rule"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., METRO_EXPRESS"
                  disabled={!!editingRule}
                />
              </div>
              <div className="grid gap-2">
                <Label>Priority *</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">Lower = higher priority</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Rule Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Metro Express Delivery"
              />
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Rule description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Shipment Type</Label>
                <Select
                  value={formData.shipmentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, shipmentType: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {SHIPMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="useCSRScoring"
                  checked={formData.useCSRScoring}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, useCSRScoring: checked })
                  }
                />
                <Label htmlFor="useCSRScoring">Use CSR Scoring</Label>
              </div>
            </div>

            {!formData.useCSRScoring && (
              <div className="grid gap-2">
                <Label>Assign to Transporter *</Label>
                <Select
                  value={formData.transporterId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, transporterId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.useCSRScoring && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CSR Config</Label>
                  <Select
                    value={formData.csrConfigId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, csrConfigId: value === "default" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Use default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use Default</SelectItem>
                      {csrConfigs.map((cfg) => (
                        <SelectItem key={cfg.id} value={cfg.id}>
                          {cfg.name} {cfg.isDefault && "(Default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Fallback Transporter</Label>
                  <Select
                    value={formData.fallbackTransporterId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fallbackTransporterId: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No fallback" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Fallback</SelectItem>
                      {transporters.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
