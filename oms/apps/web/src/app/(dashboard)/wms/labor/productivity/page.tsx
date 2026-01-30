"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  RefreshCw,
  Users,
  Target,
  Clock,
  Award,
  BarChart3,
  Calendar,
  Download,
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value;
};

interface ProductivityData {
  userId: string;
  userName: string;
  taskType: string;
  tasksCompleted: number;
  tasksTarget: number;
  unitsProcessed: number;
  unitsTarget: number;
  avgTimePerTask: number;
  standardTimePerTask: number;
  efficiency: number;
  rank: number;
}

interface SummaryStats {
  totalWorkers: number;
  avgEfficiency: number;
  totalTasksCompleted: number;
  totalUnitsProcessed: number;
  topPerformerName: string;
  topPerformerEfficiency: number;
}

export default function ProductivityPage() {
  const [productivityData, setProductivityData] = useState<ProductivityData[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("today");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const fetchProductivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ dateRange });
      if (taskTypeFilter !== "all") {
        params.append("taskType", taskTypeFilter);
      }

      const response = await fetch(`/api/v1/labor/productivity?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProductivityData(Array.isArray(data.workers) ? data.workers : []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Error fetching productivity:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, taskTypeFilter]);

  useEffect(() => {
    fetchProductivity();
  }, [fetchProductivity]);

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 100) {
      return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    } else if (efficiency >= 80) {
      return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
    } else if (efficiency >= 60) {
      return <Badge className="bg-yellow-100 text-yellow-800">Fair</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Below Target</Badge>;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white">1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-white">2nd</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-white">3rd</Badge>;
    return <Badge variant="outline">{rank}th</Badge>;
  };

  const handleExport = () => {
    const csvContent = [
      ["Worker", "Task Type", "Tasks Completed", "Target", "Units", "Efficiency", "Rank"].join(","),
      ...productivityData.map((d) =>
        [d.userName, d.taskType, d.tasksCompleted, d.tasksTarget, d.unitsProcessed, `${d.efficiency}%`, d.rank].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productivity-report-${dateRange}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productivity Reports</h1>
          <p className="text-muted-foreground">
            Monitor and analyze worker productivity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={fetchProductivity}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="PICKING">Picking</SelectItem>
            <SelectItem value="PACKING">Packing</SelectItem>
            <SelectItem value="PUTAWAY">Putaway</SelectItem>
            <SelectItem value="RECEIVING">Receiving</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalWorkers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {parseDecimal(summary?.avgEfficiency).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalTasksCompleted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Processed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalUnitsProcessed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary?.topPerformerName || "-"}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.topPerformerEfficiency ? `${parseDecimal(summary.topPerformerEfficiency).toFixed(0)}% efficiency` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Worker Performance</CardTitle>
              <CardDescription>Efficiency rankings for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : productivityData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No productivity data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {productivityData.slice(0, 10).map((worker) => (
                    <div key={worker.userId} className="flex items-center gap-4">
                      <div className="w-8">{getRankBadge(worker.rank)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{worker.userName}</span>
                          <span className="text-sm text-muted-foreground">
                            {parseDecimal(worker.efficiency).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={Math.min(parseDecimal(worker.efficiency), 100)} className="h-2" />
                      </div>
                      <div className="w-24 text-right">
                        {getEfficiencyBadge(parseDecimal(worker.efficiency))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Productivity Report</CardTitle>
              <CardDescription>Complete breakdown by worker and task type</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : productivityData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No productivity data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead className="text-center">Tasks</TableHead>
                      <TableHead className="text-center">Units</TableHead>
                      <TableHead className="text-center">Avg Time</TableHead>
                      <TableHead className="text-center">Efficiency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productivityData.map((worker) => (
                      <TableRow key={`${worker.userId}-${worker.taskType}`}>
                        <TableCell>{getRankBadge(worker.rank)}</TableCell>
                        <TableCell className="font-medium">{worker.userName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{worker.taskType}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {worker.tasksCompleted} / {worker.tasksTarget}
                        </TableCell>
                        <TableCell className="text-center">
                          {worker.unitsProcessed} / {worker.unitsTarget}
                        </TableCell>
                        <TableCell className="text-center">
                          {parseDecimal(worker.avgTimePerTask).toFixed(1)}m
                          <span className="text-muted-foreground text-xs ml-1">
                            (std: {parseDecimal(worker.standardTimePerTask).toFixed(1)}m)
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={parseDecimal(worker.efficiency) >= 100 ? "text-green-600 font-bold" : ""}>
                            {parseDecimal(worker.efficiency).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>{getEfficiencyBadge(parseDecimal(worker.efficiency))}</TableCell>
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
