"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft,
  Plus,
  RefreshCw,
  CheckCircle,
  Pause,
  Play,
  Edit,
  Trash2,
  Settings,
  Clock,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface CrossDockRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  description: string;
  priority: number;
  triggerType: string;
  conditions: string;
  sourceType: string;
  destinationType: string;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

export default function CrossDockRulesPage() {
  const [rules, setRules] = useState<CrossDockRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CrossDockRule | null>(null);
  const [formData, setFormData] = useState({
    ruleCode: "",
    ruleName: "",
    description: "",
    priority: 1,
    triggerType: "INBOUND_RECEIPT",
    conditions: "",
    sourceType: "RECEIVING_DOCK",
    destinationType: "SHIPPING_DOCK",
  });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/cross-dock/rules");
      if (response.ok) {
        const data = await response.json();
        setRules(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSubmit = async () => {
    try {
      const url = editingRule
        ? `/api/v1/cross-dock/rules/${editingRule.id}`
        : "/api/v1/cross-dock/rules";
      const method = editingRule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingRule ? "Rule updated" : "Rule created");
        setIsDialogOpen(false);
        setEditingRule(null);
        resetForm();
        fetchRules();
      } else {
        toast.error("Failed to save rule");
      }
    } catch (error) {
      toast.error("Error saving rule");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      const response = await fetch(`/api/v1/cross-dock/rules/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Rule deleted");
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  const toggleRuleStatus = async (rule: CrossDockRule) => {
    try {
      const response = await fetch(`/api/v1/cross-dock/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (response.ok) {
        toast.success(`Rule ${rule.isActive ? "disabled" : "enabled"}`);
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to update rule");
    }
  };

  const resetForm = () => {
    setFormData({
      ruleCode: "",
      ruleName: "",
      description: "",
      priority: 1,
      triggerType: "INBOUND_RECEIPT",
      conditions: "",
      sourceType: "RECEIVING_DOCK",
      destinationType: "SHIPPING_DOCK",
    });
  };

  const openEditDialog = (rule: CrossDockRule) => {
    setEditingRule(rule);
    setFormData({
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      description: rule.description,
      priority: rule.priority,
      triggerType: rule.triggerType,
      conditions: rule.conditions,
      sourceType: rule.sourceType,
      destinationType: rule.destinationType,
    });
    setIsDialogOpen(true);
  };

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case "INBOUND_RECEIPT":
        return <Badge className="bg-blue-100 text-blue-800">Inbound Receipt</Badge>;
      case "ORDER_CREATED":
        return <Badge className="bg-green-100 text-green-800">Order Created</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-purple-100 text-purple-800">Scheduled</Badge>;
      case "MANUAL":
        return <Badge className="bg-gray-100 text-gray-800">Manual</Badge>;
      default:
        return <Badge variant="outline">{trigger}</Badge>;
    }
  };

  const activeRules = rules.filter((r) => r.isActive).length;
  const totalExecutions = rules.reduce((sum, r) => sum + r.executionCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cross-Docking Rules</h1>
          <p className="text-muted-foreground">
            Configure rules for automated cross-docking operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRules}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRule(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit Rule" : "Create Cross-Dock Rule"}</DialogTitle>
                <DialogDescription>
                  {editingRule ? "Update rule configuration" : "Define a new cross-docking rule"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rule Code</Label>
                    <Input
                      placeholder="e.g., XD-001"
                      value={formData.ruleCode}
                      onChange={(e) => setFormData({ ...formData, ruleCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    placeholder="e.g., Fast-moving SKU direct transfer"
                    value={formData.ruleName}
                    onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe when this rule should apply..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select
                    value={formData.triggerType}
                    onValueChange={(v) => setFormData({ ...formData, triggerType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INBOUND_RECEIPT">Inbound Receipt</SelectItem>
                      <SelectItem value="ORDER_CREATED">Order Created</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source Type</Label>
                    <Select
                      value={formData.sourceType}
                      onValueChange={(v) => setFormData({ ...formData, sourceType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RECEIVING_DOCK">Receiving Dock</SelectItem>
                        <SelectItem value="STAGING_AREA">Staging Area</SelectItem>
                        <SelectItem value="QUALITY_HOLD">Quality Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Destination Type</Label>
                    <Select
                      value={formData.destinationType}
                      onValueChange={(v) => setFormData({ ...formData, destinationType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SHIPPING_DOCK">Shipping Dock</SelectItem>
                        <SelectItem value="STAGING_AREA">Staging Area</SelectItem>
                        <SelectItem value="PACKING_STATION">Packing Station</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conditions (JSON)</Label>
                  <Textarea
                    placeholder='e.g., {"skuCategory": "fast-moving", "orderPriority": "HIGH"}'
                    value={formData.conditions}
                    onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingRule ? "Update" : "Create"}
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
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeRules}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExecutions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cross-Docking Rules</CardTitle>
          <CardDescription>Automated rules for direct transfer operations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cross-docking rules configured</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Flow</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-center">Executions</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.ruleName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{rule.ruleCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getTriggerBadge(rule.triggerType)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <span>{rule.sourceType.replace(/_/g, " ")}</span>
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground mx-1" />
                        <span>{rule.destinationType.replace(/_/g, " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {rule.executionCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rule.lastExecutedAt
                        ? new Date(rule.lastExecutedAt).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleRuleStatus(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
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
