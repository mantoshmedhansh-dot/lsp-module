"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Gauge,
  Lightbulb,
  MapPin,
  Package,
  RefreshCw,
  ShieldAlert,
  Target,
  Truck,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  ControlTowerSnapshot,
  DayPerformancePrediction,
  CapacityPrediction,
  PredictiveInsight,
  SLAPrediction,
} from "@/lib/ai/types";

// Mock data for initial rendering
const mockSnapshot: ControlTowerSnapshot = {
  timestamp: new Date(),
  activeOrders: 1247,
  ordersAtRisk: 45,
  ordersBreached: 12,
  slaPredictions: {
    onTrack: 1156,
    atRisk: 67,
    breached: 12,
    critical: 12,
  },
  dayPerformance: {
    d0: {
      metric: "D0",
      date: new Date().toISOString(),
      predictedOrders: 234,
      predictedOnTime: 218,
      predictedDelayed: 16,
      predictedPercentage: 93,
      targetPercentage: 95,
      status: "BELOW_TARGET",
      riskFactors: ["High order volume", "Packing capacity stretched"],
    },
    d1: {
      metric: "D1",
      date: new Date(Date.now() + 86400000).toISOString(),
      predictedOrders: 567,
      predictedOnTime: 561,
      predictedDelayed: 6,
      predictedPercentage: 99,
      targetPercentage: 98,
      status: "EXCEEDING",
      riskFactors: [],
    },
    d2: {
      metric: "D2",
      date: new Date(Date.now() + 172800000).toISOString(),
      predictedOrders: 389,
      predictedOnTime: 385,
      predictedDelayed: 4,
      predictedPercentage: 99,
      targetPercentage: 99,
      status: "ON_TARGET",
      riskFactors: [],
    },
  },
  capacityStatus: {
    overall: "YELLOW",
    locations: [],
  },
  alerts: {
    p0: 1,
    p1: 3,
    p2: 8,
    p3: 12,
    total: 24,
  },
  carrierHealth: [
    { carrierId: "delhivery", carrierName: "Delhivery", status: "HEALTHY", avgDelay: 0.5, ndrRate: 2.3 },
    { carrierId: "bluedart", carrierName: "BlueDart", status: "DEGRADED", avgDelay: 4.2, ndrRate: 5.1 },
    { carrierId: "xpressbees", carrierName: "XpressBees", status: "HEALTHY", avgDelay: 1.1, ndrRate: 3.2 },
  ],
  inventoryHealth: {
    stockoutRisk: 15,
    lowStockSkus: 23,
    criticalSkus: 5,
  },
};

const mockInsights: PredictiveInsight[] = [
  {
    type: "SLA_RISK",
    severity: "CRITICAL",
    title: "45 orders at SLA breach risk",
    description: "Orders from Delhi NCR region facing delays due to carrier capacity constraints",
    predictedImpact: { affectedOrders: 45, revenueAtRisk: 125000, slaImpact: 3.6 },
    timeToImpact: 120,
    confidence: 0.87,
    recommendations: [
      { action: "Switch to alternate carrier for Delhi NCR", effort: "LOW", impact: "HIGH" },
      { action: "Prioritize high-value orders for expedited shipping", effort: "MEDIUM", impact: "MEDIUM" },
    ],
  },
  {
    type: "CAPACITY_CONSTRAINT",
    severity: "WARNING",
    title: "Packing station bottleneck predicted",
    description: "Packing utilization expected to hit 95% by 2 PM based on current order inflow",
    predictedImpact: { affectedOrders: 120, slaImpact: 1.2 },
    timeToImpact: 180,
    confidence: 0.82,
    recommendations: [
      { action: "Add temporary packing staff from picking", effort: "LOW", impact: "HIGH" },
      { action: "Enable batch packing for similar orders", effort: "MEDIUM", impact: "MEDIUM" },
    ],
  },
  {
    type: "CARRIER_ISSUE",
    severity: "WARNING",
    title: "BlueDart showing elevated delays",
    description: "Average delay increased from 1.2 to 4.2 hours over past 24 hours",
    predictedImpact: { affectedOrders: 67, slaImpact: 2.1 },
    timeToImpact: 60,
    confidence: 0.91,
    recommendations: [
      { action: "Route new orders to Delhivery for affected pincodes", effort: "LOW", impact: "HIGH" },
      { action: "Contact BlueDart operations for status update", effort: "LOW", impact: "LOW" },
    ],
  },
];

const mockCapacity: CapacityPrediction[] = [
  {
    locationId: "wh-1",
    locationCode: "DEL-01",
    locationName: "Delhi Warehouse",
    date: new Date().toISOString(),
    shift: "FULL_DAY",
    predictedOrderVolume: 450,
    predictedUnits: 1200,
    currentCapacity: { picking: 500, packing: 400, shipping: 600 },
    predictedUtilization: { picking: 82, packing: 95, shipping: 68 },
    bottleneck: "PACKING",
    capacityStatus: "STRETCHED",
    recommendations: ["Add temporary packing staff", "Enable batch packing"],
  },
  {
    locationId: "wh-2",
    locationCode: "MUM-01",
    locationName: "Mumbai Warehouse",
    date: new Date().toISOString(),
    shift: "FULL_DAY",
    predictedOrderVolume: 320,
    predictedUnits: 890,
    currentCapacity: { picking: 400, packing: 350, shipping: 500 },
    predictedUtilization: { picking: 72, packing: 78, shipping: 55 },
    bottleneck: "NONE",
    capacityStatus: "OPTIMAL",
    recommendations: [],
  },
  {
    locationId: "wh-3",
    locationCode: "BLR-01",
    locationName: "Bangalore Warehouse",
    date: new Date().toISOString(),
    shift: "FULL_DAY",
    predictedOrderVolume: 280,
    predictedUnits: 720,
    currentCapacity: { picking: 350, packing: 300, shipping: 400 },
    predictedUtilization: { picking: 68, packing: 71, shipping: 58 },
    bottleneck: "NONE",
    capacityStatus: "OPTIMAL",
    recommendations: [],
  },
];

export default function ControlTowerPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [snapshot, setSnapshot] = useState<ControlTowerSnapshot>(mockSnapshot);
  const [insights, setInsights] = useState<PredictiveInsight[]>(mockInsights);
  const [capacityData, setCapacityData] = useState<CapacityPrediction[]>(mockCapacity);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [snapshotRes, insightsRes, capacityRes] = await Promise.all([
        fetch("/api/control-tower"),
        fetch("/api/control-tower/insights"),
        fetch("/api/control-tower/capacity"),
      ]);

      if (snapshotRes.ok) {
        const snapshotData = await snapshotRes.json();
        if (snapshotData.success) setSnapshot(snapshotData.data);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        if (insightsData.success) setInsights(insightsData.data.insights || []);
      }

      if (capacityRes.ok) {
        const capacityResponse = await capacityRes.json();
        if (capacityResponse.success) setCapacityData(capacityResponse.data.locations || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch control tower data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getOverallStatus = () => {
    if (snapshot.alerts.p0 > 0 || snapshot.ordersBreached > 20) return "RED";
    if (snapshot.alerts.p1 > 2 || snapshot.ordersAtRisk > 30) return "YELLOW";
    return "GREEN";
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Gauge className="h-7 w-7" />
            Control Tower
          </h1>
          <p className="text-muted-foreground">
            Proactive operations monitoring and predictive insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-white ${
              overallStatus === "GREEN"
                ? "bg-green-600"
                : overallStatus === "YELLOW"
                  ? "bg-amber-500"
                  : "bg-red-600"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">
              {overallStatus === "GREEN"
                ? "All Systems Healthy"
                : overallStatus === "YELLOW"
                  ? "Attention Required"
                  : "Critical Issues"}
            </span>
          </div>
        </div>
      </div>

      {/* SLA Status Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground flex items-center gap-2">
          <Target className="h-5 w-5" />
          SLA Status Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SLACard
            title="On Track"
            count={snapshot.slaPredictions.onTrack}
            total={snapshot.activeOrders}
            icon={CheckCircle}
            color="green"
          />
          <SLACard
            title="At Risk"
            count={snapshot.slaPredictions.atRisk}
            total={snapshot.activeOrders}
            icon={AlertTriangle}
            color="amber"
          />
          <SLACard
            title="Critical"
            count={snapshot.slaPredictions.critical}
            total={snapshot.activeOrders}
            icon={ShieldAlert}
            color="orange"
          />
          <SLACard
            title="Breached"
            count={snapshot.slaPredictions.breached}
            total={snapshot.activeOrders}
            icon={XCircle}
            color="red"
          />
        </div>
      </div>

      {/* D0/D1/D2 Performance */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Delivery Performance Predictions
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <PerformanceCard
            metric="D0"
            label="Same Day"
            prediction={snapshot.dayPerformance.d0}
          />
          <PerformanceCard
            metric="D1"
            label="Next Day"
            prediction={snapshot.dayPerformance.d1}
          />
          <PerformanceCard
            metric="D2"
            label="2-Day"
            prediction={snapshot.dayPerformance.d2}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Predictive Insights */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Predictive Insights
            </CardTitle>
            <CardDescription>
              AI-powered predictions and recommended actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>No actionable insights at this time</p>
                </div>
              ) : (
                insights.slice(0, 5).map((insight, index) => (
                  <InsightCard key={index} insight={insight} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Carrier Health */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-500" />
              Carrier Health
            </CardTitle>
            <CardDescription>Real-time carrier performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {snapshot.carrierHealth.map((carrier) => (
                <div
                  key={carrier.carrierId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        carrier.status === "HEALTHY"
                          ? "bg-green-500"
                          : carrier.status === "DEGRADED"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{carrier.carrierName}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg delay: {carrier.avgDelay}h | NDR: {carrier.ndrRate}%
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={carrier.status === "HEALTHY" ? "default" : "destructive"}
                    className={
                      carrier.status === "HEALTHY"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : carrier.status === "DEGRADED"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : ""
                    }
                  >
                    {carrier.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Status */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Capacity Status
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capacityData.map((location) => (
            <CapacityCard key={location.locationId} capacity={location} />
          ))}
        </div>
      </div>

      {/* Alert Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Alert Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <AlertCountCard priority="P0" count={snapshot.alerts.p0} label="Critical" color="red" />
            <AlertCountCard priority="P1" count={snapshot.alerts.p1} label="High" color="orange" />
            <AlertCountCard priority="P2" count={snapshot.alerts.p2} label="Medium" color="amber" />
            <AlertCountCard priority="P3" count={snapshot.alerts.p3} label="Low" color="blue" />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            Inventory Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stockout Risk</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.inventoryHealth.stockoutRisk}%
              </div>
              <Progress
                value={snapshot.inventoryHealth.stockoutRisk}
                className="mt-2 h-2"
              />
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Low Stock SKUs</span>
                <Package className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold mt-1">
                {snapshot.inventoryHealth.lowStockSkus}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                SKUs below reorder point
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Critical SKUs</span>
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {snapshot.inventoryHealth.criticalSkus}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                SKUs with stockout imminent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component: SLA Status Card
function SLACard({
  title,
  count,
  total,
  icon: Icon,
  color,
}: {
  title: string;
  count: number;
  total: number;
  icon: React.ElementType;
  color: "green" | "amber" | "orange" | "red";
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    green: {
      border: "border-l-green-500",
      icon: "text-green-600",
      bg: "bg-green-100",
    },
    amber: {
      border: "border-l-amber-500",
      icon: "text-amber-600",
      bg: "bg-amber-100",
    },
    orange: {
      border: "border-l-orange-500",
      icon: "text-orange-600",
      bg: "bg-orange-100",
    },
    red: {
      border: "border-l-red-500",
      icon: "text-red-600",
      bg: "bg-red-100",
    },
  };

  return (
    <Card className={`border-l-4 ${colorClasses[color].border}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-full p-2 ${colorClasses[color].bg}`}>
          <Icon className={`h-4 w-4 ${colorClasses[color].icon}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">
          {percentage}% of active orders
        </p>
      </CardContent>
    </Card>
  );
}

// Component: D-Performance Card
function PerformanceCard({
  metric,
  label,
  prediction,
}: {
  metric: string;
  label: string;
  prediction: DayPerformancePrediction;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "EXCEEDING":
        return "text-green-600";
      case "ON_TARGET":
        return "text-blue-600";
      case "BELOW_TARGET":
        return "text-amber-600";
      case "CRITICAL":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "EXCEEDING":
        return "bg-green-100";
      case "ON_TARGET":
        return "bg-blue-100";
      case "BELOW_TARGET":
        return "bg-amber-100";
      case "CRITICAL":
        return "bg-red-100";
      default:
        return "bg-muted";
    }
  };

  const getTrendIcon = (status: string) => {
    if (status === "EXCEEDING") return TrendingUp;
    if (status === "CRITICAL" || status === "BELOW_TARGET") return TrendingDown;
    return Target;
  };

  const TrendIcon = getTrendIcon(prediction.status);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">
            {metric} - {label}
          </CardTitle>
          <Badge className={`${getStatusBg(prediction.status)} ${getStatusColor(prediction.status)} border-0`}>
            {prediction.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-bold">
              {prediction.predictedPercentage}%
            </div>
            <p className="text-sm text-muted-foreground">
              Target: {prediction.targetPercentage}%
            </p>
          </div>
          <div className={`rounded-full p-3 ${getStatusBg(prediction.status)}`}>
            <TrendIcon className={`h-6 w-6 ${getStatusColor(prediction.status)}`} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Predicted Orders</span>
            <span className="font-medium">{prediction.predictedOrders}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">On Time</span>
            <span className="font-medium text-green-600">
              {prediction.predictedOnTime}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delayed</span>
            <span className="font-medium text-red-600">
              {prediction.predictedDelayed}
            </span>
          </div>
        </div>

        {prediction.riskFactors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Risk Factors:</p>
            <div className="flex flex-wrap gap-1">
              {prediction.riskFactors.map((factor, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Component: Insight Card
function InsightCard({ insight }: { insight: PredictiveInsight }) {
  const severityColors = {
    INFO: "bg-blue-100 text-blue-700 border-blue-200",
    WARNING: "bg-amber-100 text-amber-700 border-amber-200",
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
  };

  const typeIcons = {
    SLA_RISK: AlertTriangle,
    CAPACITY_CONSTRAINT: Gauge,
    CARRIER_ISSUE: Truck,
    INVENTORY_RISK: Package,
    DEMAND_SPIKE: TrendingUp,
  };

  const Icon = typeIcons[insight.type] || AlertTriangle;

  return (
    <div className="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-full p-2 ${
            insight.severity === "CRITICAL"
              ? "bg-red-100"
              : insight.severity === "WARNING"
                ? "bg-amber-100"
                : "bg-blue-100"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              insight.severity === "CRITICAL"
                ? "text-red-600"
                : insight.severity === "WARNING"
                  ? "text-amber-600"
                  : "text-blue-600"
            }`}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium">{insight.title}</h4>
            <Badge className={severityColors[insight.severity]}>
              {insight.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {insight.description}
          </p>

          {/* Impact metrics */}
          <div className="flex gap-4 text-sm mb-3">
            {insight.predictedImpact.affectedOrders && (
              <div>
                <span className="text-muted-foreground">Affected: </span>
                <span className="font-medium">
                  {insight.predictedImpact.affectedOrders} orders
                </span>
              </div>
            )}
            {insight.predictedImpact.revenueAtRisk && (
              <div>
                <span className="text-muted-foreground">Revenue at risk: </span>
                <span className="font-medium text-red-600">
                  Rs.{(insight.predictedImpact.revenueAtRisk / 1000).toFixed(1)}K
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Time to impact: </span>
              <span className="font-medium">{insight.timeToImpact} min</span>
            </div>
          </div>

          {/* Recommendations */}
          {insight.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Recommended Actions:
              </p>
              {insight.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                >
                  <ArrowRight className="h-3 w-3 text-primary" />
                  <span className="flex-1">{rec.action}</span>
                  <Badge variant="outline" className="text-xs">
                    {rec.effort} effort
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {rec.impact} impact
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component: Capacity Card
function CapacityCard({ capacity }: { capacity: CapacityPrediction }) {
  const statusColors = {
    UNDER_UTILIZED: "bg-blue-100 text-blue-700",
    OPTIMAL: "bg-green-100 text-green-700",
    STRETCHED: "bg-amber-100 text-amber-700",
    OVERLOADED: "bg-red-100 text-red-700",
  };

  const getUtilizationColor = (util: number) => {
    if (util >= 95) return "bg-red-500";
    if (util >= 85) return "bg-amber-500";
    if (util >= 60) return "bg-green-500";
    return "bg-blue-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{capacity.locationName}</CardTitle>
            <CardDescription>{capacity.locationCode}</CardDescription>
          </div>
          <Badge className={statusColors[capacity.capacityStatus]}>
            {capacity.capacityStatus.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Predicted Volume</span>
            <span className="font-medium">{capacity.predictedOrderVolume} orders</span>
          </div>

          {/* Utilization bars */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={capacity.bottleneck === "PICKING" ? "font-bold text-red-600" : ""}>
                  Picking
                </span>
                <span>{capacity.predictedUtilization.picking}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUtilizationColor(capacity.predictedUtilization.picking)} transition-all`}
                  style={{ width: `${capacity.predictedUtilization.picking}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={capacity.bottleneck === "PACKING" ? "font-bold text-red-600" : ""}>
                  Packing
                </span>
                <span>{capacity.predictedUtilization.packing}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUtilizationColor(capacity.predictedUtilization.packing)} transition-all`}
                  style={{ width: `${capacity.predictedUtilization.packing}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={capacity.bottleneck === "SHIPPING" ? "font-bold text-red-600" : ""}>
                  Shipping
                </span>
                <span>{capacity.predictedUtilization.shipping}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUtilizationColor(capacity.predictedUtilization.shipping)} transition-all`}
                  style={{ width: `${capacity.predictedUtilization.shipping}%` }}
                />
              </div>
            </div>
          </div>

          {capacity.bottleneck !== "NONE" && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-red-600 font-medium">
                Bottleneck: {capacity.bottleneck}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Component: Alert Count Card
function AlertCountCard({
  priority,
  count,
  label,
  color,
}: {
  priority: string;
  count: number;
  label: string;
  color: "red" | "orange" | "amber" | "blue";
}) {
  const colorClasses = {
    red: "border-red-500 bg-red-50",
    orange: "border-orange-500 bg-orange-50",
    amber: "border-amber-500 bg-amber-50",
    blue: "border-blue-500 bg-blue-50",
  };

  const textColors = {
    red: "text-red-700",
    orange: "text-orange-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${textColors[color]}`}>
            {priority} - {label}
          </p>
          <p className="text-2xl font-bold">{count}</p>
        </div>
        <AlertTriangle className={`h-8 w-8 ${textColors[color]} opacity-50`} />
      </div>
    </div>
  );
}
