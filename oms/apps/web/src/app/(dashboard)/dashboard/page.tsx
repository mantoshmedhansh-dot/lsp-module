"use client";

import { useSession } from "next-auth/react";
import {
  Package,
  ShoppingCart,
  Truck,
  Clock,
  AlertCircle,
  CheckCircle,
  Building2,
  Users,
  Boxes,
  Settings,
  BarChart3,
  RefreshCw,
  IndianRupee,
  ArrowUpRight,
  Star,
  Store,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


import Link from "next/link";
import { useDashboardStats, useDashboardAnalytics } from "@/hooks";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Vibrant gradient palettes for stat cards
const gradients = {
  blue: "from-blue-500 to-blue-700",
  emerald: "from-emerald-500 to-teal-700",
  violet: "from-violet-500 to-purple-700",
  amber: "from-amber-500 to-orange-700",
  rose: "from-rose-500 to-pink-700",
  cyan: "from-cyan-500 to-blue-700",
  indigo: "from-indigo-500 to-blue-800",
  fuchsia: "from-fuchsia-500 to-purple-800",
};

// Status color mapping for order breakdown
const statusColors: Record<string, string> = {
  CREATED: "bg-blue-500",
  CONFIRMED: "bg-cyan-500",
  ALLOCATED: "bg-yellow-500",
  PICKING: "bg-orange-500",
  PACKED: "bg-purple-500",
  PICKLIST_GENERATED: "bg-violet-500",
  PICKED: "bg-fuchsia-500",
  MANIFESTED: "bg-indigo-500",
  SHIPPED: "bg-green-500",
  IN_TRANSIT: "bg-teal-500",
  OUT_FOR_DELIVERY: "bg-lime-500",
  DELIVERED: "bg-emerald-500",
  RTO: "bg-red-500",
  CANCELLED: "bg-gray-500",
};

const statusDotColors: Record<string, string> = {
  CREATED: "#3b82f6",
  CONFIRMED: "#06b6d4",
  ALLOCATED: "#eab308",
  PICKING: "#f97316",
  PACKED: "#a855f7",
  PICKLIST_GENERATED: "#8b5cf6",
  PICKED: "#d946ef",
  MANIFESTED: "#6366f1",
  SHIPPED: "#22c55e",
  IN_TRANSIT: "#14b8a6",
  OUT_FOR_DELIVERY: "#84cc16",
  DELIVERED: "#10b981",
  RTO: "#ef4444",
  CANCELLED: "#64748b",
};

// Human-readable status names
const statusLabels: Record<string, string> = {
  CREATED: "New Orders",
  CONFIRMED: "Confirmed",
  ALLOCATED: "Allocated",
  PICKING: "Picking",
  PACKED: "Packed",
  PICKLIST_GENERATED: "Picklist Generated",
  PICKED: "Picked",
  MANIFESTED: "Manifested",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RTO: "RTO",
  CANCELLED: "Cancelled",
};

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `\u20B9${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `\u20B9${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `\u20B9${(amount / 1000).toFixed(1)}K`;
  return `\u20B9${amount.toFixed(0)}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-IN");
}

// Mock weekly trend data (will be replaced by real analytics)
function generateWeeklyTrend(total: number) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const base = Math.max(Math.floor(total / 7), 1);
  return days.map((day) => ({
    day,
    orders: Math.max(0, base + Math.floor((Math.random() - 0.3) * base)),
    revenue: Math.max(0, (base * 500) + Math.floor((Math.random() - 0.3) * base * 500)),
  }));
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

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

  // Build stats
  const totalOrders = summary?.totalOrders || 0;
  const todayOrders = summary?.todayOrders || 0;
  const pendingOrders = summary?.pendingOrders || 0;
  const shippedOrders = summary?.shippedOrders || 0;
  const deliveredOrders = summary?.deliveredOrders || 0;
  const totalRevenue = summary?.totalRevenue || 0;
  const totalInventory = summary?.totalInventory || 0;
  const totalSKUs = summary?.totalSKUs || 0;

  // Order status data for pie chart
  const orderStatusData = Object.entries(ordersByStatus)
    .filter(([, count]) => (count as number) > 0)
    .map(([status, count]) => ({
      status,
      name: statusLabels[status] || status,
      value: count as number,
      color: statusDotColors[status] || "#64748b",
      bgColor: statusColors[status] || "bg-gray-500",
    }))
    .sort((a, b) => b.value - a.value);

  const maxStatusCount = Math.max(...orderStatusData.map((s) => s.value), 1);
  const totalStatusOrders = orderStatusData.reduce((sum, s) => sum + s.value, 0);

  // Weekly trend
  const weeklyTrend = generateWeeklyTrend(totalOrders);

  // Recent activity
  const recentActivity = dashboardData?.recentActivity?.length
    ? dashboardData.recentActivity
    : [
        { id: 1, action: "System initialized", time: "Just now", icon: CheckCircle, type: "operations" },
      ];

  return (
    <div className="space-y-6">
      {/* Inline error banner - doesn't replace entire dashboard */}
      {dashboardError && !isLoading && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              Server is warming up. Data will load shortly.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchDashboard()} className="border-amber-300 text-amber-700 hover:bg-amber-100">
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48cGF0aCBkPSJNMCAyMGgyME0yMCAwdjIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {isSuperAdmin ? "Command Center" : "Operations Dashboard"}
              </h1>
              {isSuperAdmin && (
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                  Super Admin
                </Badge>
              )}
            </div>
            <p className="text-white/80 text-lg">
              Welcome back, <span className="font-semibold text-white">{session?.user?.name || "User"}</span>
              {isSuperAdmin ? " — full system overview" : " — your order management hub"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDashboard()}
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Mini stats in hero */}
        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniHeroStat label="Orders Today" value={formatNumber(todayOrders)} icon={ShoppingCart} />
          <MiniHeroStat label="Pending" value={formatNumber(pendingOrders)} icon={Clock} />
          <MiniHeroStat label="Shipped" value={formatNumber(shippedOrders)} icon={Truck} />
          <MiniHeroStat label="Delivered" value={formatNumber(deliveredOrders)} icon={CheckCircle} />
        </div>
      </div>

      {/* Master Stats - Super Admin Only */}
      {isSuperAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <GradientStatCard
            title="Total Orders"
            value={formatNumber(totalOrders)}
            description="all time orders"
            icon={ShoppingCart}
            gradient={gradients.blue}
          />
          <GradientStatCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            description="from delivered orders"
            icon={IndianRupee}
            gradient={gradients.emerald}
          />
          <GradientStatCard
            title="Inventory"
            value={formatNumber(totalInventory)}
            description="units in stock"
            icon={Boxes}
            gradient={gradients.violet}
          />
          <GradientStatCard
            title="Active SKUs"
            value={formatNumber(totalSKUs)}
            description="product catalog"
            icon={Package}
            gradient={gradients.amber}
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Order Trend Chart */}
        <Card className="lg:col-span-4 shadow-md border-0 bg-white">
          <CardHeader className="pb-2">
            <div>
              <CardTitle className="text-lg font-bold">Order Trends</CardTitle>
              <p className="text-sm text-muted-foreground">This week&apos;s performance</p>
            </div>
          </CardHeader>
          <CardContent>
            {(
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weeklyTrend}>
                  <defs>
                    <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.95)",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                      padding: "12px 16px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fill="url(#orderGradient)"
                    dot={{ fill: "#6366f1", strokeWidth: 2, r: 4, stroke: "#fff" }}
                    activeDot={{ r: 6, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Donut */}
        <Card className="lg:col-span-3 shadow-md border-0 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold">Order Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">Current status breakdown</p>
          </CardHeader>
          <CardContent>
            {orderStatusData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 p-6 mb-4">
                  <Package className="h-10 w-10 text-indigo-400" />
                </div>
                <p className="font-medium text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Create your first order to see distribution</p>
                <Link href="/orders/new">
                  <Button className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md" size="sm">
                    <ShoppingCart className="mr-2 h-4 w-4" /> Create Order
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, idx) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(255,255,255,0.95)",
                          border: "none",
                          borderRadius: "8px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{totalStatusOrders}</div>
                      <div className="text-[10px] text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 max-h-[160px] overflow-y-auto">
                  {orderStatusData.slice(0, 6).map((item) => (
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Detailed Status Bars */}
        <Card className="shadow-md border-0 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Order Pipeline</CardTitle>
                <p className="text-sm text-muted-foreground">Status-wise breakdown</p>
              </div>
              <Link href="/orders">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                  View All <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {orderStatusData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No orders in pipeline</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orderStatusData.map((item) => (
                  <div key={item.status} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{item.value}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(item.value / maxStatusCount) * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-md border-0 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                <p className="text-sm text-muted-foreground">Latest operations</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                Live
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(
              <div className="space-y-3">
                {recentActivity
                  .filter((a: { type?: string }) => isSuperAdmin || a.type !== "master")
                  .slice(0, 6)
                  .map((activity: { id: number; action: string; time: string; icon?: React.ElementType; type?: string }) => {
                    const ActivityIcon = activity.icon || CheckCircle;
                    const iconBg = activity.type === "master"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                      : activity.type === "alert"
                        ? "bg-gradient-to-br from-red-500 to-rose-600"
                        : "bg-gradient-to-br from-gray-100 to-gray-200";
                    const iconText = activity.type === "master" || activity.type === "alert" ? "text-white" : "text-gray-600";
                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50/80 transition-colors">
                        <div className={`rounded-xl p-2.5 ${iconBg}`}>
                          <ActivityIcon className={`h-3.5 w-3.5 ${iconText}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none truncate">{activity.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
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
      <div>
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {isSuperAdmin && (
            <>
              <QuickActionCard icon={Building2} label="Companies" href="/master/companies" color="blue" />
              <QuickActionCard icon={Users} label="Clients" href="/master/brands" color="indigo" />
            </>
          )}
          <QuickActionCard icon={ShoppingCart} label="Orders" href="/orders" color="emerald" />
          <QuickActionCard icon={Store} label="Marketplace" href="/channels/marketplaces" color="violet" />
          <QuickActionCard icon={Boxes} label="Inventory" href="/inventory" color="amber" />
          <QuickActionCard icon={BarChart3} label="Reports" href="/reports" color="rose" />
          <QuickActionCard icon={Truck} label="Logistics" href="/logistics/tracking" color="cyan" />
          <QuickActionCard icon={Settings} label="Settings" href="/settings" color="slate" />
        </div>
      </div>
    </div>
  );
}

/* ═══ Sub-components ═══ */

function MiniHeroStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3">
      <div className="rounded-lg bg-white/20 p-2">
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-white/70">{label}</div>
      </div>
    </div>
  );
}

function GradientStatCard({
  title,
  value,
  description,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-0 bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Icon className="h-20 w-20" />
      </div>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="rounded-lg bg-white/20 backdrop-blur-sm p-2">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="text-sm text-white/70 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

const quickActionColors: Record<string, { bg: string; icon: string; hover: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600 bg-blue-100", hover: "hover:bg-blue-100 hover:shadow-blue-100" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600 bg-indigo-100", hover: "hover:bg-indigo-100 hover:shadow-indigo-100" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600 bg-emerald-100", hover: "hover:bg-emerald-100 hover:shadow-emerald-100" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600 bg-violet-100", hover: "hover:bg-violet-100 hover:shadow-violet-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600 bg-amber-100", hover: "hover:bg-amber-100 hover:shadow-amber-100" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600 bg-rose-100", hover: "hover:bg-rose-100 hover:shadow-rose-100" },
  cyan: { bg: "bg-cyan-50", icon: "text-cyan-600 bg-cyan-100", hover: "hover:bg-cyan-100 hover:shadow-cyan-100" },
  slate: { bg: "bg-slate-50", icon: "text-slate-600 bg-slate-100", hover: "hover:bg-slate-100 hover:shadow-slate-100" },
};

function QuickActionCard({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
}) {
  const c = quickActionColors[color] || quickActionColors.slate;
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-2.5 rounded-xl border border-transparent p-4 transition-all duration-200 ${c.bg} ${c.hover} hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className={`rounded-xl p-3 ${c.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
    </Link>
  );
}
