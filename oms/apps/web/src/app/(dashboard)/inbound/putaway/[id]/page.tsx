"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  Package,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Play,
  Loader2,
  AlertCircle,
  Box,
  Barcode,
  Hash,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PutawayTask {
  id: string;
  taskNo: string;
  goodsReceiptId?: string;
  goodsReceiptItemId?: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  batchNo?: string;
  lotNo?: string;
  expiryDate?: string;
  fromBinId?: string;
  fromBinCode?: string;
  toBinId: string;
  toBinCode: string;
  actualBinId?: string;
  actualBinCode?: string;
  actualQty?: number;
  status: string;
  priority: number;
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  locationId: string;
  locationName?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

interface BinSuggestion {
  binId: string;
  binCode: string;
  zoneName?: string;
  zoneType?: string;
  score: number;
  reason: string;
  availableCapacity: number;
  hasSameSku: boolean;
  isEmpty: boolean;
}

interface Bin {
  id: string;
  code: string;
  zoneName?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-800" },
  ASSIGNED: { label: "Assigned", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function PutawayTaskDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [task, setTask] = useState<PutawayTask | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [binSuggestions, setBinSuggestions] = useState<BinSuggestion[]>([]);

  // Complete dialog
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [actualBinId, setActualBinId] = useState("");
  const [actualQty, setActualQty] = useState<number | null>(null);
  const [completeNotes, setCompleteNotes] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  async function fetchTask() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/putaway/tasks/${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setTask(data);

        // Set default values for complete form
        setActualBinId(data.toBinId);
        setActualQty(data.quantity);

        // Fetch bin suggestions if task is not completed
        if (!["COMPLETED", "CANCELLED"].includes(data.status)) {
          fetchBinSuggestions(data.skuId, data.quantity, data.locationId);
        }
      } else {
        toast.error("Task not found");
        router.push("/wms/putaway");
      }
    } catch (error) {
      console.error("Error fetching task:", error);
      toast.error("Failed to load task");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchBinSuggestions(skuId: string, quantity: number, locationId: string) {
    try {
      const response = await fetch("/api/v1/putaway/suggest-bin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId,
          quantity,
          locationId,
          preferSameSkuBins: true,
          preferEmptyBins: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBinSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Error fetching bin suggestions:", error);
    }
  }

  async function handleStartTask() {
    if (!task) return;

    try {
      const response = await fetch(`/api/v1/putaway/tasks/${task.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start task");
      }

      toast.success("Task started");
      fetchTask();
    } catch (error) {
      console.error("Error starting task:", error);
      toast.error("Failed to start task");
    }
  }

  async function handleCompleteTask() {
    if (!task) return;

    try {
      setIsCompleting(true);
      const response = await fetch(`/api/v1/putaway/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualBinId: actualBinId !== task.toBinId ? actualBinId : undefined,
          actualQty: actualQty !== task.quantity ? actualQty : undefined,
          notes: completeNotes || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete task");
      }

      toast.success("Task completed successfully");
      setCompleteDialogOpen(false);
      fetchTask();
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Failed to complete task");
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleCancelTask() {
    if (!task || !cancelReason) return;

    try {
      setIsCancelling(true);
      const response = await fetch(`/api/v1/putaway/tasks/${task.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel task");
      }

      toast.success("Task cancelled");
      setCancelDialogOpen(false);
      fetchTask();
    } catch (error) {
      console.error("Error cancelling task:", error);
      toast.error("Failed to cancel task");
    } finally {
      setIsCancelling(false);
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/wms/putaway")}>
          Back to Tasks
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[task.status] || { label: task.status, color: "bg-gray-100" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/wms/putaway")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{task.taskNo}</h1>
              <span className={`px-2 py-1 rounded text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-muted-foreground">
              Putaway Task Details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {["PENDING", "ASSIGNED"].includes(task.status) && (
            <Button onClick={handleStartTask}>
              <Play className="h-4 w-4 mr-2" />
              Start Task
            </Button>
          )}
          {task.status === "IN_PROGRESS" && (
            <Button onClick={() => setCompleteDialogOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Task
            </Button>
          )}
          {!["COMPLETED", "CANCELLED"].includes(task.status) && canManage && (
            <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SKU Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              SKU Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU Code</span>
                <span className="font-medium">{task.skuCode}</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-muted-foreground">SKU Name</span>
                <span className="font-medium text-right max-w-[60%]">{task.skuName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quantity</span>
                <span className="text-xl font-bold">{task.quantity}</span>
              </div>
              {task.batchNo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Batch No</span>
                  <span className="font-medium">{task.batchNo}</span>
                </div>
              )}
              {task.lotNo && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Lot No</span>
                  <span className="font-medium">{task.lotNo}</span>
                </div>
              )}
              {task.expiryDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expiry Date</span>
                  <span className="font-medium">
                    {new Date(task.expiryDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">{task.locationName || "-"}</span>
              </div>
              <Separator />
              {task.fromBinCode && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">From Bin</span>
                  <Badge variant="outline">{task.fromBinCode}</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Bin</span>
                <Badge variant="default" className="text-base">{task.toBinCode}</Badge>
              </div>
              {task.actualBinCode && task.actualBinCode !== task.toBinCode && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Actual Bin</span>
                  <Badge variant="secondary">{task.actualBinCode}</Badge>
                </div>
              )}
              {task.actualQty && task.actualQty !== task.quantity && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Actual Qty</span>
                  <span className="font-medium">{task.actualQty}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Task Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority</span>
                <Badge
                  variant={task.priority <= 2 ? "destructive" : task.priority <= 5 ? "default" : "secondary"}
                >
                  {task.priority <= 2 ? "High" : task.priority <= 5 ? "Medium" : "Low"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium">{task.assignedToName || "Unassigned"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-sm">{formatDate(task.createdAt)}</span>
              </div>
              {task.assignedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assigned</span>
                  <span className="text-sm">{formatDate(task.assignedAt)}</span>
                </div>
              )}
              {task.startedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span className="text-sm">{formatDate(task.startedAt)}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="text-sm">{formatDate(task.completedAt)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bin Suggestions (if applicable) */}
        {!["COMPLETED", "CANCELLED"].includes(task.status) && binSuggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" />
                Suggested Bins
              </CardTitle>
              <CardDescription>
                Alternative bins ranked by suitability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {binSuggestions.slice(0, 5).map((suggestion, index) => (
                  <div
                    key={suggestion.binId}
                    className={`p-3 rounded-lg border ${
                      suggestion.binId === task.toBinId
                        ? "border-primary bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{suggestion.binCode}</span>
                        {suggestion.binId === task.toBinId && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                        {suggestion.hasSameSku && (
                          <Badge variant="secondary" className="text-xs">Same SKU</Badge>
                        )}
                        {suggestion.isEmpty && (
                          <Badge variant="outline" className="text-xs">Empty</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Score: {suggestion.score.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.zoneName} - {suggestion.reason}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancellation Info (if cancelled) */}
        {task.status === "CANCELLED" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Cancellation Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cancelled At</span>
                  <span className="text-sm">{formatDate(task.cancelledAt)}</span>
                </div>
                {task.cancellationReason && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Reason</span>
                    <p className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                      {task.cancellationReason}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {task.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{task.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Putaway Task</DialogTitle>
            <DialogDescription>
              Confirm the putaway details to complete this task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-medium">{task.skuCode}</span>
                <span className="text-muted-foreground">Planned Qty:</span>
                <span className="font-medium">{task.quantity}</span>
                <span className="text-muted-foreground">Target Bin:</span>
                <span className="font-medium">{task.toBinCode}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Actual Quantity</Label>
              <Input
                type="number"
                value={actualQty ?? task.quantity}
                onChange={(e) => setActualQty(parseInt(e.target.value) || 0)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Leave as-is if quantity matches the planned amount
              </p>
            </div>

            <div className="space-y-2">
              <Label>Actual Bin (if different)</Label>
              <Select value={actualBinId} onValueChange={setActualBinId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={task.toBinId}>
                    {task.toBinCode} (Target)
                  </SelectItem>
                  {binSuggestions
                    .filter((s) => s.binId !== task.toBinId)
                    .map((suggestion) => (
                      <SelectItem key={suggestion.binId} value={suggestion.binId}>
                        {suggestion.binCode} - {suggestion.reason}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Any notes about this putaway..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteTask} disabled={isCompleting}>
              {isCompleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Complete Putaway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Putaway Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this task?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                This action cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cancellation Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Task
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTask}
              disabled={!cancelReason.trim() || isCancelling}
            >
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
