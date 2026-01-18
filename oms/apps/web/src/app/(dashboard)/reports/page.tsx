"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  IndianRupee,
  ShoppingCart,
  RefreshCw,
  Download,
  Calendar,
} from "lucide-react";

interface ReportData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    deliveryRate: number;
    returnRate: number;
  };
  ordersByStatus: { status: string; count: number; value: number }[];
  ordersByChannel: { channel: string; count: number; value: number }[];
  topProducts: { sku: string; name: string; quantity: number; revenue: number }[];
  transporterPerformance: {
    transporter: string;
    shipments: number;
    delivered: number;
    rto: number;
    avgDeliveryDays: number;
  }[];
  dailyTrend: { date: string; orders: number; revenue: number }[];
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [channel, setChannel] = useState("");
  const [locationId, setLocationId] = useState("");

  // Fetch report data
  const { data, isLoading, refetch } = useQuery<ReportData>({
    queryKey: ["reports", dateRange, channel, locationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to,
      });
      if (channel) params.append("channel", channel);
      if (locationId) params.append("locationId", locationId);

      const res = await fetch(`/api/v1/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  const locations = locationsData?.data || [];
  const summary = data?.summary || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    deliveryRate: 0,
    returnRate: 0,
  };

  const downloadReport = async (format: "csv" | "pdf") => {
    const params = new URLSearchParams({
      fromDate: dateRange.from,
      toDate: dateRange.to,
      format,
    });
    if (channel) params.append("channel", channel);
    if (locationId) params.append("locationId", locationId);

    window.open(`/api/v1/reports/export?${params}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Business analytics and performance insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => downloadReport("csv")}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="grid gap-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((p) => ({ ...p, from: e.target.value }))
                }
                className="w-[180px]"
              />
            </div>
            <div className="grid gap-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((p) => ({ ...p, to: e.target.value }))
                }
                className="w-[180px]"
              />
            </div>
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select value={channel || "all"} onValueChange={(v) => setChannel(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="AMAZON">Amazon</SelectItem>
                  <SelectItem value="FLIPKART">Flipkart</SelectItem>
                  <SelectItem value="SHOPIFY">Shopify</SelectItem>
                  <SelectItem value="MYNTRA">Myntra</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Select value={locationId || "all"} onValueChange={(v) => setLocationId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(summary.totalOrders)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.averageOrderValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(summary.deliveryRate)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatPercentage(summary.returnRate)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="logistics">Logistics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Orders by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Orders by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.ordersByStatus || []).map((item) => (
                        <TableRow key={item.status}>
                          <TableCell>{item.status.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Orders by Channel */}
            <Card>
              <CardHeader>
                <CardTitle>Orders by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.ordersByChannel || []).map((item) => (
                        <TableRow key={item.channel}>
                          <TableCell>{item.channel}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Order Trend</CardTitle>
              <CardDescription>Orders and revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.dailyTrend || []).slice(0, 15).map((item) => (
                      <TableRow key={item.date}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.orders)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Products ranked by quantity sold</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.topProducts || []).map((item) => (
                      <TableRow key={item.sku}>
                        <TableCell className="font-medium">{item.sku}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transporter Performance</CardTitle>
              <CardDescription>
                Delivery metrics by transporter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transporter</TableHead>
                      <TableHead className="text-right">Shipments</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead className="text-right">RTO</TableHead>
                      <TableHead className="text-right">Delivery %</TableHead>
                      <TableHead className="text-right">Avg Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.transporterPerformance || []).map((item) => (
                      <TableRow key={item.transporter}>
                        <TableCell className="font-medium">
                          {item.transporter}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.shipments)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatNumber(item.delivered)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatNumber(item.rto)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercentage(
                            item.shipments > 0
                              ? (item.delivered / item.shipments) * 100
                              : 0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.avgDeliveryDays?.toFixed(1) || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
