"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  ArrowLeft,
  Package,
  Truck,
  AlertTriangle,
  RotateCcw,
  Database,
  Zap,
  Clock,
  CheckCircle,
  X,
  ChevronRight,
  Settings2,
  Play,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Types
interface RuleType {
  value: string;
  label: string;
  description: string;
}

interface EntityType {
  value: string;
  label: string;
  fields: string[];
}

interface Operator {
  value: string;
  label: string;
}

interface AIActionType {
  value: string;
  label: string;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | string[];
  logicalOperator?: string;
}

interface DetectionRule {
  id: string;
  name: string;
  description: string | null;
  ruleCode: string;
  ruleType: string;
  entityType: string;
  conditions: RuleCondition[];
  severityRules: Record<string, number>;
  severityField: string;
  severityUnit: string;
  defaultSeverity: string;
  defaultPriority: number;
  aiActionEnabled: boolean;
  aiActionType: string | null;
  aiActionConfig: any;
  autoResolveEnabled: boolean;
  autoResolveConditions: any;
  isActive: boolean;
  isGlobal: boolean;
  companyId: string | null;
  lastExecutedAt: string | null;
  executionCount: number;
  exceptionsCreated: number;
  createdAt: string;
  updatedAt: string;
}

interface TypesConfig {
  ruleTypes: RuleType[];
  entityTypes: EntityType[];
  operators: Operator[];
  severities: string[];
  aiActionTypes: AIActionType[];
}

// Entity type icons
const entityIcons: Record<string, React.ElementType> = {
  Order: Package,
  Delivery: Truck,
  NDR: AlertTriangle,
  Return: RotateCcw,
  Inventory: Database,
};

// Entity to rule type mapping
const entityRuleTypeMap: Record<string, string[]> = {
  Order: ["STUCK_ORDER", "PAYMENT_ISSUE", "CUSTOM"],
  Delivery: ["SLA_BREACH", "CARRIER_DELAY", "CUSTOM"],
  NDR: ["NDR_ESCALATION", "CUSTOM"],
  Return: ["CUSTOM"],
  Inventory: ["INVENTORY_ISSUE", "CUSTOM"],
};

// Field labels
const fieldLabels: Record<string, string> = {
  status: "Status",
  createdAt: "Created At",
  totalAmount: "Total Amount",
  paymentMode: "Payment Mode",
  expectedDeliveryDate: "Expected Delivery Date",
  dispatchedAt: "Dispatched At",
  reason: "Reason",
  attemptNumber: "Attempt Number",
  quantity: "Quantity",
  reservedQty: "Reserved Quantity",
  reorderLevel: "Reorder Level",
};

// Status options by entity type
const statusOptions: Record<string, string[]> = {
  Order: ["CREATED", "CONFIRMED", "PROCESSING", "ALLOCATED", "PICKED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"],
  Delivery: ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RTO"],
  NDR: ["OPEN", "CONTACTED", "RESOLVED", "RTO", "CLOSED"],
  Return: ["REQUESTED", "APPROVED", "PICKED_UP", "RECEIVED", "PROCESSED", "REFUNDED", "REJECTED"],
  Inventory: [],
};

export default function RulesConfigurationPage() {
  const router = useRouter();

  // State
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [typesConfig, setTypesConfig] = useState<TypesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Dialog states
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<DetectionRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // Form state
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    entityType: "",
    ruleType: "",
    conditions: [{ field: "", operator: "=", value: "", logicalOperator: "AND" }] as RuleCondition[],
    severityField: "createdAt",
    severityUnit: "hours",
    severityRules: { CRITICAL: 24, HIGH: 12, MEDIUM: 4, LOW: 2 },
    defaultSeverity: "MEDIUM",
    defaultPriority: 3,
    aiActionEnabled: false,
    aiActionType: "",
    autoResolveEnabled: false,
    autoResolveConditions: { field: "status", operator: "!=", value: "" },
    isActive: true,
    isGlobal: true,
  });

  // Scheduler status
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);

  // Fetch types config
  const fetchTypesConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/detection-rules/types/list");
      if (response.ok) {
        const data = await response.json();
        setTypesConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch types config:", error);
    }
  }, []);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterEntity !== "all") params.set("entityType", filterEntity);
      if (filterStatus !== "all") params.set("isActive", filterStatus === "active" ? "true" : "false");

      const response = await fetch(`/api/v1/detection-rules?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterEntity, filterStatus]);

  // Fetch scheduler status
  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/control-tower/dashboard");
      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus(data.scheduler);
      }
    } catch (error) {
      console.error("Failed to fetch scheduler status:", error);
    }
  }, []);

  useEffect(() => {
    fetchTypesConfig();
    fetchRules();
    fetchSchedulerStatus();
  }, [fetchTypesConfig, fetchRules, fetchSchedulerStatus]);

  // Reset form
  const resetForm = () => {
    setFormStep(1);
    setFormData({
      name: "",
      description: "",
      entityType: "",
      ruleType: "",
      conditions: [{ field: "", operator: "=", value: "", logicalOperator: "AND" }],
      severityField: "createdAt",
      severityUnit: "hours",
      severityRules: { CRITICAL: 24, HIGH: 12, MEDIUM: 4, LOW: 2 },
      defaultSeverity: "MEDIUM",
      defaultPriority: 3,
      aiActionEnabled: false,
      aiActionType: "",
      autoResolveEnabled: false,
      autoResolveConditions: { field: "status", operator: "!=", value: "" },
      isActive: true,
      isGlobal: true,
    });
    setEditingRule(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setShowRuleDialog(true);
  };

  // Open edit dialog
  const openEditDialog = (rule: DetectionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      entityType: rule.entityType,
      ruleType: rule.ruleType,
      conditions: rule.conditions.length > 0 ? rule.conditions : [{ field: "", operator: "=", value: "", logicalOperator: "AND" }],
      severityField: rule.severityField,
      severityUnit: rule.severityUnit,
      severityRules: rule.severityRules,
      defaultSeverity: rule.defaultSeverity,
      defaultPriority: rule.defaultPriority,
      aiActionEnabled: rule.aiActionEnabled,
      aiActionType: rule.aiActionType || "",
      autoResolveEnabled: rule.autoResolveEnabled,
      autoResolveConditions: rule.autoResolveConditions || { field: "status", operator: "!=", value: "" },
      isActive: rule.isActive,
      isGlobal: rule.isGlobal,
    });
    setFormStep(1);
    setShowRuleDialog(true);
  };

  // Save rule
  const saveRule = async () => {
    try {
      setIsSubmitting(true);

      const payload = {
        name: formData.name,
        description: formData.description || null,
        entityType: formData.entityType,
        ruleType: formData.ruleType,
        conditions: formData.conditions.filter(c => c.field && c.operator),
        severityField: formData.severityField,
        severityUnit: formData.severityUnit,
        severityRules: formData.severityRules,
        defaultSeverity: formData.defaultSeverity,
        defaultPriority: formData.defaultPriority,
        aiActionEnabled: formData.aiActionEnabled,
        aiActionType: formData.aiActionEnabled ? formData.aiActionType : null,
        aiActionConfig: null,
        autoResolveEnabled: formData.autoResolveEnabled,
        autoResolveConditions: formData.autoResolveEnabled ? formData.autoResolveConditions : null,
        isActive: formData.isActive,
        isGlobal: formData.isGlobal,
      };

      const url = editingRule
        ? `/api/v1/detection-rules/${editingRule.id}`
        : "/api/v1/detection-rules";

      const method = editingRule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save rule");
      }

      toast.success(editingRule ? "Rule updated successfully" : "Rule created successfully");
      setShowRuleDialog(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || "Failed to save rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle rule
  const toggleRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/v1/detection-rules/${ruleId}/toggle`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Rule status updated");
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to toggle rule");
    }
  };

  // Delete rule
  const deleteRule = async () => {
    if (!deleteRuleId) return;

    try {
      const response = await fetch(`/api/v1/detection-rules/${deleteRuleId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Rule deleted successfully");
        setDeleteRuleId(null);
        fetchRules();
      }
    } catch (error) {
      toast.error("Failed to delete rule");
    }
  };

  // Run detection manually
  const runDetection = async () => {
    try {
      toast.info("Running detection engine...");
      const response = await fetch("/api/v1/control-tower/detect-exceptions", {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Detection complete: ${result.summary.exceptions_created} created, ${result.summary.exceptions_auto_resolved} resolved`);
        fetchRules();
        fetchSchedulerStatus();
      }
    } catch (error) {
      toast.error("Failed to run detection");
    }
  };

  // Add condition
  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "=", value: "", logicalOperator: "AND" }],
    }));
  };

  // Remove condition
  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  // Update condition
  const updateCondition = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === index ? { ...c, [field]: value } : c),
    }));
  };

  // Get available fields for selected entity
  const getAvailableFields = () => {
    if (!typesConfig || !formData.entityType) return [];
    const entity = typesConfig.entityTypes.find(e => e.value === formData.entityType);
    return entity?.fields || [];
  };

  // Get available rule types for selected entity
  const getAvailableRuleTypes = () => {
    if (!typesConfig || !formData.entityType) return [];
    const allowedTypes = entityRuleTypeMap[formData.entityType] || ["CUSTOM"];
    return typesConfig.ruleTypes.filter(rt => allowedTypes.includes(rt.value));
  };

  // Filter rules
  const filteredRules = rules;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/control-tower")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detection Rules</h1>
            <p className="text-muted-foreground">
              Configure rules for the automated exception detection engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runDetection}>
            <Play className="mr-2 h-4 w-4" />
            Run Now
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Scheduler Status */}
      <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-indigo-700">Detection Engine Active</span>
              </div>
              <span className="text-indigo-600 text-sm">Auto-runs every 15 minutes</span>
            </div>
            {schedulerStatus?.lastScan && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-indigo-500">
                  Last scan: {new Date(schedulerStatus.lastScan).toLocaleTimeString()}
                </span>
                <Badge variant="outline" className="bg-white">
                  {schedulerStatus.lastResult?.rulesExecuted || 0} rules executed
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Active Rules
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Execution History
          </TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Entity:</Label>
                  <Select value={filterEntity} onValueChange={setFilterEntity}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      {typesConfig?.entityTypes.map(et => (
                        <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Status:</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" onClick={fetchRules}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rules Table */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Rules</CardTitle>
              <CardDescription>
                {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""} configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No rules configured</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create your first detection rule to start monitoring
                  </p>
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Rule
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Executions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => {
                      const EntityIcon = entityIcons[rule.entityType] || Package;
                      return (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              <p className="text-xs text-muted-foreground">{rule.ruleCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <EntityIcon className="h-3 w-3" />
                              {rule.entityType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {rule.ruleType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? "default" : "secondary"} className={rule.isActive ? "bg-green-100 text-green-700" : ""}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{rule.executionCount}</span>
                              <span className="text-muted-foreground"> runs</span>
                              {rule.exceptionsCreated > 0 && (
                                <span className="text-orange-600 ml-2">
                                  ({rule.exceptionsCreated} exceptions)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRule(rule.id)}
                                title={rule.isActive ? "Disable" : "Enable"}
                              >
                                {rule.isActive ? (
                                  <PowerOff className="h-4 w-4 text-orange-500" />
                                ) : (
                                  <Power className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(rule)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteRuleId(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                Track how each rule has performed over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Last Executed</TableHead>
                    <TableHead>Total Runs</TableHead>
                    <TableHead>Exceptions Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.ruleCode}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.lastExecutedAt ? (
                          <div className="text-sm">
                            <p>{format(new Date(rule.lastExecutedAt), "dd MMM yyyy")}</p>
                            <p className="text-muted-foreground">{format(new Date(rule.lastExecutedAt), "HH:mm:ss")}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{rule.executionCount}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.exceptionsCreated > 0 ? "destructive" : "secondary"}>
                          {rule.exceptionsCreated}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Paused"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Builder Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
            <DialogDescription>
              Configure the detection rule step by step
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    formStep >= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <ChevronRight className={`h-4 w-4 mx-1 ${formStep > step ? "text-primary" : "text-muted-foreground"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info & Entity */}
          {formStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Stuck Order Detection"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of what this rule detects"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Entity Type *</Label>
                <div className="grid grid-cols-5 gap-2">
                  {typesConfig?.entityTypes.map((et) => {
                    const Icon = entityIcons[et.value] || Package;
                    return (
                      <Button
                        key={et.value}
                        type="button"
                        variant={formData.entityType === et.value ? "default" : "outline"}
                        className="flex flex-col items-center gap-2 h-auto py-4"
                        onClick={() => setFormData(prev => ({ ...prev, entityType: et.value, ruleType: "" }))}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs">{et.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {formData.entityType && (
                <div className="space-y-2">
                  <Label>Rule Type *</Label>
                  <Select
                    value={formData.ruleType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, ruleType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rule type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableRuleTypes().map((rt) => (
                        <SelectItem key={rt.value} value={rt.value}>
                          <div>
                            <p>{rt.label}</p>
                            <p className="text-xs text-muted-foreground">{rt.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Conditions */}
          {formStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Detection Conditions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Condition
                </Button>
              </div>

              <div className="space-y-3">
                {formData.conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    {index > 0 && (
                      <Select
                        value={condition.logicalOperator}
                        onValueChange={(value) => updateCondition(index, "logicalOperator", value)}
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {index === 0 && <span className="w-[80px] text-sm text-muted-foreground px-3">IF</span>}

                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, "field", value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableFields().map((field) => (
                          <SelectItem key={field} value={field}>
                            {fieldLabels[field] || field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, "operator", value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {typesConfig?.operators.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {condition.field === "status" ? (
                      <Select
                        value={String(condition.value)}
                        onValueChange={(value) => updateCondition(index, "value", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Value" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions[formData.entityType]?.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={String(condition.value)}
                        onChange={(e) => updateCondition(index, "value", e.target.value)}
                        placeholder="Value"
                        className="flex-1"
                      />
                    )}

                    {formData.conditions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Severity */}
          {formStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Severity Based On</Label>
                  <Select
                    value={formData.severityField}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, severityField: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableFields().map((field) => (
                        <SelectItem key={field} value={field}>
                          {fieldLabels[field] || field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.severityUnit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, severityUnit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Severity Thresholds (when {formData.severityField} reaches threshold)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-red-50">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="font-medium text-red-700">CRITICAL</span>
                    <span className="text-muted-foreground">&gt;=</span>
                    <Input
                      type="number"
                      value={formData.severityRules.CRITICAL}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        severityRules: { ...prev.severityRules, CRITICAL: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{formData.severityUnit}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-orange-50">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="font-medium text-orange-700">HIGH</span>
                    <span className="text-muted-foreground">&gt;=</span>
                    <Input
                      type="number"
                      value={formData.severityRules.HIGH}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        severityRules: { ...prev.severityRules, HIGH: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{formData.severityUnit}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-yellow-50">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="font-medium text-yellow-700">MEDIUM</span>
                    <span className="text-muted-foreground">&gt;=</span>
                    <Input
                      type="number"
                      value={formData.severityRules.MEDIUM}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        severityRules: { ...prev.severityRules, MEDIUM: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{formData.severityUnit}</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="font-medium text-green-700">LOW</span>
                    <span className="text-muted-foreground">&gt;=</span>
                    <Input
                      type="number"
                      value={formData.severityRules.LOW}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        severityRules: { ...prev.severityRules, LOW: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{formData.severityUnit}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: AI Actions & Auto-Resolve */}
          {formStep === 4 && (
            <div className="space-y-6">
              {/* AI Action */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">AI Action</Label>
                    <p className="text-sm text-muted-foreground">Trigger an AI action when this rule matches</p>
                  </div>
                  <Switch
                    checked={formData.aiActionEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, aiActionEnabled: checked }))}
                  />
                </div>
                {formData.aiActionEnabled && (
                  <Select
                    value={formData.aiActionType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, aiActionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI action type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typesConfig?.aiActionTypes.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {at.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Auto-Resolve */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Auto-Resolve</Label>
                    <p className="text-sm text-muted-foreground">Automatically resolve exception when condition is met</p>
                  </div>
                  <Switch
                    checked={formData.autoResolveEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoResolveEnabled: checked }))}
                  />
                </div>
                {formData.autoResolveEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">When</span>
                    <Select
                      value={formData.autoResolveConditions.field}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        autoResolveConditions: { ...prev.autoResolveConditions, field: value }
                      }))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableFields().map((field) => (
                          <SelectItem key={field} value={field}>
                            {fieldLabels[field] || field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.autoResolveConditions.operator}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        autoResolveConditions: { ...prev.autoResolveConditions, operator: value }
                      }))}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="=">Equals</SelectItem>
                        <SelectItem value="!=">Not Equals</SelectItem>
                        <SelectItem value="IN">In List</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.autoResolveConditions.field === "status" ? (
                      <Select
                        value={formData.autoResolveConditions.value}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          autoResolveConditions: { ...prev.autoResolveConditions, value }
                        }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Value" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions[formData.entityType]?.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={formData.autoResolveConditions.value}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          autoResolveConditions: { ...prev.autoResolveConditions, value: e.target.value }
                        }))}
                        placeholder="Value"
                        className="flex-1"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Rule Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Activate Rule</Label>
                  <p className="text-sm text-muted-foreground">Enable this rule immediately after saving</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {formStep > 1 && (
                <Button type="button" variant="outline" onClick={() => setFormStep(prev => prev - 1)}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowRuleDialog(false)}>
                Cancel
              </Button>
              {formStep < 4 ? (
                <Button
                  type="button"
                  onClick={() => setFormStep(prev => prev + 1)}
                  disabled={
                    (formStep === 1 && (!formData.name || !formData.entityType || !formData.ruleType))
                  }
                >
                  Next
                </Button>
              ) : (
                <Button onClick={saveRule} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the detection rule and remove it from the engine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRule} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
