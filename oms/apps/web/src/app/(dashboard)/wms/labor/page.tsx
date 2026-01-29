"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  RefreshCw,
  UserCheck,
  Timer,
  Target,
  BarChart3,
  Play,
  Pause,
  CheckCircle,
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

// Parse Decimal strings from API (CLAUDE.md Rule 4)
const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value;
};

interface DashboardData {
  activeWorkers: number;
  totalWorkers: number;
  activeShifts: number;
  averageProductivity: number;
  tasksCompleted: number;
  tasksInProgress: number;
  topPerformers: Array<{
    userId: string;
    userName: string;
    tasksCompleted: number;
    avgEfficiency: number;
  }>;
  recentActivity: Array<{
    id: string;
    userName: string;
    action: string;
    timestamp: string;
  }>;
}

interface Shift {
  id: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: string;
  assignedWorkers: number;
}

interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  clockInTime: string;
  clockOutTime: string | null;
  breakMinutes: number;
  status: string;
}

export default function LaborManagementPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/labor/dashboard");
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
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

  const fetchTimeEntries = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`/api/v1/labor/time-entries?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        setTimeEntries(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching time entries:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDashboard(), fetchShifts(), fetchTimeEntries()]);
    setIsLoading(false);
  }, [fetchDashboard, fetchShifts, fetchTimeEntries]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "CLOCKED_IN":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "ON_BREAK":
        return <Badge className="bg-yellow-100 text-yellow-800">On Break</Badge>;
      case "COMPLETED":
      case "CLOCKED_OUT":
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Labor Management</h1>
          <p className="text-muted-foreground">
            Monitor workforce productivity and manage shifts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/wms/labor/shifts")}>
            <Calendar className="mr-2 h-4 w-4" />
            Manage Shifts
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.activeWorkers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {dashboard?.totalWorkers || 0} total workers
            </p>
            <Progress
              value={dashboard ? (dashboard.activeWorkers / dashboard.totalWorkers) * 100 : 0}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboard?.activeShifts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently running shifts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Productivity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {parseDecimal(dashboard?.averageProductivity).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Against standard rates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.tasksCompleted || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.tasksInProgress || 0} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shifts">Active Shifts</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Top Performers Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-4">Loading...</div>
                ) : dashboard?.topPerformers?.length ? (
                  <div className="space-y-4">
                    {dashboard.topPerformers.slice(0, 5).map((performer, index) => (
                      <div key={performer.userId} className="flex items-center gap-4">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-white ${
                          index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-600" : "bg-gray-300"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{performer.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {performer.tasksCompleted} tasks
                          </p>
                        </div>
                        <Badge variant="outline">
                          {parseDecimal(performer.avgEfficiency).toFixed(0)}% efficiency
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No performance data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-4">Loading...</div>
                ) : dashboard?.recentActivity?.length ? (
                  <div className="space-y-4">
                    {dashboard.recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.action}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No recent activity
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>Active Shifts</CardTitle>
              <CardDescription>Currently running shift schedules</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : shifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active shifts</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shift Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Workers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">{shift.shiftCode}</TableCell>
                        <TableCell>{shift.shiftName}</TableCell>
                        <TableCell>
                          {shift.startTime} - {shift.endTime}
                        </TableCell>
                        <TableCell>{shift.assignedWorkers}</TableCell>
                        <TableCell>{getStatusBadge(shift.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Today's Attendance</CardTitle>
              <CardDescription>Worker clock-in/out records</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : timeEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Timer className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No attendance records today</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Break (min)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.userName}</TableCell>
                        <TableCell>
                          {new Date(entry.clockInTime).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          {entry.clockOutTime
                            ? new Date(entry.clockOutTime).toLocaleTimeString()
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{entry.breakMinutes}</TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Productivity Leaderboard
              </CardTitle>
              <CardDescription>Top performers based on task completion and efficiency</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : !dashboard?.topPerformers?.length ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Award className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No leaderboard data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-center">Tasks Completed</TableHead>
                      <TableHead className="text-center">Efficiency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.topPerformers.map((performer, index) => (
                      <TableRow key={performer.userId}>
                        <TableCell>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-white ${
                            index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-600" : "bg-gray-200 text-gray-600"
                          }`}>
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{performer.userName}</TableCell>
                        <TableCell className="text-center text-lg font-bold">
                          {performer.tasksCompleted}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseDecimal(performer.avgEfficiency) >= 100 ? "default" : "secondary"}>
                            {parseDecimal(performer.avgEfficiency).toFixed(0)}%
                          </Badge>
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
