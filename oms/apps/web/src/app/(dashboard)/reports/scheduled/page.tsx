"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  FileText,
} from "lucide-react";

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  frequency: string;
  recipients: string[];
  lastRun: string | null;
  nextRun: string;
  isActive: boolean;
  format: string;
}

export default function ScheduledReportsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    reportType: "",
    frequency: "",
    recipients: "",
    format: "",
  });
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () => {
      const res = await fetch("/api/v1/reports/scheduled");
      if (!res.ok) throw new Error("Failed to fetch scheduled reports");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/reports/scheduled/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Report updated");
    },
    onError: () => {
      toast.error("Failed to update report");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await fetch("/api/v1/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          reportType: payload.reportType,
          frequency: payload.frequency,
          recipients: payload.recipients.split(",").map((e) => e.trim()).filter(Boolean),
          format: payload.format,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create scheduled report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Scheduled report created");
      setIsCreateOpen(false);
      setFormData({ name: "", reportType: "", frequency: "", recipients: "", format: "" });
    },
    onError: () => {
      toast.error("Failed to create scheduled report");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/reports/scheduled/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast.success("Report deleted");
    },
    onError: () => {
      toast.error("Failed to delete report");
    },
  });

  const reports: ScheduledReport[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Reports</h1>
          <p className="text-muted-foreground">
            Automated report generation and email delivery
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
                Create Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Scheduled Report</DialogTitle>
                <DialogDescription>
                  Set up an automated report to be generated and emailed on a schedule.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Report Name</Label>
                  <Input
                    placeholder="Daily Sales Report"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Report Type</Label>
                  <Select value={formData.reportType} onValueChange={(v) => setFormData({ ...formData, reportType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Report</SelectItem>
                      <SelectItem value="inventory">Inventory Report</SelectItem>
                      <SelectItem value="logistics">Logistics Report</SelectItem>
                      <SelectItem value="finance">Finance Report</SelectItem>
                      <SelectItem value="orders">Orders Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Recipients (comma-separated emails)</Label>
                  <Input
                    placeholder="user1@company.com, user2@company.com"
                    value={formData.recipients}
                    onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Format</Label>
                  <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!formData.name || !formData.reportType || !formData.frequency || !formData.format || createMutation.isPending}
                  onClick={() => createMutation.mutate(formData)}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter((r) => r.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent Today</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Reports</CardTitle>
          <CardDescription>Manage your automated report schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled reports yet</p>
              <p className="text-sm">Create your first scheduled report to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.reportType}</Badge>
                    </TableCell>
                    <TableCell>{report.frequency}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {report.recipients.join(", ")}
                    </TableCell>
                    <TableCell>
                      {report.lastRun ? formatDate(report.lastRun) : "Never"}
                    </TableCell>
                    <TableCell>{formatDate(report.nextRun)}</TableCell>
                    <TableCell>
                      <Badge variant={report.isActive ? "default" : "secondary"}>
                        {report.isActive ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: report.id,
                              isActive: !report.isActive,
                            })
                          }
                        >
                          {report.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(report.id)}
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
