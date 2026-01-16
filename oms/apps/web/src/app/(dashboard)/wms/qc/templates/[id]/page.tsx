"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ClipboardCheck,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Save,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface QCParameter {
  id: string;
  name: string;
  type: "VISUAL" | "DIMENSIONAL" | "WEIGHT" | "BARCODE" | "FUNCTIONAL";
  description: string;
  isMandatory: boolean;
  expectedValue?: string;
  tolerance?: string;
  order: number;
}

interface QCTemplate {
  id: string;
  name: string;
  type?: "INBOUND" | "RETURN" | "PRODUCTION" | "CYCLE_COUNT" | "RANDOM_AUDIT";
  qcType: "INBOUND" | "RETURN" | "PRODUCTION" | "CYCLE_COUNT" | "RANDOM_AUDIT";
  description?: string;
  isActive: boolean;
  parameters: QCParameter[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    executions: number;
  };
}

const PARAMETER_TYPES = [
  { value: "VISUAL", label: "Visual Inspection" },
  { value: "DIMENSIONAL", label: "Dimensional Check" },
  { value: "WEIGHT", label: "Weight Verification" },
  { value: "BARCODE", label: "Barcode Scan" },
  { value: "FUNCTIONAL", label: "Functional Test" },
];

const QC_TYPES = [
  { value: "INBOUND", label: "Inbound QC" },
  { value: "RETURN", label: "Return QC" },
  { value: "PRODUCTION", label: "Production QC" },
  { value: "CYCLE_COUNT", label: "Cycle Count" },
  { value: "RANDOM_AUDIT", label: "Random Audit" },
];

export default function QCTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<QCTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddParameter, setShowAddParameter] = useState(false);
  const [editingParameter, setEditingParameter] = useState<QCParameter | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    qcType: "INBOUND" as QCTemplate["qcType"],
    description: "",
    isActive: true,
  });

  const [parameterForm, setParameterForm] = useState({
    name: "",
    type: "VISUAL" as QCParameter["type"],
    description: "",
    isMandatory: true,
    expectedValue: "",
    tolerance: "",
  });

  const fetchTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/v1/qc/templates/${templateId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Template not found");
          router.push("/wms/qc/templates");
          return;
        }
        throw new Error("Failed to fetch template");
      }
      const data = await response.json();
      setTemplate(data);
      setFormData({
        name: data.name,
        qcType: data.qcType || data.type,
        description: data.description || "",
        isActive: data.isActive,
      });
    } catch (error) {
      console.error("Error fetching template:", error);
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [templateId, router]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      setSaving(true);
      // Transform qcType back to type for the API
      const apiData = {
        name: formData.name,
        type: formData.qcType,
        description: formData.description,
        isActive: formData.isActive,
      };
      const response = await fetch(`/api/v1/v1/qc/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) throw new Error("Failed to update template");

      const updated = await response.json();
      setTemplate(updated);
      setIsEditing(false);
      toast.success("Template updated successfully");
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleAddParameter = async () => {
    if (!parameterForm.name.trim()) {
      toast.error("Parameter name is required");
      return;
    }

    try {
      const response = await fetch(`/api/v1/v1/qc/templates/${templateId}/parameters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parameterForm,
          order: (template?.parameters.length || 0) + 1,
        }),
      });

      if (!response.ok) throw new Error("Failed to add parameter");

      await fetchTemplate();
      setShowAddParameter(false);
      resetParameterForm();
      toast.success("Parameter added successfully");
    } catch (error) {
      console.error("Error adding parameter:", error);
      toast.error("Failed to add parameter");
    }
  };

  const handleUpdateParameter = async () => {
    if (!editingParameter || !parameterForm.name.trim()) {
      toast.error("Parameter name is required");
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/qc/templates/${templateId}/parameters/${editingParameter.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parameterForm),
        }
      );

      if (!response.ok) throw new Error("Failed to update parameter");

      await fetchTemplate();
      setEditingParameter(null);
      resetParameterForm();
      toast.success("Parameter updated successfully");
    } catch (error) {
      console.error("Error updating parameter:", error);
      toast.error("Failed to update parameter");
    }
  };

  const handleDeleteParameter = async (parameterId: string) => {
    if (!confirm("Are you sure you want to delete this parameter?")) return;

    try {
      const response = await fetch(
        `/api/v1/qc/templates/${templateId}/parameters/${parameterId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete parameter");

      await fetchTemplate();
      toast.success("Parameter deleted successfully");
    } catch (error) {
      console.error("Error deleting parameter:", error);
      toast.error("Failed to delete parameter");
    }
  };

  const handleDuplicateTemplate = async () => {
    try {
      const response = await fetch(`/api/v1/v1/qc/templates/${templateId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to duplicate template");

      const newTemplate = await response.json();
      toast.success("Template duplicated successfully");
      router.push(`/wms/qc/templates/${newTemplate.id}`);
    } catch (error) {
      console.error("Error duplicating template:", error);
      toast.error("Failed to duplicate template");
    }
  };

  const resetParameterForm = () => {
    setParameterForm({
      name: "",
      type: "VISUAL",
      description: "",
      isMandatory: true,
      expectedValue: "",
      tolerance: "",
    });
  };

  const openEditParameter = (param: QCParameter) => {
    setEditingParameter(param);
    setParameterForm({
      name: param.name,
      type: param.type,
      description: param.description,
      isMandatory: param.isMandatory,
      expectedValue: param.expectedValue || "",
      tolerance: param.tolerance || "",
    });
  };

  const getTypeBadgeColor = (type: QCTemplate["qcType"]) => {
    const colors: Record<QCTemplate["qcType"], string> = {
      INBOUND: "bg-blue-100 text-blue-800",
      RETURN: "bg-orange-100 text-orange-800",
      PRODUCTION: "bg-purple-100 text-purple-800",
      CYCLE_COUNT: "bg-green-100 text-green-800",
      RANDOM_AUDIT: "bg-yellow-100 text-yellow-800",
    };
    return colors[type];
  };

  const getParamTypeBadgeColor = (type: QCParameter["type"]) => {
    const colors: Record<QCParameter["type"], string> = {
      VISUAL: "bg-blue-100 text-blue-800",
      DIMENSIONAL: "bg-purple-100 text-purple-800",
      WEIGHT: "bg-green-100 text-green-800",
      BARCODE: "bg-orange-100 text-orange-800",
      FUNCTIONAL: "bg-pink-100 text-pink-800",
    };
    return colors[type];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Template not found</p>
        <Button onClick={() => router.push("/wms/qc/templates")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              {template.name}
            </h1>
            <p className="text-muted-foreground">
              QC Template - {template.parameters.length} parameters
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDuplicateTemplate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Template
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              Basic information about this QC template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter template name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>QC Type</Label>
                    <Select
                      value={formData.qcType}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          qcType: value as QCTemplate["qcType"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QC_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter template description"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label>Active</Label>
                </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Template Name</Label>
                  <p className="font-medium">{template.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">QC Type</Label>
                  <div className="mt-1">
                    <Badge className={getTypeBadgeColor(template.qcType)}>
                      {template.qcType.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{template.description || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Parameters</Label>
              <p className="text-2xl font-bold">{template.parameters.length}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Mandatory</Label>
              <p className="text-2xl font-bold">
                {template.parameters.filter((p) => p.isMandatory).length}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Executions</Label>
              <p className="text-2xl font-bold">
                {template._count?.executions || 0}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-sm">
                {new Date(template.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Last Updated</Label>
              <p className="text-sm">
                {new Date(template.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>QC Parameters</CardTitle>
            <CardDescription>
              Define the checks to be performed during quality control
            </CardDescription>
          </div>
          <Dialog open={showAddParameter} onOpenChange={setShowAddParameter}>
            <DialogTrigger asChild>
              <Button onClick={() => resetParameterForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Parameter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add QC Parameter</DialogTitle>
                <DialogDescription>
                  Define a new quality check parameter
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Parameter Name</Label>
                  <Input
                    value={parameterForm.name}
                    onChange={(e) =>
                      setParameterForm({ ...parameterForm, name: e.target.value })
                    }
                    placeholder="e.g., Package Condition"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={parameterForm.type}
                    onValueChange={(value) =>
                      setParameterForm({
                        ...parameterForm,
                        type: value as QCParameter["type"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARAMETER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={parameterForm.description}
                    onChange={(e) =>
                      setParameterForm({
                        ...parameterForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe what to check"
                    rows={2}
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Expected Value</Label>
                    <Input
                      value={parameterForm.expectedValue}
                      onChange={(e) =>
                        setParameterForm({
                          ...parameterForm,
                          expectedValue: e.target.value,
                        })
                      }
                      placeholder="e.g., 1.5kg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tolerance</Label>
                    <Input
                      value={parameterForm.tolerance}
                      onChange={(e) =>
                        setParameterForm({
                          ...parameterForm,
                          tolerance: e.target.value,
                        })
                      }
                      placeholder="e.g., +/- 5%"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={parameterForm.isMandatory}
                    onCheckedChange={(checked) =>
                      setParameterForm({ ...parameterForm, isMandatory: checked })
                    }
                  />
                  <Label>Mandatory Check</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddParameter(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddParameter}>Add Parameter</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Expected Value</TableHead>
                <TableHead>Tolerance</TableHead>
                <TableHead>Mandatory</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {template.parameters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No parameters defined. Add your first QC parameter.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                template.parameters
                  .sort((a, b) => a.order - b.order)
                  .map((param) => (
                    <TableRow key={param.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{param.name}</p>
                          {param.description && (
                            <p className="text-xs text-muted-foreground">
                              {param.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getParamTypeBadgeColor(param.type)}>
                          {param.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{param.expectedValue || "-"}</TableCell>
                      <TableCell>{param.tolerance || "-"}</TableCell>
                      <TableCell>
                        {param.isMandatory ? (
                          <Badge variant="destructive">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditParameter(param)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteParameter(param.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Parameter Dialog */}
      <Dialog
        open={!!editingParameter}
        onOpenChange={(open) => !open && setEditingParameter(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit QC Parameter</DialogTitle>
            <DialogDescription>
              Update the quality check parameter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Parameter Name</Label>
              <Input
                value={parameterForm.name}
                onChange={(e) =>
                  setParameterForm({ ...parameterForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={parameterForm.type}
                onValueChange={(value) =>
                  setParameterForm({
                    ...parameterForm,
                    type: value as QCParameter["type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARAMETER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={parameterForm.description}
                onChange={(e) =>
                  setParameterForm({
                    ...parameterForm,
                    description: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Expected Value</Label>
                <Input
                  value={parameterForm.expectedValue}
                  onChange={(e) =>
                    setParameterForm({
                      ...parameterForm,
                      expectedValue: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tolerance</Label>
                <Input
                  value={parameterForm.tolerance}
                  onChange={(e) =>
                    setParameterForm({
                      ...parameterForm,
                      tolerance: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={parameterForm.isMandatory}
                onCheckedChange={(checked) =>
                  setParameterForm({ ...parameterForm, isMandatory: checked })
                }
              />
              <Label>Mandatory Check</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingParameter(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateParameter}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
