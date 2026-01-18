"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  RefreshCw,
  Target,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Package,
  Truck,
} from "lucide-react";

interface SLAMetric {
  name: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  status: string;
  sampleSize: number;
}

interface AtRiskOrder {
  id: string;
  deliveryNo: string;
  awbNo: string;
  status: string;
  expectedDeliveryDate: string | null;
  hoursRemaining: number;
  risk: string;
}

interface SLAData {
  overallScore: number;
  meetingTarget: number;
  atRisk: number;
  breached: number;
  metrics: SLAMetric[];
  period: {
    days: number;
    from: string;
    to: string;
  };
}

interface TrendPoint {
  week: string;
  weekStart: string;
  slaScore: number;
  ordersProcessed: number;
  delivered: number;
}

export default function SLAMonitorPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [slaData, setSlaData] = useState<SLAData | null>(null);
  const [atRiskOrders, setAtRiskOrders] = useState<AtRiskOrder[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [periodDays, setPeriodDays] = useState("7");

  const fetchSLAData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch SLA metrics
      const metricsResponse = await fetch(`/api/v1/sla/metrics?days=${periodDays}`);
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        setSlaData(data);
      }

      // Fetch at-risk orders
      const atRiskResponse = await fetch("/api/v1/sla/at-risk-orders?limit=10");
      if (atRiskResponse.ok) {
        const data = await atRiskResponse.json();
        setAtRiskOrders(data.atRiskOrders || []);
      }

      // Fetch trend data
      const trendResponse = await fetch("/api/v1/sla/trend?weeks=12");
      if (trendResponse.ok) {
        const data = await trendResponse.json();
        setTrendData(data.trend || []);
      }
    } catch (error) {
      console.error("Failed to fetch SLA data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    fetchSLAData();
  }, [fetchSLAData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "meeting":
        return <Badge className="bg-green-100 text-green-700">On Target</Badge>;
      case "at_risk":
        return <Badge className="bg-yellow-100 text-yellow-700">At Risk</Badge>;
      case "breached":
        return <Badge className="bg-red-100 text-red-700">Breached</Badge>;
      default:
        return <Badge variant="outline">No Data</Badge>;
    }
  };

  const getStatusColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/control-tower")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SLA Monitor</h1>
            <p className="text-muted-foreground">
              Track service level agreements and operational targets
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchSLAData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall SLA Health */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall SLA Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {slaData?.overallScore !== undefined ? `${slaData.overallScore}%` : "--"}
            </div>
            <Progress
              value={slaData?.overallScore || 0}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {slaData ? `Based on ${periodDays} day period` : "No data available"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meeting Target</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {slaData?.meetingTarget ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">of 6 metrics</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {slaData?.atRisk ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Below target</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Breached</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {slaData?.breached ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* SLA Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {slaData?.metrics.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                {getStatusBadge(metric.status)}
              </div>
              <CardDescription className="text-xs">
                {metric.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {metric.current > 0 ? `${metric.current}${metric.unit}` : "--"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target: {metric.target}{metric.unit}
                  </p>
                </div>
                <div className="text-right">
                  <Progress
                    value={Math.min((metric.current / metric.target) * 100, 100)}
                    className={`w-24 h-2 ${getStatusColor(metric.current, metric.target)}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.sampleSize > 0
                      ? `${Math.round((metric.current / metric.target) * 100)}% of target`
                      : "No data"}
                  </p>
                </div>
              </div>
              {metric.sampleSize > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sample size: {metric.sampleSize} records
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Performance Trend</CardTitle>
          <CardDescription>
            Weekly SLA compliance over the last 12 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <div className="h-[300px] flex items-end gap-2">
              {trendData.map((point, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${Math.max(point.slaScore * 2.5, 10)}px` }}
                    title={`${point.week}: ${point.slaScore}%`}
                  />
                  <span className="text-xs text-muted-foreground mt-2 transform -rotate-45 origin-top-left">
                    {point.week.split("-")[1]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>SLA trend chart will appear here</p>
                <p className="text-sm">No historical data available yet</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* At-Risk Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Orders at SLA Risk</CardTitle>
          <CardDescription>
            Orders approaching or past their committed SLA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atRiskOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery #</TableHead>
                  <TableHead>AWB</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead>Time Remaining</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.deliveryNo}</TableCell>
                    <TableCell>{order.awbNo || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {order.expectedDeliveryDate
                        ? new Date(order.expectedDeliveryDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {order.hoursRemaining > 0
                        ? `${order.hoursRemaining}h`
                        : "Overdue"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          order.risk === "HIGH"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                      >
                        {order.risk}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-muted-foreground font-medium">All Clear!</p>
              <p className="text-sm text-muted-foreground">
                No orders at SLA risk currently
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
