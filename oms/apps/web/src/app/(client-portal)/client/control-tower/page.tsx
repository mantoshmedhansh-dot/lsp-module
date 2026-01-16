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
  Package,
  RefreshCw,
  ShieldAlert,
  Target,
  Truck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface SLAPredictions {
  onTrack: number;
  atRisk: number;
  breached: number;
  critical: number;
}

interface DayPerformancePrediction {
  metric: string;
  date: string;
  predictedOrders: number;
  predictedOnTime: number;
  predictedDelayed: number;
  predictedPercentage: number;
  targetPercentage: number;
  status: string;
  riskFactors: string[];
}

interface CarrierHealth {
  carrierId: string;
  carrierName: string;
  status: string;
  avgDelay: number;
  ndrRate: number;
}

interface ControlTowerSnapshot {
  timestamp: Date;
  activeOrders: number;
  ordersAtRisk: number;
  ordersBreached: number;
  slaPredictions: SLAPredictions;
  dayPerformance: {
    d0: DayPerformancePrediction;
    d1: DayPerformancePrediction;
    d2: DayPerformancePrediction;
  };
  carrierHealth: CarrierHealth[];
  inventoryHealth: {
    stockoutRisk: number;
    lowStockSkus: number;
    criticalSkus: number;
  };
}

interface PredictiveInsight {
  type: string;
  severity: string;
  title: string;
  description: string;
  predictedImpact: {
    affectedOrders?: number;
    revenueAtRisk?: number;
    slaImpact?: number;
  };
  timeToImpact: number;
  confidence: number;
  recommendations: {
    action: string;
    effort: string;
    impact: string;
  }[];
}

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

export default function ClientControlTowerPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [snapshot, setSnapshot] = useState<ControlTowerSnapshot>(mockSnapshot);
  const [insights, setInsights] = useState<PredictiveInsight[]>(mockInsights);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [snapshotRes, insightsRes] = await Promise.all([
        fetch("/api/v1/control-tower"),
        fetch("/api/v1/control-tower/insights"),
      ]);

      if (snapshotRes.ok) {
        const snapshotData = await snapshotRes.json();
        if (snapshotData.success) setSnapshot(snapshotData.data);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        if (insightsData.success) setInsights(insightsData.data.insights || []);
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getOverallStatus = () => {
    if (snapshot.ordersBreached > 20) return "RED";
    if (snapshot.ordersAtRisk > 30) return "YELLOW";
    return "GREEN";
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Gauge className="h-7 w-7" />
            Control Tower
          </h1>
          <p className="text-gray-500">
            Real-time order monitoring and predictive insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
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
        <h2 className="mb-4 text-lg font-semibold text-gray-600 flex items-center gap-2">
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
        <h2 className="mb-4 text-lg font-semibold text-gray-600 flex items-center gap-2">
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Predictive Insights */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Predictive Insights
          </h3>
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No actionable insights at this time</p>
              </div>
            ) : (
              insights.slice(0, 3).map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))
            )}
          </div>
        </div>

        {/* Carrier Health */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-blue-500" />
            Carrier Health
          </h3>
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
                    <p className="text-sm text-gray-500">
                      Avg delay: {carrier.avgDelay}h | NDR: {carrier.ndrRate}%
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    carrier.status === "HEALTHY"
                      ? "bg-green-100 text-green-700"
                      : carrier.status === "DEGRADED"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {carrier.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Health */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-indigo-500" />
          Inventory Health
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Stockout Risk</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mt-1">
              {snapshot.inventoryHealth.stockoutRisk}%
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${snapshot.inventoryHealth.stockoutRisk}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Low Stock SKUs</span>
              <Package className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mt-1">
              {snapshot.inventoryHealth.lowStockSkus}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              SKUs below reorder point
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Critical SKUs</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600">
              {snapshot.inventoryHealth.criticalSkus}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              SKUs with stockout imminent
            </p>
          </div>
        </div>
      </div>
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
    green: { border: "border-l-green-500", icon: "text-green-600", bg: "bg-green-100" },
    amber: { border: "border-l-amber-500", icon: "text-amber-600", bg: "bg-amber-100" },
    orange: { border: "border-l-orange-500", icon: "text-orange-600", bg: "bg-orange-100" },
    red: { border: "border-l-red-500", icon: "text-red-600", bg: "bg-red-100" },
  };

  return (
    <div className={`bg-white rounded-lg border border-l-4 ${colorClasses[color].border} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div className={`rounded-full p-2 ${colorClasses[color].bg}`}>
          <Icon className={`h-4 w-4 ${colorClasses[color].icon}`} />
        </div>
      </div>
      <div className="text-2xl font-bold">{count.toLocaleString()}</div>
      <p className="text-xs text-gray-500">{percentage}% of active orders</p>
    </div>
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
      case "EXCEEDING": return "text-green-600";
      case "ON_TARGET": return "text-blue-600";
      case "BELOW_TARGET": return "text-amber-600";
      case "CRITICAL": return "text-red-600";
      default: return "text-gray-500";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "EXCEEDING": return "bg-green-100";
      case "ON_TARGET": return "bg-blue-100";
      case "BELOW_TARGET": return "bg-amber-100";
      case "CRITICAL": return "bg-red-100";
      default: return "bg-gray-100";
    }
  };

  const getTrendIcon = (status: string) => {
    if (status === "EXCEEDING") return TrendingUp;
    if (status === "CRITICAL" || status === "BELOW_TARGET") return TrendingDown;
    return Target;
  };

  const TrendIcon = getTrendIcon(prediction.status);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold">{metric} - {label}</span>
        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBg(prediction.status)} ${getStatusColor(prediction.status)}`}>
          {prediction.status.replace("_", " ")}
        </span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-3xl font-bold">{prediction.predictedPercentage}%</div>
          <p className="text-sm text-gray-500">Target: {prediction.targetPercentage}%</p>
        </div>
        <div className={`rounded-full p-3 ${getStatusBg(prediction.status)}`}>
          <TrendIcon className={`h-6 w-6 ${getStatusColor(prediction.status)}`} />
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Predicted Orders</span>
          <span className="font-medium">{prediction.predictedOrders}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">On Time</span>
          <span className="font-medium text-green-600">{prediction.predictedOnTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Delayed</span>
          <span className="font-medium text-red-600">{prediction.predictedDelayed}</span>
        </div>
      </div>
      {prediction.riskFactors.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-500 mb-2">Risk Factors:</p>
          <div className="flex flex-wrap gap-1">
            {prediction.riskFactors.map((factor, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-gray-100 rounded">{factor}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Component: Insight Card
function InsightCard({ insight }: { insight: PredictiveInsight }) {
  const severityColors: Record<string, string> = {
    INFO: "bg-blue-100 text-blue-700",
    WARNING: "bg-amber-100 text-amber-700",
    CRITICAL: "bg-red-100 text-red-700",
  };

  const typeIcons: Record<string, React.ElementType> = {
    SLA_RISK: AlertTriangle,
    CAPACITY_CONSTRAINT: Gauge,
    CARRIER_ISSUE: Truck,
    INVENTORY_RISK: Package,
    DEMAND_SPIKE: TrendingUp,
  };

  const Icon = typeIcons[insight.type] || AlertTriangle;

  return (
    <div className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${
          insight.severity === "CRITICAL" ? "bg-red-100" :
          insight.severity === "WARNING" ? "bg-amber-100" : "bg-blue-100"
        }`}>
          <Icon className={`h-4 w-4 ${
            insight.severity === "CRITICAL" ? "text-red-600" :
            insight.severity === "WARNING" ? "text-amber-600" : "text-blue-600"
          }`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium">{insight.title}</h4>
            <span className={`px-2 py-1 text-xs font-medium rounded ${severityColors[insight.severity] || severityColors.INFO}`}>
              {insight.severity}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">{insight.description}</p>
          <div className="flex gap-4 text-sm">
            {insight.predictedImpact.affectedOrders && (
              <div>
                <span className="text-gray-500">Affected: </span>
                <span className="font-medium">{insight.predictedImpact.affectedOrders} orders</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Time to impact: </span>
              <span className="font-medium">{insight.timeToImpact} min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
