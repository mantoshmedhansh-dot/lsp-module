"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
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
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Eye,
  PlayCircle,
  CheckCircle,
  XCircle,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  VARIANCE_FOUND: "bg-orange-100 text-orange-800",
  VERIFIED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface CycleCount {
  id: string;
  cycleCountNo: string;
  status: string;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  varianceFound: boolean;
  varianceValue?: number;
  remarks?: string;
  _count: { items: number };
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Zone {
  id: string;
  name: string;
  code: string;
}

export default function CycleCountPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    locationId: "",
    zoneId: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  // Fetch cycle counts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cycle-counts", status, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (status) params.append("status", status);

      const res = await fetch(`/api/v1/cycle-counts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch cycle counts");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Fetch zones
  const { data: zonesData } = useQuery({
    queryKey: ["zones", formData.locationId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (formData.locationId) params.append("locationId", formData.locationId);
      const res = await fetch(`/api/v1/zones?${params}`);
      if (!res.ok) throw new Error("Failed to fetch zones");
      return res.json();
    },
    enabled: !!formData.locationId,
  });

  // Create cycle count mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/v1/cycle-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create cycle count");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cycle count created",
        description: `Cycle count ${data.cycleCountNo} created with ${data._count?.items || 0} items`,
      });
      setIsCreateOpen(false);
      setFormData({
        locationId: "",
        zoneId: "",
        scheduledDate: new Date().toISOString().split("T")[0],
        remarks: "",
      });
      queryClient.invalidateQueries({ queryKey: ["cycle-counts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cycleCounts: CycleCount[] = data?.data || [];
  const locations: Location[] = locationsData?.data || [];
  const zones: Zone[] = zonesData?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Count</h1>
          <p className="text-muted-foreground">
            Physical inventory verification and reconciliation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Cycle Count
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Cycle Count</DialogTitle>
                <DialogDescription>
                  Schedule a new inventory cycle count
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="locationId">Location *</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, locationId: v, zoneId: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zoneId">Zone (Optional)</Label>
                  <Select
                    value={formData.zoneId || "all"}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, zoneId: v === "all" ? "" : v }))
                    }
                    disabled={!formData.locationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All zones</SelectItem>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name} ({zone.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduledDate">Scheduled Date *</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, scheduledDate: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, remarks: e.target.value }))
                    }
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={
                    !formData.locationId ||
                    !formData.scheduledDate ||
                    createMutation.isPending
                  }
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PLANNED">Planned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="VARIANCE_FOUND">Variance Found</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Counts</CardTitle>
          <CardDescription>
            {data?.total || 0} total cycle counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : cycleCounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4" />
              <p>No cycle counts found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle Count No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycleCounts.map((cc) => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-medium">
                        {cc.cycleCountNo}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[cc.status] || ""}>
                          {cc.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{cc._count.items}</TableCell>
                      <TableCell>{formatDate(cc.scheduledDate)}</TableCell>
                      <TableCell>
                        {cc.startedAt ? formatDate(cc.startedAt) : "-"}
                      </TableCell>
                      <TableCell>
                        {cc.completedAt ? formatDate(cc.completedAt) : "-"}
                      </TableCell>
                      <TableCell>
                        {cc.varianceFound ? (
                          <span className="text-orange-600 font-medium">
                            {cc.varianceValue?.toFixed(0) || "Yes"}
                          </span>
                        ) : (
                          <span className="text-green-600">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/inventory/cycle-count/${cc.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {cc.status === "PLANNED" && (
                            <Button variant="ghost" size="icon">
                              <PlayCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {cc.status === "IN_PROGRESS" && (
                            <Button variant="ghost" size="icon">
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
