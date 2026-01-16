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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  Save,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface QCResult {
  id: string;
  parameterId: string;
  parameterName: string;
  parameterType: string;
  isMandatory: boolean;
  expectedValue?: string;
  tolerance?: string;
  actualValue?: string;
  isPassed: boolean | null;
  notes?: string;
  imageUrl?: string;
}

interface QCDefect {
  id: string;
  type: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  imageUrl?: string;
}

interface QCExecution {
  id: string;
  executionNumber: string;
  template: {
    id: string;
    name: string;
    type: string;
  };
  sku?: {
    id: string;
    code: string;
    name: string;
  };
  order?: {
    id: string;
    orderNumber: string;
  };
  status: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "ON_HOLD";
  quantity: number;
  passedQuantity: number;
  failedQuantity: number;
  results: QCResult[];
  defects: QCDefect[];
  startedAt?: string;
  completedAt?: string;
  executedBy?: {
    id: string;
    name: string;
  };
  notes?: string;
  createdAt: string;
}

const DEFECT_TYPES = [
  "Damaged Package",
  "Wrong Item",
  "Missing Parts",
  "Quality Issue",
  "Expired Product",
  "Barcode Mismatch",
  "Weight Mismatch",
  "Dimensional Error",
  "Color Mismatch",
  "Other",
];

const SEVERITY_COLORS = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export default function QCExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const [execution, setExecution] = useState<QCExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<QCResult[]>([]);
  const [defects, setDefects] = useState<QCDefect[]>([]);
  const [notes, setNotes] = useState("");
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [defectForm, setDefectForm] = useState({
    type: "",
    description: "",
    severity: "MEDIUM" as QCDefect["severity"],
  });

  const fetchExecution = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/v1/qc/executions/${executionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("QC execution not found");
          router.push("/wms/qc/executions");
          return;
        }
        throw new Error("Failed to fetch execution");
      }
      const data = await response.json();
      setExecution(data);
      setResults(data.results || []);
      setDefects(data.defects || []);
      setNotes(data.notes || "");
    } catch (error) {
      console.error("Error fetching execution:", error);
      toast.error("Failed to load QC execution");
    } finally {
      setLoading(false);
    }
  }, [executionId, router]);

  useEffect(() => {
    fetchExecution();
  }, [fetchExecution]);

  const handleStartExecution = async () => {
    try {
      const response = await fetch(`/api/v1/v1/qc/executions/${executionId}/start`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to start execution");

      await fetchExecution();
      toast.success("QC execution started");
    } catch (error) {
      console.error("Error starting execution:", error);
      toast.error("Failed to start execution");
    }
  };

  const handleResultChange = (
    parameterId: string,
    field: "isPassed" | "actualValue" | "notes",
    value: boolean | string | null
  ) => {
    setResults((prev) =>
      prev.map((r) =>
        r.parameterId === parameterId ? { ...r, [field]: value } : r
      )
    );
  };

  const handleSaveResults = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/v1/v1/qc/executions/${executionId}/results`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, notes }),
      });

      if (!response.ok) throw new Error("Failed to save results");

      await fetchExecution();
      toast.success("Results saved successfully");
    } catch (error) {
      console.error("Error saving results:", error);
      toast.error("Failed to save results");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteExecution = async (passed: boolean) => {
    // Check if all mandatory checks are completed
    const mandatoryResults = results.filter((r) => r.isMandatory);
    const incompleteMandatory = mandatoryResults.filter((r) => r.isPassed === null);

    if (incompleteMandatory.length > 0) {
      toast.error(
        `Please complete all mandatory checks (${incompleteMandatory.length} remaining)`
      );
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        `/api/v1/qc/executions/${executionId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passed, results, defects, notes }),
        }
      );

      if (!response.ok) throw new Error("Failed to complete execution");

      await fetchExecution();
      toast.success(`QC ${passed ? "passed" : "failed"}`);
    } catch (error) {
      console.error("Error completing execution:", error);
      toast.error("Failed to complete execution");
    } finally {
      setSaving(false);
    }
  };

  const handlePutOnHold = async () => {
    try {
      const response = await fetch(`/api/v1/v1/qc/executions/${executionId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error("Failed to put on hold");

      await fetchExecution();
      toast.success("Execution put on hold");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to put on hold");
    }
  };

  const handleAddDefect = () => {
    if (!defectForm.type || !defectForm.description) {
      toast.error("Defect type and description are required");
      return;
    }

    const newDefect: QCDefect = {
      id: `temp-${Date.now()}`,
      ...defectForm,
    };

    setDefects([...defects, newDefect]);
    setDefectForm({ type: "", description: "", severity: "MEDIUM" });
    setShowDefectForm(false);
  };

  const handleRemoveDefect = (defectId: string) => {
    setDefects(defects.filter((d) => d.id !== defectId));
  };

  const getStatusBadge = (status: QCExecution["status"]) => {
    const configs: Record<
      QCExecution["status"],
      { color: string; icon: React.ReactNode }
    > = {
      PENDING: {
        color: "bg-gray-100 text-gray-800",
        icon: <AlertCircle className="h-3 w-3" />,
      },
      IN_PROGRESS: {
        color: "bg-blue-100 text-blue-800",
        icon: <Play className="h-3 w-3" />,
      },
      PASSED: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="h-3 w-3" />,
      },
      FAILED: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="h-3 w-3" />,
      },
      ON_HOLD: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Pause className="h-3 w-3" />,
      },
    };
    const config = configs[status];
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getProgress = () => {
    if (results.length === 0) return 0;
    const completed = results.filter((r) => r.isPassed !== null).length;
    return Math.round((completed / results.length) * 100);
  };

  const canEdit =
    execution?.status === "PENDING" || execution?.status === "IN_PROGRESS";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">QC Execution not found</p>
        <Button onClick={() => router.push("/wms/qc/executions")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Executions
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
              {execution.executionNumber}
            </h1>
            <p className="text-muted-foreground">
              {execution.template.name} - {execution.template.type}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {execution.status === "PENDING" && (
            <Button onClick={handleStartExecution}>
              <Play className="mr-2 h-4 w-4" />
              Start QC
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="outline" onClick={handleSaveResults} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                Save Progress
              </Button>
              <Button variant="outline" onClick={handlePutOnHold}>
                <Pause className="mr-2 h-4 w-4" />
                Put On Hold
              </Button>
            </>
          )}
          {execution.status === "IN_PROGRESS" && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleCompleteExecution(false)}
                disabled={saving}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Fail QC
              </Button>
              <Button onClick={() => handleCompleteExecution(true)} disabled={saving}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Pass QC
              </Button>
            </>
          )}
          {(execution.status === "PASSED" || execution.status === "FAILED") && (
            <Button variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>{getStatusBadge(execution.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quantity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{execution.quantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Passed / Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <span className="text-green-600">{execution.passedQuantity}</span>
              {" / "}
              <span className="text-red-600">{execution.failedQuantity}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{getProgress()}%</p>
              <Progress value={getProgress()} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {execution.sku && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">SKU Code</Label>
                  <p className="font-medium">{execution.sku.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SKU Name</Label>
                  <p>{execution.sku.name}</p>
                </div>
              </div>
            )}
            {execution.order && (
              <div>
                <Label className="text-muted-foreground">Order Number</Label>
                <p className="font-medium">{execution.order.orderNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-sm">
                {new Date(execution.createdAt).toLocaleString()}
              </p>
            </div>
            {execution.startedAt && (
              <div>
                <Label className="text-muted-foreground">Started</Label>
                <p className="text-sm">
                  {new Date(execution.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {execution.completedAt && (
              <div>
                <Label className="text-muted-foreground">Completed</Label>
                <p className="text-sm">
                  {new Date(execution.completedAt).toLocaleString()}
                </p>
              </div>
            )}
            {execution.executedBy && (
              <div>
                <Label className="text-muted-foreground">Executed By</Label>
                <p className="text-sm">{execution.executedBy.name}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QC Checklist</CardTitle>
          <CardDescription>
            Complete each check and record the results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">Pass</TableHead>
                <TableHead className="w-8">Fail</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual Value</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow
                  key={result.parameterId}
                  className={
                    result.isPassed === false ? "bg-red-50" : ""
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={result.isPassed === true}
                      disabled={!canEdit}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleResultChange(result.parameterId, "isPassed", true);
                        } else if (result.isPassed === true) {
                          handleResultChange(result.parameterId, "isPassed", null);
                        }
                      }}
                      className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={result.isPassed === false}
                      disabled={!canEdit}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleResultChange(result.parameterId, "isPassed", false);
                        } else if (result.isPassed === false) {
                          handleResultChange(result.parameterId, "isPassed", null);
                        }
                      }}
                      className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{result.parameterName}</p>
                      {result.isMandatory && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{result.parameterType}</Badge>
                  </TableCell>
                  <TableCell>
                    {result.expectedValue || "-"}
                    {result.tolerance && (
                      <span className="text-muted-foreground text-xs block">
                        {result.tolerance}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={result.actualValue || ""}
                      onChange={(e) =>
                        handleResultChange(
                          result.parameterId,
                          "actualValue",
                          e.target.value
                        )
                      }
                      placeholder="Enter value"
                      className="h-8"
                      disabled={!canEdit}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={result.notes || ""}
                      onChange={(e) =>
                        handleResultChange(
                          result.parameterId,
                          "notes",
                          e.target.value
                        )
                      }
                      placeholder="Notes"
                      className="h-8"
                      disabled={!canEdit}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={!canEdit}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Defects</CardTitle>
            <CardDescription>
              Record any defects found during inspection
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setShowDefectForm(!showDefectForm)}
            >
              {showDefectForm ? "Cancel" : "Add Defect"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showDefectForm && (
            <div className="mb-4 p-4 border rounded-lg space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Defect Type</Label>
                  <Select
                    value={defectForm.type}
                    onValueChange={(value) =>
                      setDefectForm({ ...defectForm, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={defectForm.severity}
                    onValueChange={(value) =>
                      setDefectForm({
                        ...defectForm,
                        severity: value as QCDefect["severity"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddDefect} className="w-full">
                    Add Defect
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={defectForm.description}
                  onChange={(e) =>
                    setDefectForm({ ...defectForm, description: e.target.value })
                  }
                  placeholder="Describe the defect in detail"
                  rows={2}
                />
              </div>
            </div>
          )}

          {defects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No defects recorded
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect) => (
                  <TableRow key={defect.id}>
                    <TableCell className="font-medium">{defect.type}</TableCell>
                    <TableCell>{defect.description}</TableCell>
                    <TableCell>
                      <Badge className={SEVERITY_COLORS[defect.severity]}>
                        {defect.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDefect(defect.id)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes about this QC execution"
            rows={4}
            disabled={!canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
