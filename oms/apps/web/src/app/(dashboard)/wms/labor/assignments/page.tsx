"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  RefreshCw,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Assignment {
  id: string;
  userId: string;
  userName: string;
  shiftId: string;
  shiftName: string;
  zoneId: string | null;
  zoneName: string | null;
  taskType: string;
  status: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Worker {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface Shift {
  id: string;
  shiftCode: string;
  shiftName: string;
}

interface Zone {
  id: string;
  zoneCode: string;
  zoneName: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    userId: "",
    shiftId: "",
    zoneId: "",
    taskType: "PICKING",
  });

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/labor/assignments");
      if (response.ok) {
        const data = await response.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, []);

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/users?role=WAREHOUSE_WORKER");
      if (response.ok) {
        const data = await response.json();
        setWorkers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching workers:", error);
    }
  }, []);

  const fetchShifts = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/labor/shifts?status=ACTIVE");
      if (response.ok) {
        const data = await response.json();
        setShifts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching shifts:", error);
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/zones");
      if (response.ok) {
        const data = await response.json();
        setZones(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchAssignments(), fetchWorkers(), fetchShifts(), fetchZones()]);
    setIsLoading(false);
  }, [fetchAssignments, fetchWorkers, fetchShifts, fetchZones]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateAssignment = async () => {
    try {
      const response = await fetch("/api/v1/labor/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Assignment created");
        setIsDialogOpen(false);
        setFormData({ userId: "", shiftId: "", zoneId: "", taskType: "PICKING" });
        fetchAssignments();
      } else {
        toast.error("Failed to create assignment");
      }
    } catch (error) {
      toast.error("Error creating assignment");
    }
  };

  const updateAssignmentStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/v1/labor/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success(`Assignment ${status.toLowerCase()}`);
        fetchAssignments();
      }
    } catch (error) {
      toast.error("Failed to update assignment");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return <Badge className="bg-blue-100 text-blue-800">Assigned</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-green-100 text-green-800">In Progress</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary">Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const matchesSearch = a.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.shiftName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeAssignments = assignments.filter((a) => a.status === "IN_PROGRESS").length;
  const pendingAssignments = assignments.filter((a) => a.status === "ASSIGNED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Worker Assignments</h1>
          <p className="text-muted-foreground">
            Assign workers to shifts and zones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
                <DialogDescription>
                  Assign a worker to a shift and zone
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Worker</Label>
                  <Select
                    value={formData.userId}
                    onValueChange={(v) => setFormData({ ...formData, userId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select
                    value={formData.shiftId}
                    onValueChange={(v) => setFormData({ ...formData, shiftId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.shiftName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zone (Optional)</Label>
                  <Select
                    value={formData.zoneId}
                    onValueChange={(v) => setFormData({ ...formData, zoneId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>{z.zoneName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Task Type</Label>
                  <Select
                    value={formData.taskType}
                    onValueChange={(v) => setFormData({ ...formData, taskType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PICKING">Picking</SelectItem>
                      <SelectItem value="PACKING">Packing</SelectItem>
                      <SelectItem value="PUTAWAY">Putaway</SelectItem>
                      <SelectItem value="RECEIVING">Receiving</SelectItem>
                      <SelectItem value="CYCLE_COUNT">Cycle Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAssignment}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
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
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>Worker shift and zone assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No assignments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.userName}</TableCell>
                    <TableCell>{assignment.shiftName}</TableCell>
                    <TableCell>
                      {assignment.zoneName || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.taskType}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(assignment.assignedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {assignment.status === "ASSIGNED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAssignmentStatus(assignment.id, "IN_PROGRESS")}
                        >
                          Start
                        </Button>
                      )}
                      {assignment.status === "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAssignmentStatus(assignment.id, "COMPLETED")}
                        >
                          Complete
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
    </div>
  );
}
