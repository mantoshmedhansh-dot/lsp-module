"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  TrendingUp,
  Package,
  ShoppingCart,
  Boxes,
  IndianRupee,
  Percent,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface DashboardData {
  // Row 1: Order Volume Metrics
  totalOrders: number;
  totalOrderLines: number;
  totalOrderQuantity: number;
  distinctSkuSold: number;
  avgLinesPerOrder: number;

  // Row 2: Financial Metrics
  totalOrderAmount: number;
  avgOrderAmount: number;
  codPercentage: number;
  totalDiscount: number;
  orderQtyPendingStock: number;

  // Row 3: Order Status Metrics
  totalPendingOrder: number;
  unfulfillableLineLevelOrder: number;
  totalUnfulfillableOrder: number;
  totalSlaBreachedOrder: number;
  totalFailedOrder: number;

  // Charts data
  orderCountByDate: { date: string; count: number }[];
  orderLineCountByDate: { date: string; count: number }[];

  // Metadata
  period: number;
  generatedAt: string;
}

type CardColor = "blue" | "orange" | "yellow" | "teal" | "green" | "red" | "darkRed";

// KPI Card Component matching Vinculum style
function KPICard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  color: CardColor;
  icon?: React.ElementType;
}) {
  const colorClasses: Record<CardColor, string> = {
    blue: "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-700",
    orange: "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-700",
    yellow: "bg-gradient-to-br from-amber-400 to-amber-500 border-amber-600",
    teal: "bg-gradient-to-br from-teal-500 to-teal-600 border-teal-700",
    green: "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-700",
    red: "bg-gradient-to-br from-red-500 to-red-600 border-red-700",
    darkRed: "bg-gradient-to-br from-rose-600 to-rose-700 border-rose-800",
  };

  return (
    <div
      className={`${colorClasses[color]} border-b-4 rounded-lg p-4 text-white shadow-lg relative overflow-hidden min-h-[100px] transition-transform hover:scale-[1.02]`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 z-10">
          <p className="text-sm font-medium opacity-95 mb-2 leading-tight">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="absolute right-3 bottom-3 opacity-25">
          {Icon ? (
            <Icon className="h-14 w-14" strokeWidth={1.5} />
          ) : (
            <BarChart3 className="h-14 w-14" strokeWidth={1.5} />
          )}
        </div>
      </div>
    </div>
  );
}

// Bar Chart Component matching Vinculum style
function BarChart({
  data,
  title,
  period,
  onPeriodChange,
}: {
  data: { date: string; count: number }[];
  title: string;
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const maxValue = Math.max(...data.map((d) => d.count), 1);

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const step = Math.ceil(maxValue / yAxisSteps);
  const yAxisLabels = [];
  for (let i = yAxisSteps; i >= 0; i--) {
    yAxisLabels.push(i * step);
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-center mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500">[Click On The Bar(s) To Drilldown]</p>
      </div>

      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 text-xs text-gray-500 h-[220px]">
          {yAxisLabels.map((label, i) => (
            <span key={i} className="text-right w-12">
              {label.toLocaleString()}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1">
          <div className="flex items-end justify-around h-[220px] border-l border-b border-gray-300 bg-gray-50/50">
            {data.slice(-7).map((item, index) => {
              const height = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
              return (
                <div
                  key={index}
                  className="flex flex-col items-center justify-end h-full px-1"
                  style={{ width: `${100 / Math.min(data.length, 7)}%` }}
                >
                  <div
                    className="bg-sky-400 hover:bg-sky-500 w-full max-w-[45px] cursor-pointer transition-all rounded-t shadow-sm"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? "4px" : "0" }}
                    title={`${item.count.toLocaleString()} on ${formatDate(item.date)}`}
                  />
                </div>
              );
            })}
          </div>
          {/* X-axis labels */}
          <div className="flex justify-around mt-2 border-l border-transparent">
            {data.slice(-7).map((item, index) => (
              <span
                key={index}
                className="text-xs text-gray-500 text-center truncate"
                style={{ width: `${100 / Math.min(data.length, 7)}%` }}
              >
                {formatDate(item.date)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[320px] rounded-lg" />
        <Skeleton className="h-[320px] rounded-lg" />
      </div>
    </div>
  );
}

export default function SellerPanelDashboard() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("7");
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(`/api/v1/dashboard/seller-panel?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Format number in Indian style (lakhs, crores)
  const formatIndianNumber = (num: number) => {
    if (num >= 10000000) {
      return (num / 10000000).toFixed(2) + " Cr";
    }
    if (num >= 100000) {
      return (num / 100000).toFixed(2) + " L";
    }
    return num.toLocaleString("en-IN");
  };

  // Format currency in Indian style
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchDashboardData()} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Seller Panel Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, {session?.user?.name || "User"}! Here&apos;s your order management overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid - Row 1: Order Volume Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Orders"
          value={formatIndianNumber(dashboardData?.totalOrders || 0)}
          color="blue"
          icon={ShoppingCart}
        />
        <KPICard
          label="Total Order Lines"
          value={formatIndianNumber(dashboardData?.totalOrderLines || 0)}
          color="orange"
          icon={Package}
        />
        <KPICard
          label="Total Order Quantity"
          value={formatIndianNumber(dashboardData?.totalOrderQuantity || 0)}
          color="blue"
          icon={Boxes}
        />
        <KPICard
          label="Distinct SKU Sold"
          value={formatIndianNumber(dashboardData?.distinctSkuSold || 0)}
          color="yellow"
          icon={Package}
        />
        <KPICard
          label="Average Lines Per Order"
          value={(dashboardData?.avgLinesPerOrder || 0).toFixed(2)}
          color="teal"
          icon={TrendingUp}
        />
      </div>

      {/* KPI Cards Grid - Row 2: Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Order Amount"
          value={formatCurrency(dashboardData?.totalOrderAmount || 0)}
          color="blue"
          icon={IndianRupee}
        />
        <KPICard
          label="Avg. Order Amount"
          value={formatCurrency(dashboardData?.avgOrderAmount || 0)}
          color="orange"
          icon={TrendingUp}
        />
        <KPICard
          label="% COD Orders"
          value={(dashboardData?.codPercentage || 0).toFixed(2)}
          color="blue"
          icon={Percent}
        />
        <KPICard
          label="Total Discount"
          value={formatCurrency(dashboardData?.totalDiscount || 0)}
          color="yellow"
          icon={IndianRupee}
        />
        <KPICard
          label="Order Qty Pending Stock"
          value={formatIndianNumber(dashboardData?.orderQtyPendingStock || 0)}
          color="teal"
          icon={Clock}
        />
      </div>

      {/* KPI Cards Grid - Row 3: Order Status Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Pending Order"
          value={formatIndianNumber(dashboardData?.totalPendingOrder || 0)}
          color="green"
          icon={Clock}
        />
        <KPICard
          label="Unfulfillable Line Level Order"
          value={formatIndianNumber(dashboardData?.unfulfillableLineLevelOrder || 0)}
          color="orange"
          icon={AlertTriangle}
        />
        <KPICard
          label="Total Unfulfillable Order"
          value={formatIndianNumber(dashboardData?.totalUnfulfillableOrder || 0)}
          color="red"
          icon={XCircle}
        />
        <KPICard
          label="Total SLA Breached Order"
          value={formatIndianNumber(dashboardData?.totalSlaBreachedOrder || 0)}
          color="darkRed"
          icon={AlertTriangle}
        />
        <KPICard
          label="Total Failed Order"
          value={formatIndianNumber(dashboardData?.totalFailedOrder || 0)}
          color="darkRed"
          icon={XCircle}
        />
      </div>

      {/* Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={dashboardData?.orderCountByDate || []}
          title="Order Count - By Date"
          period={period}
          onPeriodChange={setPeriod}
        />
        <BarChart
          data={dashboardData?.orderLineCountByDate || []}
          title="Order Line Count - By Date"
          period={period}
          onPeriodChange={setPeriod}
        />
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 py-2">
        Last updated: {dashboardData?.generatedAt ? new Date(dashboardData.generatedAt).toLocaleString() : "N/A"}
      </div>
    </div>
  );
}
