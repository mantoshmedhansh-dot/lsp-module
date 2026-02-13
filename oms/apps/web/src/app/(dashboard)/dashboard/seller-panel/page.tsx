"use client";

import { useState } from "react";
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
import { useDashboardStats, useDashboardAnalytics } from "@/hooks";

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

// Bar Chart Component (display-only, no per-chart period selector)
function BarChart({
  data,
  title,
}: {
  data: { date: string; count: number }[];
  title: string;
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
      <div className="text-center mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No data for this period</p>
        </div>
      ) : (
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
      )}
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
  const [period, setPeriod] = useState("7");

  const periodDays = parseInt(period);
  const analyticsPeriod = periodDays <= 7 ? "week" : periodDays <= 30 ? "month" : "year";

  const {
    data: statsData,
    isLoading,
    isFetching,
    error: statsError,
    refetch,
  } = useDashboardStats({ days: periodDays });

  const {
    data: analyticsData,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useDashboardAnalytics({ period: analyticsPeriod });

  const error = statsError || analyticsError;

  // Derive KPI values from hook data
  const summary = statsData?.summary;
  const totalOrders = summary?.totalOrders || 0;
  const totalRevenue = summary?.totalRevenue || 0;
  const pendingOrders = summary?.pendingOrders || 0;
  const totalSKUs = summary?.totalSKUs || 0;
  const avgOrderAmount = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Build chart data from analytics
  const orderCountByDate = (analyticsData?.orderTrend || []).map((t) => ({
    date: t.date,
    count: t.orders,
  }));

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

  // First load only: show skeleton when no data yet
  if (isLoading && !statsData) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Inline error banner — doesn't replace the dashboard */}
      {error && !isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            Could not load dashboard data. Please retry.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); refetchAnalytics(); }}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Retry
          </Button>
        </div>
      )}

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
            onClick={() => { refetch(); refetchAnalytics(); }}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid - Row 1: Order Volume Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Orders"
          value={formatIndianNumber(totalOrders)}
          color="blue"
          icon={ShoppingCart}
        />
        <KPICard
          label="Total Order Lines"
          value={formatIndianNumber(totalOrders)}
          color="orange"
          icon={Package}
        />
        <KPICard
          label="Total Order Quantity"
          value={formatIndianNumber(totalOrders)}
          color="blue"
          icon={Boxes}
        />
        <KPICard
          label="Distinct SKU Sold"
          value={formatIndianNumber(totalSKUs)}
          color="yellow"
          icon={Package}
        />
        <KPICard
          label="Average Lines Per Order"
          value={totalOrders > 0 ? "1.00" : "0.00"}
          color="teal"
          icon={TrendingUp}
        />
      </div>

      {/* KPI Cards Grid - Row 2: Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Order Amount"
          value={formatCurrency(totalRevenue)}
          color="blue"
          icon={IndianRupee}
        />
        <KPICard
          label="Avg. Order Amount"
          value={formatCurrency(avgOrderAmount)}
          color="orange"
          icon={TrendingUp}
        />
        <KPICard
          label="% COD Orders"
          value="0.00"
          color="blue"
          icon={Percent}
        />
        <KPICard
          label="Total Discount"
          value={formatCurrency(0)}
          color="yellow"
          icon={IndianRupee}
        />
        <KPICard
          label="Order Qty Pending Stock"
          value={formatIndianNumber(0)}
          color="teal"
          icon={Clock}
        />
      </div>

      {/* KPI Cards Grid - Row 3: Order Status Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Pending Order"
          value={formatIndianNumber(pendingOrders)}
          color="green"
          icon={Clock}
        />
        <KPICard
          label="Unfulfillable Line Level Order"
          value={formatIndianNumber(0)}
          color="orange"
          icon={AlertTriangle}
        />
        <KPICard
          label="Total Unfulfillable Order"
          value={formatIndianNumber(0)}
          color="red"
          icon={XCircle}
        />
        <KPICard
          label="Total SLA Breached Order"
          value={formatIndianNumber(0)}
          color="darkRed"
          icon={AlertTriangle}
        />
        <KPICard
          label="Total Failed Order"
          value={formatIndianNumber(0)}
          color="darkRed"
          icon={XCircle}
        />
      </div>

      {/* Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          data={orderCountByDate}
          title="Order Count - By Date"
        />
        <BarChart
          data={orderCountByDate}
          title="Order Line Count - By Date"
        />
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-gray-400 py-2">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
