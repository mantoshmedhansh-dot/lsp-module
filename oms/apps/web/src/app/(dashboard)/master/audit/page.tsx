"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  ScrollText,
  User,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeUsers: 0,
    loginEvents: 0,
    dataChanges: 0,
  });

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (userFilter !== "all") params.set("user_id", userFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/v1/system/audit-logs?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          toast.error("Access denied - Admin only");
          return;
        }
        throw new Error("Failed to fetch audit logs");
      }
      const result = await response.json();

      const mappedLogs = (result || []).map((log: Record<string, unknown>) => ({
        id: log.id,
        action: log.action || "UNKNOWN",
        entityType: log.entityType || "",
        entityId: log.entityId || "",
        userId: log.userId || "",
        userName: log.userName || "System",
        changes: log.changes,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      }));

      setLogs(mappedLogs);
      setStats({
        totalEvents: mappedLogs.length,
        activeUsers: new Set(mappedLogs.map((l: AuditLog) => l.userId)).size,
        loginEvents: mappedLogs.filter((l: AuditLog) => l.action === "LOGIN").length,
        dataChanges: mappedLogs.filter((l: AuditLog) => ["CREATE", "UPDATE", "DELETE"].includes(l.action)).length,
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, userFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const actionTypes = [
    { value: "all", label: "All Actions" },
    { value: "CREATE", label: "Create" },
    { value: "UPDATE", label: "Update" },
    { value: "DELETE", label: "Delete" },
    { value: "LOGIN", label: "Login" },
    { value: "LOGOUT", label: "Logout" },
    { value: "EXPORT", label: "Export" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all user actions and system events across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const csv = logs.map(a => `${a.entityType},${a.action},${a.userName || "System"},${a.createdAt}`).join("\n");
            const blob = new Blob(["Entity,Action,User,Date\n" + csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={fetchAuditLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <ScrollText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Login Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.loginEvents}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Changes</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dataChanges}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {Array.from(new Map(logs.map((l) => [l.userId, l.userName || "System"])).entries()).map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>
            Comprehensive log of all actions performed in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Audit Logs</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Audit logs will appear here as users perform actions in the system.
                All create, update, delete operations are automatically logged.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy, HH:mm:ss") : "-"}
                    </TableCell>
                    <TableCell>{log.userName || "System"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        log.action === "DELETE" ? "destructive" :
                        log.action === "CREATE" ? "default" :
                        "secondary"
                      }>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{log.entityType}</span>
                      {log.entityId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({log.entityId.slice(0, 8)}...)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || "-"}
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
