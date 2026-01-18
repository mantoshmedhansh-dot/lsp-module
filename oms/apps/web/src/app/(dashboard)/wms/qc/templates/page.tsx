"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Plus,
  Search,
  X,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  RefreshCw,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface QCParameter {
  id: string;
  name: string;
  type: string;
  isMandatory: boolean;
  acceptableValues: string | null;
}

interface QCTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    parameters: number;
    executions: number;
  };
  parameters: QCParameter[];
}

interface TemplatesResponse {
  templates: QCTemplate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const qcTypeConfig: Record<string, { label: string; color: string }> = {
  INBOUND: { label: "Inbound", color: "bg-blue-500" },
  RETURN: { label: "Return", color: "bg-orange-500" },
  PRODUCTION: { label: "Production", color: "bg-green-500" },
  CYCLE_COUNT: { label: "Cycle Count", color: "bg-purple-500" },
  RANDOM_AUDIT: { label: "Random Audit", color: "bg-yellow-500" },
};

const parameterTypes = [
  { value: "VISUAL", label: "Visual Inspection" },
  { value: "DIMENSIONAL", label: "Dimensional Check" },
  { value: "WEIGHT", label: "Weight Check" },
  { value: "BARCODE", label: "Barcode Scan" },
  { value: "FUNCTIONAL", label: "Functional Test" },
];

export default function QCTemplatesPage() {
  const router = useRouter();
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Create template form
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    type: "INBOUND",
    parameters: [{ name: "", type: "VISUAL", isMandatory: true }],
  });

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter) params.set("qc_type", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/qc/templates?${params}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load QC templates");
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTemplates();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchTemplates]);

  async function handleCreateTemplate() {
    if (!newTemplate.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      const response = await fetch("/api/v1/qc/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Template created successfully");
        setIsCreateDialogOpen(false);
        setNewTemplate({
          name: "",
          description: "",
          type: "INBOUND",
          parameters: [{ name: "", type: "VISUAL", isMandatory: true }],
        });
        fetchTemplates();
      } else {
        toast.error(result.error || "Failed to create template");
      }
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Failed to create template");
    }
  }

  async function handleToggleActive(templateId: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/v1/qc/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(`Template ${isActive ? "deactivated" : "activated"}`);
        fetchTemplates();
      } else {
        toast.error("Failed to update template");
      }
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Failed to update template");
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/v1/qc/templates/${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Template deleted successfully");
        fetchTemplates();
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  }

  function addParameter() {
    setNewTemplate((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { name: "", type: "VISUAL", isMandatory: true },
      ],
    }));
  }

  function removeParameter(index: number) {
    setNewTemplate((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  }

  function updateParameter(index: number, field: string, value: string | boolean) {
    setNewTemplate((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setPage(1);
  }

  const hasFilters = search || typeFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QC Templates</h1>
          <p className="text-muted-foreground">
            Manage quality check templates and parameters
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create QC Template</DialogTitle>
                <DialogDescription>
                  Define a quality check template with parameters
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Standard Inbound QC"
                    value={newTemplate.name}
                    onChange={(e) =>
                      setNewTemplate((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the QC process..."
                    value={newTemplate.description}
                    onChange={(e) =>
                      setNewTemplate((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qcType">QC Type</Label>
                  <Select
                    value={newTemplate.type}
                    onValueChange={(value) =>
                      setNewTemplate((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(qcTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Parameters</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addParameter}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Parameter
                    </Button>
                  </div>
                  {newTemplate.parameters.map((param, index) => (
                    <div
                      key={index}
                      className="grid gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Parameter {index + 1}
                        </span>
                        {newTemplate.parameters.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeParameter(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label>Name</Label>
                          <Input
                            placeholder="e.g., Visual Inspection"
                            value={param.name}
                            onChange={(e) =>
                              updateParameter(index, "name", e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={param.type}
                            onValueChange={(value) =>
                              updateParameter(index, "type", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {parameterTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Switch
                            checked={param.isMandatory}
                            onCheckedChange={(checked) =>
                              updateParameter(index, "isMandatory", checked)
                            }
                          />
                          <Label>Mandatory</Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate}>Create Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="QC Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(qcTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Template List</CardTitle>
          <CardDescription>
            {data?.total || 0} templates found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.templates?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters
                  ? "No templates match your filters"
                  : "No QC templates found"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a template to define quality check procedures
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parameters</TableHead>
                    <TableHead>Executions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.templates.map((template) => {
                    const typeInfo = qcTypeConfig[template.type] || {
                      label: template.type,
                      color: "bg-gray-500",
                    };

                    return (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{template.name}</p>
                            {template.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${typeInfo.color}`}
                            />
                            <span className="text-sm">{typeInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {template._count.parameters} params
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {template._count.executions} runs
                          </span>
                        </TableCell>
                        <TableCell>
                          {template.isActive ? (
                            <Badge variant="default">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(template.updatedAt), "dd MMM yyyy")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/wms/qc/templates/${template.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/wms/qc/templates/${template.id}`
                                  )
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  handleToggleActive(template.id, template.isActive)
                                }
                              >
                                {template.isActive ? (
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={page === data.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
