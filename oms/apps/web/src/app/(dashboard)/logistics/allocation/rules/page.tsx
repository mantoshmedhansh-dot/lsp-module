"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  GripVertical,
  Settings2,
  CheckCircle2,
  XCircle,
  Zap,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AllocationRule {
  id: string;
  name: string;
  description: string | null;
  shipmentType: string;
  priority: number;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SHIPMENT_TYPES = [
  { value: "FTL", label: "FTL (Full Truck Load)" },
  { value: "B2B_PTL", label: "B2B/PTL (Part Truck Load)" },
  { value: "B2C", label: "B2C (Courier)" },
  { value: "ALL", label: "All Types" },
];

const CONDITION_FIELDS = [
  { value: "weight_kg", label: "Weight (kg)" },
  { value: "value_inr", label: "Order Value (INR)" },
  { value: "origin_zone", label: "Origin Zone" },
  { value: "destination_zone", label: "Destination Zone" },
  { value: "pincode", label: "Pincode" },
  { value: "channel", label: "Sales Channel" },
  { value: "payment_mode", label: "Payment Mode" },
  { value: "priority", label: "Order Priority" },
];

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
  { value: "contains", label: "contains" },
];

export default function AllocationRulesPage() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AllocationRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    shipmentType: "",
    priority: "100",
    conditionsJson: "{}",
    actionsJson: "{}",
    isActive: true,
  });

  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (typeFilter) params.set("shipment_type", typeFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/allocation-config/rules?${params}`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      const result = await response.json();
      setRules(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Failed to load rules");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  function resetForm() {
    setFormData({
      name: "",
      description: "",
      shipmentType: "",
      priority: "100",
      conditionsJson: "{}",
      actionsJson: "{}",
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
      name: rule.name,
      description: rule.description || "",
      shipmentType: rule.shipmentType,
      priority: rule.priority.toString(),
      conditionsJson: JSON.stringify(rule.conditions, null, 2),
      actionsJson: JSON.stringify(rule.actions, null, 2),
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.name || !formData.shipmentType) {
      toast.error("Please fill in all required fields");
      return;
    }

    let conditions = {};
    let actions = {};
    try {
      conditions = JSON.parse(formData.conditionsJson);
      actions = JSON.parse(formData.actionsJson);
    } catch {
      toast.error("Invalid JSON in conditions or actions");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: formData.name,
        description: formData.description || null,
        shipment_type: formData.shipmentType,
        priority: parseInt(formData.priority) || 100,
        conditions,
        actions,
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

      if (!response.ok) throw new Error("Failed to save rule");
      toast.success(editingRule ? "Rule updated" : "Rule created");
      setIsDialogOpen(false);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(rule: AllocationRule) {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const response = await fetch(`/api/v1/allocation-config/rules/${rule.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      toast.success("Rule deleted");
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

  function getShipmentTypeBadge(type: string) {
    const colors: Record<string, string> = {
      FTL: "bg-blue-100 text-blue-800",
      B2B_PTL: "bg-purple-100 text-purple-800",
      B2C: "bg-green-100 text-green-800",
      ALL: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-800"}>
        {type}
      </Badge>
    );
  }

  // Stats
  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.isActive).length,
    ftl: rules.filter((r) => r.shipmentType === "FTL").length,
    ptl: rules.filter((r) => r.shipmentType === "B2B_PTL").length,
    b2c: rules.filter((r) => r.shipmentType === "B2C").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocation Rules</h1>
          <p className="text-muted-foreground">
            Configure rules for automatic carrier allocation
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Settings2 className="h-5 w-5 text-blue-600" />
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
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">FTL Rules</p>
                <p className="text-2xl font-bold">{stats.ftl}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PTL Rules</p>
                <p className="text-2xl font-bold">{stats.ptl}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">B2C Rules</p>
                <p className="text-2xl font-bold">{stats.b2c}</p>
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
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {SHIPMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Rules are evaluated in order of priority (lower number = higher priority)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Order</TableHead>
                <TableHead>Rule Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Settings2 className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No rules found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule, index) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <span className="text-muted-foreground">{index + 1}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {rule.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getShipmentTypeBadge(rule.shipmentType)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(rule.conditions).length} condition(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.isActive ? "default" : "secondary"}
                        className={
                          rule.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
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
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(rule)}>
                            {rule.isActive ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              Configure conditions and actions for carrier allocation
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Rule Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., High Value FTL"
                />
              </div>
              <div className="grid gap-2">
                <Label>Shipment Type *</Label>
                <Select
                  value={formData.shipmentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, shipmentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIPMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this rule"
              />
            </div>

            <div className="grid gap-2">
              <Label>Priority (lower = higher priority)</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                placeholder="100"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Conditions (JSON)</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Define when this rule should be applied. Example:
                {`{"weight_kg": {"gte": 500}, "origin_zone": {"eq": "NORTH"}}`}
              </p>
              <Textarea
                value={formData.conditionsJson}
                onChange={(e) =>
                  setFormData({ ...formData, conditionsJson: e.target.value })
                }
                placeholder="{}"
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Actions (JSON)</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Define what happens when rule matches. Example:
                {`{"prefer_carriers": ["vendor_id_1"], "allocation_mode": "AUTO"}`}
              </p>
              <Textarea
                value={formData.actionsJson}
                onChange={(e) =>
                  setFormData({ ...formData, actionsJson: e.target.value })
                }
                placeholder="{}"
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
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
