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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatCurrency, formatNumber } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingCart,
  RefreshCw,
  Download,
  Users,
  Package,
} from "lucide-react";

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sales-reports", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to,
        type: "sales",
      });
      const res = await fetch(`/api/v1/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const summary = data?.summary || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    newCustomers: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Reports</h1>
          <p className="text-muted-foreground">
            Revenue, orders, and sales performance analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="grid gap-2">
              <Label>From</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>To</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalOrders)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.averageOrderValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.newCustomers || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Channel */}
      <Card>
        <CardHeader>
          <CardTitle>Sales by Channel</CardTitle>
          <CardDescription>Revenue breakdown by sales channel</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.ordersByChannel || []).map((item: { channel: string; count: number; value: number }) => (
                  <TableRow key={item.channel}>
                    <TableCell className="font-medium">{item.channel}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.count)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.count > 0 ? item.value / item.count : 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>Products ranked by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.topProducts || []).map((item: { sku: string; name: string; quantity: number; revenue: number }) => (
                  <TableRow key={item.sku}>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
