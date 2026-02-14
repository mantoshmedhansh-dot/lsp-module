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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  Calendar,
  Target,
  Package,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { parseDecimal, formatNumber } from "@/lib/api";
import { exportToCSV, type ExportColumn } from "@/lib/utils";

interface CarrierPerformance {
  id: string;
  transporterId: string;
  transporterName?: string;
  transporterCode?: string;
  totalShipments: number;
  deliveredShipments: number;
  rtoShipments: number;
  avgTATDays: number | string;
  successRate: number | string;
  rtoRate: number | string;
  onTimeRate: number | string;
  costScore: number | string;
  speedScore: number | string;
  reliabilityScore: number | string;
  overallScore: number | string;
}

interface PerformanceSummary {
  totalShipments: number;
  deliveredShipments: number;
  avgOnTimeRate: number;
  avgTAT: number;
  avgRTORate: number;
}

interface Transporter {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export default function DeliveryPerformancePage() {
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carriers, setCarriers] = useState<CarrierPerformance[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary>({
    totalShipments: 0,
    deliveredShipments: 0,
    avgOnTimeRate: 0,
    avgTAT: 0,
    avgRTORate: 0,
  });

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      // Fetch transporters first
      const transportersRes = await fetch("/api/v1/transporters");
      if (transportersRes.ok) {
        const transportersData = await transportersRes.json();
        const transporterList = Array.isArray(transportersData)
          ? transportersData
          : transportersData.items || [];
        setTransporters(transporterList);
      }

      // Calculate date range based on period
      const now = new Date();
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Try to fetch carrier performance data
      const performanceRes = await fetch(
        `/api/v1/analytics/carrier-scorecard?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`
      );

      if (performanceRes.ok) {
        const performanceData = await performanceRes.json();
        const carrierList = Array.isArray(performanceData)
          ? performanceData
          : performanceData.items || [];
        setCarriers(carrierList);

        // Calculate summary from carrier data
        if (carrierList.length > 0) {
          const totalShipments = carrierList.reduce(
            (sum: number, c: CarrierPerformance) => sum + (c.totalShipments || 0), 0
          );
          const deliveredShipments = carrierList.reduce(
            (sum: number, c: CarrierPerformance) => sum + (c.deliveredShipments || 0), 0
          );
          const avgOnTimeRate = carrierList.reduce(
            (sum: number, c: CarrierPerformance) => sum + parseDecimal(c.onTimeRate), 0
          ) / carrierList.length;
          const avgTAT = carrierList.reduce(
            (sum: number, c: CarrierPerformance) => sum + parseDecimal(c.avgTATDays), 0
          ) / carrierList.length;
          const avgRTORate = carrierList.reduce(
            (sum: number, c: CarrierPerformance) => sum + parseDecimal(c.rtoRate), 0
          ) / carrierList.length;

          setSummary({
            totalShipments,
            deliveredShipments,
            avgOnTimeRate,
            avgTAT,
            avgRTORate,
          });
        }
      } else {
        // If no performance data, try to get basic delivery stats
        const deliveryRes = await fetch(
          `/api/v1/analytics/carrier-scorecard/summary?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`
        );

        if (deliveryRes.ok) {
          const stats = await deliveryRes.json();
          setSummary({
            totalShipments: stats.total || 0,
            deliveredShipments: stats.delivered || 0,
            avgOnTimeRate: stats.onTimeRate || 0,
            avgTAT: stats.avgTAT || 0,
            avgRTORate: stats.rtoRate || 0,
          });
        }
      }

      if (showToast) {
        toast.success("Data refreshed successfully");
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
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

  const getScoreBadge = (score: number | string) => {
    const numScore = parseDecimal(score);
    if (numScore >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (numScore >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    if (numScore >= 40) return <Badge className="bg-orange-100 text-orange-800">Average</Badge>;
    if (numScore > 0) return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
    return <Badge variant="outline">No Data</Badge>;
  };

  const formatPercent = (value: number | string) => {
    const num = parseDecimal(value);
    return num > 0 ? `${num.toFixed(1)}%` : "--";
  };

  const formatDays = (value: number | string) => {
    const num = parseDecimal(value);
    return num > 0 ? `${num.toFixed(1)} days` : "--";
  };

  // Map transporters with their performance data
  const carrierData = transporters.map((transporter) => {
    const perf = carriers.find((c) => c.transporterId === transporter.id);
    return {
      id: transporter.id,
      name: transporter.name,
      code: transporter.code,
      totalShipments: perf?.totalShipments || 0,
      deliveredShipments: perf?.deliveredShipments || 0,
      onTimeRate: perf?.onTimeRate || 0,
      avgTATDays: perf?.avgTATDays || 0,
      rtoRate: perf?.rtoRate || 0,
      overallScore: perf?.overallScore || 0,
    };
  });

  // Export carrier performance data to CSV
  const handleExport = () => {
    const columns: ExportColumn[] = [
      { key: "code", header: "Carrier Code" },
      { key: "name", header: "Carrier Name" },
      { key: "totalShipments", header: "Total Shipments" },
      { key: "deliveredShipments", header: "Delivered" },
      { key: "onTimeRate", header: "On-Time %", formatter: (v) => `${parseDecimal(v).toFixed(1)}%` },
      { key: "avgTATDays", header: "Avg TAT (Days)", formatter: (v) => parseDecimal(v).toFixed(1) },
      { key: "rtoRate", header: "RTO %", formatter: (v) => `${parseDecimal(v).toFixed(1)}%` },
      { key: "overallScore", header: "Score", formatter: (v) => parseDecimal(v).toFixed(0) },
    ];
    exportToCSV(carrierData, columns, `carrier_performance_${period}`);
    toast.success("Performance data exported successfully");
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Delivery Performance</h1>
          <p className="text-muted-foreground">
            Monitor and analyze delivery metrics and carrier performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Period" />
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary.totalShipments, 0)}
            </div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary.avgOnTimeRate)}
            </div>
            <Progress
              value={parseDecimal(summary.avgOnTimeRate)}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Target: 85%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg TAT</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDays(summary.avgTAT)}
            </div>
            <p className="text-xs text-muted-foreground">Days to deliver</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RTO Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(summary.avgRTORate)}
            </div>
            <Progress
              value={parseDecimal(summary.avgRTORate)}
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Target: &lt;5%</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Carrier */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Carrier</CardTitle>
          <CardDescription>
            Detailed metrics for each courier partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {carrierData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">On-Time %</TableHead>
                  <TableHead className="text-right">Avg TAT</TableHead>
                  <TableHead className="text-right">RTO Rate</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carrierData.map((carrier) => (
                  <TableRow key={carrier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{carrier.name}</div>
                          <div className="text-xs text-muted-foreground">{carrier.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(carrier.totalShipments, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(carrier.deliveredShipments, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(carrier.onTimeRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDays(carrier.avgTATDays)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(carrier.rtoRate)}
                    </TableCell>
                    <TableCell>
                      {getScoreBadge(carrier.overallScore)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No carrier data available</p>
              <p className="text-sm text-muted-foreground">
                Carrier metrics will appear once shipments are processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance by Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Zone</CardTitle>
          <CardDescription>
            Delivery performance across different geographic zones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No zone performance data available</p>
            <p className="text-sm text-muted-foreground">
              Zone metrics will appear once shipments are tracked
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Timeline Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Timeline Distribution</CardTitle>
          <CardDescription>
            How long shipments take to deliver
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { label: "Same Day", value: 0 },
              { label: "Next Day", value: 0 },
              { label: "2-3 Days", value: 0 },
              { label: "4-7 Days", value: 0 },
              { label: ">7 Days", value: 0 },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold">
                  {item.value > 0 ? formatNumber(item.value, 0) : "--"}
                </p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
