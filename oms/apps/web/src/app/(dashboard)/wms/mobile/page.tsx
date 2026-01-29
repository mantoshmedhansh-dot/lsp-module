"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  RefreshCw,
  Battery,
  MapPin,
  Scan,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Settings,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface MobileDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  status: string;
  assignedLocationId: string | null;
  assignedUserId: string | null;
  assignedUserName?: string;
  lastActiveAt: string | null;
  registeredAt: string;
}

interface MobileTask {
  id: string;
  taskNo: string;
  taskType: string;
  status: string;
  assignedUserId: string | null;
  assignedUserName?: string;
  totalLines: number;
  completedLines: number;
  totalQuantity: number;
  completedQuantity: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface ScanLog {
  id: string;
  deviceId: string;
  userId: string;
  userName?: string;
  scanType: string;
  barcode: string;
  isSuccessful: boolean;
  scannedAt: string;
}

export default function MobileWMSPage() {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("devices");

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/mobile/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/mobile/tasks?status=IN_PROGRESS,ASSIGNED");
      if (response.ok) {
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  const fetchScanLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/mobile/scan-logs?limit=50");
      if (response.ok) {
        const data = await response.json();
        setScanLogs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching scan logs:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDevices(), fetchTasks(), fetchScanLogs()]);
    setIsLoading(false);
  }, [fetchDevices, fetchTasks, fetchScanLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getDeviceStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800"><Wifi className="mr-1 h-3 w-3" />Active</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-red-100 text-red-800"><WifiOff className="mr-1 h-3 w-3" />Suspended</Badge>;
      case "DECOMMISSIONED":
        return <Badge variant="secondary">Decommissioned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTaskStatusBadge = (status: string) => {
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

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "TABLET":
        return <Tablet className="h-5 w-5" />;
      case "HANDHELD_SCANNER":
        return <Scan className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const activeDevices = devices.filter(d => d.status === "ACTIVE").length;
  const activeTasks = tasks.filter(t => t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mobile WMS</h1>
          <p className="text-muted-foreground">
            Manage mobile devices and warehouse tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeDevices} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDevices}</div>
            <Progress value={(activeDevices / devices.length) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasks}</div>
            <p className="text-xs text-muted-foreground">
              {tasks.length} total tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Scans</CardTitle>
            <Scan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              {scanLogs.filter(s => s.isSuccessful).length} successful
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {activeTasks > 0 && (
              <Badge variant="secondary" className="ml-2">{activeTasks}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scans">Scan Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Registered Devices</CardTitle>
              <CardDescription>Mobile devices registered for WMS operations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No devices registered</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              {getDeviceIcon(device.deviceType)}
                            </div>
                            <div>
                              <p className="font-medium">{device.deviceName}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {device.deviceId.slice(0, 12)}...
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{device.deviceType.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          {device.manufacturer && device.model ? (
                            <span>{device.manufacturer} {device.model}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {device.assignedUserName ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {device.assignedUserName}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {device.lastActiveAt ? (
                            <span className="text-sm">
                              {new Date(device.lastActiveAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>{getDeviceStatusBadge(device.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Mobile Tasks</CardTitle>
              <CardDescription>Active and assigned mobile tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active tasks</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-center">Progress</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium font-mono">{task.taskNo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.taskType}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.assignedUserName || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(task.completedLines / task.totalLines) * 100}
                              className="h-2 w-20"
                            />
                            <span className="text-sm">
                              {task.completedLines}/{task.totalLines}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {task.completedQuantity}/{task.totalQuantity}
                        </TableCell>
                        <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                        <TableCell>
                          {task.startedAt ? (
                            new Date(task.startedAt).toLocaleTimeString()
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scans">
          <Card>
            <CardHeader>
              <CardTitle>Recent Scan Logs</CardTitle>
              <CardDescription>Barcode scan activity</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : scanLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Scan className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scan logs recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono">{log.barcode}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.scanType}</Badge>
                        </TableCell>
                        <TableCell>{log.userName || log.userId.slice(0, 8)}</TableCell>
                        <TableCell>
                          {log.isSuccessful ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(log.scannedAt).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
