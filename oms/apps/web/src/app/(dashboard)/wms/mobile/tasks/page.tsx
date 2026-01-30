"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Search,
  Filter,
  Play,
  Pause,
  XCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface MobileTask {
  id: string;
  taskNo: string;
  taskType: string;
  priority: string;
  status: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  totalLines: number;
  completedLines: number;
  totalQuantity: number;
  completedQuantity: number;
  sourceLocation: string | null;
  destinationLocation: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function MobileTasksPage() {
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("taskType", typeFilter);

      const response = await fetch(`/api/v1/mobile/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/v1/mobile/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success(`Task ${status.toLowerCase().replace("_", " ")}`);
        fetchTasks();
      }
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "ASSIGNED":
        return <Badge className="bg-blue-100 text-blue-800">Assigned</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-green-100 text-green-800"><Play className="mr-1 h-3 w-3" />In Progress</Badge>;
      case "PAUSED":
        return <Badge className="bg-yellow-100 text-yellow-800"><Pause className="mr-1 h-3 w-3" />Paused</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-blue-100 text-blue-800">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const filteredTasks = tasks.filter((t) =>
    t.taskNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.assignedUserName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingTasks = tasks.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mobile Tasks</h1>
          <p className="text-muted-foreground">
            Manage and monitor mobile warehouse tasks
          </p>
        </div>
        <Button variant="outline" onClick={fetchTasks}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="PICKING">Picking</SelectItem>
            <SelectItem value="PUTAWAY">Putaway</SelectItem>
            <SelectItem value="RECEIVING">Receiving</SelectItem>
            <SelectItem value="CYCLE_COUNT">Cycle Count</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>All mobile warehouse tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tasks found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium font-mono">{task.taskNo}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{task.taskType}</Badge>
                    </TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>
                      {task.assignedUserName ? (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {task.assignedUserName}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-32">
                        <Progress
                          value={task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {task.completedLines}/{task.totalLines}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.sourceLocation && task.destinationLocation ? (
                        <span className="text-sm">
                          {task.sourceLocation} → {task.destinationLocation}
                        </span>
                      ) : task.sourceLocation ? (
                        <span className="text-sm">{task.sourceLocation}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {task.status === "IN_PROGRESS" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateTaskStatus(task.id, "PAUSED")}
                              title="Pause"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateTaskStatus(task.id, "COMPLETED")}
                              title="Complete"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          </>
                        )}
                        {task.status === "PAUSED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {(task.status === "PENDING" || task.status === "ASSIGNED") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateTaskStatus(task.id, "CANCELLED")}
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
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
