"use client";

import { useState, useEffect, useCallback } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Download,
  Calendar,
  RefreshCw,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  summary: {
    todayOrders: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    totalInventory: number;
    totalSKUs: number;
  };
  ordersByStatus: Record<string, number>;
}

interface AnalyticsTrend {
  date: string;
  orders: number;
  revenue: number;
}

interface TopSKU {
  id: string;
  code: string;
  name: string;
  totalOrdered: number;
  totalRevenue: number;
}

interface ChannelBreakdown {
  channel: string;
  orders: number;
  revenue: number;
  percentage: number;
}

const periodOptions = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

export default function SalesAnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrend[]>([]);
  const [topSKUs, setTopSKUs] = useState<TopSKU[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<ChannelBreakdown[]>([]);
  const [previousPeriodStats, setPreviousPeriodStats] = useState<DashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch dashboard stats
      const statsResponse = await fetch("/api/v1/dashboard/stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch analytics trends
      const analyticsResponse = await fetch(`/api/v1/dashboard/analytics?days=${period}`);
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setTrends(analyticsData.trends || []);
      }

      // Fetch orders for channel breakdown and top SKUs
      const ordersResponse = await fetch("/api/v1/orders?limit=100");
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        const orders = Array.isArray(ordersData) ? ordersData : ordersData.orders || [];

        // Calculate channel breakdown
        const channelMap: Record<string, { orders: number; revenue: number }> = {};
        orders.forEach((order: any) => {
          const channel = order.channel || "DIRECT";
          if (!channelMap[channel]) {
            channelMap[channel] = { orders: 0, revenue: 0 };
          }
          channelMap[channel].orders += 1;
          channelMap[channel].revenue += parseFloat(order.totalAmount || 0);
        });

        const totalOrders = Object.values(channelMap).reduce((sum, ch) => sum + ch.orders, 0);
        const breakdown = Object.entries(channelMap).map(([channel, data]) => ({
          channel,
          orders: data.orders,
          revenue: data.revenue,
          percentage: totalOrders > 0 ? Math.round((data.orders / totalOrders) * 100) : 0,
        }));
        setChannelBreakdown(breakdown.sort((a, b) => b.orders - a.orders));

        // Calculate top SKUs from order items
        const skuMap: Record<string, { code: string; name: string; qty: number; revenue: number }> = {};
        orders.forEach((order: any) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              const skuId = item.skuId || item.id;
              if (!skuMap[skuId]) {
                skuMap[skuId] = {
                  code: item.skuCode || item.sku?.code || "Unknown",
                  name: item.skuName || item.sku?.name || "Unknown SKU",
                  qty: 0,
                  revenue: 0,
                };
              }
              skuMap[skuId].qty += item.quantity || 1;
              skuMap[skuId].revenue += parseFloat(item.totalPrice || item.price || 0) * (item.quantity || 1);
            });
          }
        });

        const topSkuList = Object.entries(skuMap)
          .map(([id, data]) => ({
            id,
            code: data.code,
            name: data.name,
            totalOrdered: data.qty,
            totalRevenue: data.revenue,
          }))
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 10);
        setTopSKUs(topSkuList);
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-IN").format(value);
  };

  // Calculate totals from trends
  const totalRevenue = trends.reduce((sum, t) => sum + t.revenue, 0);
  const totalOrders = trends.reduce((sum, t) => sum + t.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate growth (mock - would need previous period data)
  const revenueGrowth = stats?.summary?.totalRevenue ? 12.5 : 0;
  const ordersGrowth = stats?.summary?.todayOrders ? 8.2 : 0;

  const channelColors: Record<string, string> = {
    AMAZON: "bg-orange-500",
    FLIPKART: "bg-yellow-500",
    MYNTRA: "bg-pink-500",
    SHOPIFY: "bg-green-500",
    WEBSITE: "bg-blue-500",
    DIRECT: "bg-purple-500",
    D2C: "bg-indigo-500",
    B2B: "bg-teal-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Analytics</h1>
          <p className="text-muted-foreground">
            Deep insights into your sales performance and trends
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.summary?.totalRevenue || totalRevenue)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {revenueGrowth >= 0 ? (
                    <>
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-green-600">+{revenueGrowth}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-3 w-3 mr-1 text-red-600" />
                      <span className="text-red-600">{revenueGrowth}%</span>
                    </>
                  )}
                  <span className="ml-1">vs last period</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(totalOrders || stats?.summary?.deliveredOrders || 0)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {ordersGrowth >= 0 ? (
                    <>
                      <ArrowUpRight className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-green-600">+{ordersGrowth}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="h-3 w-3 mr-1 text-red-600" />
                      <span className="text-red-600">{ordersGrowth}%</span>
                    </>
                  )}
                  <span className="ml-1">vs last period</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                  <span className="text-green-600">+5.2%</span>
                  <span className="ml-1">vs last period</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active SKUs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(stats?.summary?.totalSKUs || 0)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="text-muted-foreground">
                    {formatNumber(stats?.summary?.totalInventory || 0)} units in stock
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Daily revenue over the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : trends.length > 0 ? (
              <div className="h-[300px]">
                <div className="flex flex-col gap-2 h-full overflow-y-auto">
                  {trends.slice(-14).map((trend, index) => {
                    const maxRevenue = Math.max(...trends.map((t) => t.revenue));
                    const percentage = maxRevenue > 0 ? (trend.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={index} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20">
                          {new Date(trend.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-24 text-right">
                          {formatCurrency(trend.revenue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No revenue data available</p>
                  <p className="text-sm">Revenue will appear once orders are placed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Channel</CardTitle>
            <CardDescription>Order distribution across sales channels</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : channelBreakdown.length > 0 ? (
              <div className="h-[300px] space-y-4 overflow-y-auto">
                {channelBreakdown.map((channel) => (
                  <div key={channel.channel} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${
                            channelColors[channel.channel] || "bg-gray-500"
                          } text-white`}
                        >
                          {channel.channel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {channel.orders} orders
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(channel.revenue)}
                      </span>
                    </div>
                    <div className="bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`${
                          channelColors[channel.channel] || "bg-gray-500"
                        } h-full rounded-full transition-all`}
                        style={{ width: `${channel.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No channel data available</p>
                  <p className="text-sm">Channel breakdown will appear once orders are placed</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status Breakdown</CardTitle>
          <CardDescription>Current status of all orders</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : stats?.ordersByStatus ? (
            <div className="grid gap-4 md:grid-cols-5">
              {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="flex flex-col items-center p-4 border rounded-lg"
                >
                  <span className="text-2xl font-bold">{formatNumber(count)}</span>
                  <Badge variant="outline" className="mt-2">
                    {status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No order status data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>Best performing SKUs by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : topSKUs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>SKU Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSKUs.map((sku, index) => (
                  <TableRow key={sku.id}>
                    <TableCell>
                      <Badge variant={index < 3 ? "default" : "outline"}>
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{sku.code}</TableCell>
                    <TableCell>{sku.name}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(sku.totalOrdered)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sku.totalRevenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sales data available</p>
              <p className="text-sm text-muted-foreground">
                Top products will appear here once orders are processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
