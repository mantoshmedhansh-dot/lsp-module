"use client";

import { useSession } from "next-auth/react";
import {
  Package,
  ShoppingCart,
  Truck,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  PackageCheck,
  Building2,
  Users,
  Boxes,
  Settings,
  BarChart3,
  MapPin,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useDashboardStats, useDashboardAnalytics } from "@/hooks";

type ChangeType = "positive" | "negative" | "neutral";

// Status color mapping for order breakdown
const statusColors: Record<string, string> = {
  CREATED: "bg-blue-500",
  CONFIRMED: "bg-cyan-500",
  ALLOCATED: "bg-yellow-500",
  PICKING: "bg-orange-500",
  PACKED: "bg-purple-500",
  MANIFESTED: "bg-indigo-500",
  SHIPPED: "bg-green-500",
  IN_TRANSIT: "bg-teal-500",
  OUT_FOR_DELIVERY: "bg-lime-500",
  DELIVERED: "bg-emerald-500",
  RTO: "bg-red-500",
  CANCELLED: "bg-gray-500",
};

// Human-readable status names
const statusLabels: Record<string, string> = {
  CREATED: "New Orders",
  CONFIRMED: "Confirmed",
  ALLOCATED: "Allocated",
  PICKING: "Picking",
  PACKED: "Packed",
  MANIFESTED: "Manifested",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RTO: "RTO",
  CANCELLED: "Cancelled",
};

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}Cr`;
  } else if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toFixed(0);
}

// Format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString("en-IN");
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  // Fetch live dashboard data
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardStats({});

  const {
    data: analyticsData,
    isLoading: isLoadingAnalytics,
  } = useDashboardAnalytics({ period: "week" });

  const isLoading = isLoadingDashboard;
  const summary = dashboardData?.summary;
  const ordersByStatus = dashboardData?.ordersByStatus || {};

  // Build operations stats from live data
  const operationsStats = summary
    ? [
        {
          title: "Total Orders Today",
          value: formatNumber(summary.todayOrders || 0),
          change: "",
          changeType: "neutral" as ChangeType,
          icon: ShoppingCart,
          description: "orders placed today",
        },
        {
          title: "Pending Processing",
          value: formatNumber(summary.pendingOrders || 0),
          change: "",
          changeType: summary.pendingOrders > 50 ? ("negative" as ChangeType) : ("positive" as ChangeType),
          icon: Clock,
          description: "awaiting action",
        },
        {
          title: "Shipped",
          value: formatNumber(summary.shippedOrders || 0),
          change: "",
          changeType: "neutral" as ChangeType,
          icon: Truck,
          description: "shipments dispatched",
        },
        {
          title: "Delivered",
          value: formatNumber(summary.deliveredOrders || 0),
          change: "",
          changeType: "positive" as ChangeType,
          icon: CheckCircle,
          description: "successfully delivered",
        },
      ]
    : [];

  // Build master stats for super admin
  const masterStats = summary
    ? [
        {
          title: "Total Orders",
          value: formatNumber(summary.totalOrders || 0),
          change: "",
          changeType: "positive" as ChangeType,
          icon: ShoppingCart,
          description: "all time",
        },
        {
          title: "Total Revenue",
          value: `${formatCurrency(summary.totalRevenue || 0)}`,
          change: "",
          changeType: "positive" as ChangeType,
          icon: IndianRupee,
          description: "from delivered orders",
        },
        {
          title: "Total Inventory",
          value: formatNumber(summary.totalInventory || 0),
          change: "",
          changeType: "positive" as ChangeType,
          icon: Boxes,
          description: "units in stock",
        },
        {
          title: "Total SKUs",
          value: formatNumber(summary.totalSKUs || 0),
          change: "",
          changeType: "positive" as ChangeType,
          icon: Package,
          description: "active products",
        },
      ]
    : [];

  // Convert ordersByStatus object to array for rendering
  const orderStatusData = Object.entries(ordersByStatus)
    .filter(([, count]) => (count as number) > 0)
    .map(([status, count]) => ({
      status: statusLabels[status] || status,
      count: count as number,
      color: statusColors[status] || "bg-gray-500",
    }))
    .sort((a, b) => b.count - a.count);

  // Get max count for progress bar calculation
  const maxStatusCount = Math.max(...orderStatusData.map((s) => s.count), 1);

  // Recent activity - placeholder until we have real activity feed
  const recentActivity = dashboardData?.recentActivity?.length
    ? dashboardData.recentActivity
    : [
        {
          id: 1,
          action: "System initialized",
          time: "Just now",
          icon: CheckCircle,
          type: "operations",
        },
      ];

  if (dashboardError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {session?.user?.name || "User"}!
            </p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">
                Failed to load dashboard data
              </h3>
              <p className="text-sm text-red-600">
                There was an error connecting to the server. Please try again.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetchDashboard()}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSuperAdmin ? "Master Control Panel" : "Operations Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {session?.user?.name || "User"}!{" "}
            {isSuperAdmin
              ? "Here's your system overview."
              : "Here's your order management overview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {isSuperAdmin && (
            <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2 text-white">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">Super Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Master Panel Stats - Only for Super Admin */}
      {isSuperAdmin && (
        <>
          <div>
            <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
              System Overview
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="border-l-4 border-l-blue-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-20 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </CardContent>
                    </Card>
                  ))
                : masterStats.map((stat) => (
                    <Card key={stat.title} className="border-l-4 border-l-blue-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          {stat.title}
                        </CardTitle>
                        <stat.icon className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground">
                          {stat.change && (
                            <span className="text-green-600">{stat.change} </span>
                          )}
                          {stat.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          </div>
        </>
      )}

      {/* Operations Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
          Today's Operations
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))
            : operationsStats.map((stat) => (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.change && (
                        <span
                          className={
                            stat.changeType === "positive"
                              ? "text-green-600"
                              : stat.changeType === "negative"
                                ? "text-red-600"
                                : "text-muted-foreground"
                          }
                        >
                          {stat.change}{" "}
                        </span>
                      )}
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Orders by Status */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center">
                    <Skeleton className="h-2 w-2 rounded-full mr-3" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                    <Skeleton className="ml-4 h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : orderStatusData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground/75">
                  Orders will appear here once created
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orderStatusData.map((item) => (
                  <div key={item.status} className="flex items-center">
                    <div className={`h-2 w-2 rounded-full ${item.color} mr-3`} />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {item.status}
                      </p>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${item.color}`}
                          style={{
                            width: `${(item.count / maxStatusCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="ml-4 font-medium">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity
                  .filter((a: { type?: string }) => isSuperAdmin || a.type !== "master")
                  .slice(0, 5)
                  .map((activity: { id: number; action: string; time: string; icon?: React.ElementType; type?: string }) => {
                    const ActivityIcon = activity.icon || CheckCircle;
                    return (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div
                          className={`rounded-full p-2 ${
                            activity.type === "master"
                              ? "bg-blue-100"
                              : activity.type === "alert"
                                ? "bg-red-100"
                                : "bg-muted"
                          }`}
                        >
                          <ActivityIcon
                            className={`h-3 w-3 ${
                              activity.type === "master"
                                ? "text-blue-600"
                                : activity.type === "alert"
                                  ? "text-red-600"
                                  : ""
                            }`}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {activity.action}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {isSuperAdmin && (
              <>
                <QuickActionButton
                  icon={Building2}
                  label="Manage Companies"
                  href="/master/companies"
                  variant="primary"
                />
                <QuickActionButton
                  icon={Users}
                  label="Manage Clients"
                  href="/master/brands"
                  variant="primary"
                />
              </>
            )}
            <QuickActionButton
              icon={ShoppingCart}
              label="View All Orders"
              href="/orders"
            />
            <QuickActionButton
              icon={Boxes}
              label="Inventory Overview"
              href="/inventory"
            />
            <QuickActionButton
              icon={BarChart3}
              label="View Reports"
              href="/reports"
            />
            <QuickActionButton
              icon={Settings}
              label="System Settings"
              href="/settings"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  href,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  variant?: "default" | "primary";
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted ${
        variant === "primary"
          ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
          : ""
      }`}
    >
      <div
        className={`rounded-full p-2 ${
          variant === "primary" ? "bg-blue-600 text-white" : "bg-primary/10"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${variant === "primary" ? "" : "text-primary"}`}
        />
      </div>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
