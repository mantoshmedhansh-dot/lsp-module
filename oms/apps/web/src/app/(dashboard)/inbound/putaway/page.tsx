"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Package,
  ArrowRight,
  Clock,
  User,
  MapPin,
  Play,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface PutawayTask {
  id: string;
  taskNo: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  batchNo?: string;
  toBinId: string;
  toBinCode: string;
  actualBinId?: string;
  actualBinCode?: string;
  status: string;
  priority: number;
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  locationName?: string;
  createdAt: string;
}

interface TaskSummary {
  pending: number;
  assigned: number;
  inProgress: number;
  completedToday: number;
  total: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  PENDING: { label: "Pending", variant: "secondary", icon: Clock },
  ASSIGNED: { label: "Assigned", variant: "outline", icon: User },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Play },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

export default function PutawayTasksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PutawayTask | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    fetchTasks();
    fetchSummary();
    if (canManage) {
      fetchUsers();
    }
  }, [statusFilter]);

  async function fetchTasks() {
    try {
      setIsLoading(true);
      let url = "/api/v1/putaway/tasks?limit=100";
      if (statusFilter && statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load putaway tasks");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSummary() {
    try {
      const response = await fetch("/api/v1/putaway/tasks/summary");
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch("/api/v1/users?limit=100");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  async function handleStartTask(taskId: string) {
    try {
      const response = await fetch(`/api/v1/putaway/tasks/${taskId}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start task");
      }

      toast.success("Task started");
      fetchTasks();
      fetchSummary();
    } catch (error) {
      console.error("Error starting task:", error);
      toast.error("Failed to start task");
    }
  }

  async function handleAssignTask() {
    if (!selectedTask || !selectedUserId) return;

    try {
      setIsAssigning(true);
      const response = await fetch(`/api/v1/putaway/tasks/${selectedTask.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: selectedUserId }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign task");
      }

      toast.success("Task assigned successfully");
      setAssignDialogOpen(false);
      setSelectedTask(null);
      setSelectedUserId("");
      fetchTasks();
      fetchSummary();
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleCancelTask() {
    if (!selectedTask || !cancelReason) return;

    try {
      setIsCancelling(true);
      const response = await fetch(`/api/v1/putaway/tasks/${selectedTask.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel task");
      }

      toast.success("Task cancelled");
      setCancelDialogOpen(false);
      setSelectedTask(null);
      setCancelReason("");
      fetchTasks();
      fetchSummary();
    } catch (error) {
      console.error("Error cancelling task:", error);
      toast.error("Failed to cancel task");
    } finally {
      setIsCancelling(false);
    }
  }

  function openAssignDialog(task: PutawayTask) {
    setSelectedTask(task);
    setSelectedUserId(task.assignedToId || "");
    setAssignDialogOpen(true);
  }

  function openCancelDialog(task: PutawayTask) {
    setSelectedTask(task);
    setCancelReason("");
    setCancelDialogOpen(true);
  }

  function getStatusBadge(status: string) {
    const config = statusConfig[status] || { label: status, variant: "secondary" as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  function getPriorityBadge(priority: number) {
    if (priority <= 2) {
      return <Badge variant="destructive">High</Badge>;
    } else if (priority <= 5) {
      return <Badge variant="default">Medium</Badge>;
    } else {
      return <Badge variant="secondary">Low</Badge>;
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "my-tasks") {
      return task.assignedToId === session?.user?.id;
    }
    return true;
  });

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Putaway Tasks</h1>
          <p className="text-muted-foreground">
            Manage inventory putaway operations
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchTasks(); fetchSummary(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assigned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.assigned}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.completedToday}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task #</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Target Bin</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No putaway tasks found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => router.push(`/wms/putaway/${task.id}`)}
                            className="text-primary hover:underline"
                          >
                            {task.taskNo}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{task.skuCode}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {task.skuName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {task.quantity}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {task.toBinCode}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>
                          {task.assignedToName || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {task.status === "PENDING" && canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignDialog(task)}
                              >
                                <User className="h-3 w-3 mr-1" />
                                Assign
                              </Button>
                            )}
                            {["PENDING", "ASSIGNED"].includes(task.status) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleStartTask(task.id)}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {task.status === "IN_PROGRESS" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => router.push(`/wms/putaway/${task.id}`)}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Execute
                              </Button>
                            )}
                            {!["COMPLETED", "CANCELLED"].includes(task.status) && canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCancelDialog(task)}
                              >
                                <XCircle className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-tasks" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task #</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Target Bin</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No tasks assigned to you</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          <button
                            onClick={() => router.push(`/wms/putaway/${task.id}`)}
                            className="text-primary hover:underline"
                          >
                            {task.taskNo}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{task.skuCode}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {task.skuName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {task.quantity}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {task.toBinCode}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {["PENDING", "ASSIGNED"].includes(task.status) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleStartTask(task.id)}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {task.status === "IN_PROGRESS" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => router.push(`/wms/putaway/${task.id}`)}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Execute
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Putaway Task</DialogTitle>
            <DialogDescription>
              Assign task {selectedTask?.taskNo} to a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTask} disabled={!selectedUserId || isAssigning}>
              {isAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
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
              Are you sure you want to cancel task {selectedTask?.taskNo}?
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
