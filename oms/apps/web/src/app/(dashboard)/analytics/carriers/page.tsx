"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  TrendingUp,
  Package,
  Loader2,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { parseDecimal, formatNumber } from "@/lib/api";

interface Transporter {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface CarrierPerformance {
  transporterId: string;
  totalShipments: number;
  deliveredShipments: number;
  rtoShipments: number;
  avgTATDays: number | string;
  onTimeRate: number | string;
  rtoRate: number | string;
  ndrRate?: number | string;
  overallScore: number | string;
}

interface AnalyticsSummary {
  activeCarriers: number;
  totalShipments: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  ndrRate: number;
}

export default function CarrierAnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [performance, setPerformance] = useState<CarrierPerformance[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    activeCarriers: 0,
    totalShipments: 0,
    avgDeliveryTime: 0,
    onTimeRate: 0,
    ndrRate: 0,
  });

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      // Fetch active transporters
      const transportersRes = await fetch("/api/v1/transporters?isActive=true");
      let transporterList: Transporter[] = [];
      if (transportersRes.ok) {
        const data = await transportersRes.json();
        transporterList = Array.isArray(data) ? data : data.items || [];
        setTransporters(transporterList);
      }

      // Calculate date range
      const now = new Date();
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Fetch carrier performance
      const perfRes = await fetch(
        `/api/v1/analytics/carrier-performance?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`
      );

      let perfList: CarrierPerformance[] = [];
      if (perfRes.ok) {
        const perfData = await perfRes.json();
        perfList = Array.isArray(perfData) ? perfData : perfData.items || [];
        setPerformance(perfList);
      }

      // Calculate summary
      const activeCarriers = transporterList.filter((t) => t.isActive).length;
      const totalShipments = perfList.reduce(
        (sum, p) => sum + (p.totalShipments || 0),
        0
      );
      const avgDeliveryTime =
        perfList.length > 0
          ? perfList.reduce((sum, p) => sum + parseDecimal(p.avgTATDays), 0) /
            perfList.length
          : 0;
      const onTimeRate =
        perfList.length > 0
          ? perfList.reduce((sum, p) => sum + parseDecimal(p.onTimeRate), 0) /
            perfList.length
          : 0;
      const ndrRate =
        perfList.length > 0
          ? perfList.reduce((sum, p) => sum + parseDecimal(p.ndrRate || 0), 0) /
            perfList.length
          : 0;

      setSummary({
        activeCarriers,
        totalShipments,
        avgDeliveryTime,
        onTimeRate,
        ndrRate,
      });

      if (showToast) {
        toast.success("Data refreshed successfully");
      }
    } catch (error) {
      console.error("Error fetching carrier analytics:", error);
      if (showToast) {
        toast.error("Failed to refresh data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const getCarrierPerformance = (transporterId: string) => {
    return performance.find((p) => p.transporterId === transporterId);
  };

  const getPerformanceBadge = (score: number | string) => {
    const numScore = parseDecimal(score);
    if (numScore >= 80)
      return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (numScore >= 60)
      return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    if (numScore >= 40)
      return <Badge className="bg-orange-100 text-orange-800">Average</Badge>;
    if (numScore > 0)
      return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
    return <Badge variant="outline">No Data</Badge>;
  };

  const formatPercent = (value: number | string | undefined) => {
    if (value === undefined) return "--";
    const num = parseDecimal(value);
    return num > 0 ? `${num.toFixed(1)}%` : "--";
  };

  const formatDays = (value: number | string | undefined) => {
    if (value === undefined) return "--";
    const num = parseDecimal(value);
    return num > 0 ? `${num.toFixed(1)} days` : "--";
  };

  // Calculate shipment distribution
  const shipmentDistribution = transporters.map((t) => {
    const perf = getCarrierPerformance(t.id);
    const shipments = perf?.totalShipments || 0;
    const percentage =
      summary.totalShipments > 0
        ? (shipments / summary.totalShipments) * 100
        : 0;
    return {
      name: t.name,
      shipments,
      percentage,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carrier Analytics</h1>
          <p className="text-muted-foreground">
            Compare carrier performance and delivery metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Carriers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeCarriers}</div>
            <p className="text-xs text-muted-foreground">
              {transporters
                .filter((t) => t.isActive)
                .map((t) => t.name)
                .join(", ") || "No active carriers"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDays(summary.avgDeliveryTime)}
            </div>
            <p className="text-xs text-muted-foreground">Across all carriers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary.onTimeRate)}
            </div>
            <Progress
              value={parseDecimal(summary.onTimeRate)}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NDR Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary.ndrRate)}
            </div>
            <Progress
              value={parseDecimal(summary.ndrRate)}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Carrier Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Carrier Performance Comparison</CardTitle>
          <CardDescription>
            Side-by-side comparison of all active carriers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transporters.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Avg TAT</TableHead>
                  <TableHead className="text-right">NDR Rate</TableHead>
                  <TableHead className="text-right">RTO Rate</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transporters.map((transporter) => {
                  const perf = getCarrierPerformance(transporter.id);
                  return (
                    <TableRow key={transporter.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          <div>
                            <div>{transporter.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {transporter.code}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(perf?.totalShipments || 0, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(perf?.deliveredShipments || 0, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDays(perf?.avgTATDays)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(perf?.ndrRate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(perf?.rtoRate)}
                      </TableCell>
                      <TableCell>
                        {getPerformanceBadge(perf?.overallScore || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No carriers configured</p>
              <p className="text-sm text-muted-foreground">
                Add carriers in Settings to see analytics
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Performance Trend</CardTitle>
            <CardDescription>On-time delivery percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Performance trend will appear here</p>
                <p className="text-sm">
                  {summary.totalShipments > 0
                    ? `Based on ${formatNumber(summary.totalShipments, 0)} shipments`
                    : "No data available for the selected period"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipment Distribution</CardTitle>
            <CardDescription>Volume share by carrier</CardDescription>
          </CardHeader>
          <CardContent>
            {shipmentDistribution.some((d) => d.shipments > 0) ? (
              <div className="space-y-4">
                {shipmentDistribution.map((dist) => (
                  <div key={dist.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{dist.name}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(dist.shipments, 0)} ({dist.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={dist.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Distribution chart will appear here</p>
                  <p className="text-sm">No shipment data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
