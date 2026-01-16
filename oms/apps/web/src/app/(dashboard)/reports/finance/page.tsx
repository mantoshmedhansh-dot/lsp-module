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
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import {
  IndianRupee,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  FileText,
  Wallet,
} from "lucide-react";

export default function FinanceReportsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["finance-reports", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to,
        type: "finance",
      });
      const res = await fetch(`/api/v1/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const summary = data?.financeSummary || {
    totalRevenue: 0,
    totalCod: 0,
    codCollected: 0,
    codPending: 0,
    freightCost: 0,
    grossMargin: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Reports</h1>
          <p className="text-muted-foreground">
            Revenue, COD reconciliation, and financial analytics
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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
            <CardTitle className="text-sm font-medium">COD Amount</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCod)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COD Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.codCollected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COD Pending</CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(summary.codPending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Freight Cost</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.freightCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.grossMargin)}</div>
          </CardContent>
        </Card>
      </div>

      {/* COD by Carrier */}
      <Card>
        <CardHeader>
          <CardTitle>COD by Carrier</CardTitle>
          <CardDescription>COD collection status by transporter</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Total COD</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Collection %</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.codByCarrier || []).map((item: { carrier: string; totalCod: number; collected: number; pending: number }) => {
                  const rate = item.totalCod > 0 ? (item.collected / item.totalCod) * 100 : 0;
                  return (
                    <TableRow key={item.carrier}>
                      <TableCell className="font-medium">{item.carrier}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalCod)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(item.collected)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatCurrency(item.pending)}</TableCell>
                      <TableCell className="text-right">{rate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rate >= 95 ? "default" : rate >= 80 ? "secondary" : "destructive"}>
                          {rate >= 95 ? "Good" : rate >= 80 ? "Average" : "Action Required"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
          <CardDescription>Financial performance by month</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Freight Cost</TableHead>
                  <TableHead className="text-right">Gross Margin</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.monthlyFinance || []).map((item: { month: string; revenue: number; orders: number; freightCost: number; grossMargin: number }) => {
                  const marginPercent = item.revenue > 0 ? (item.grossMargin / item.revenue) * 100 : 0;
                  return (
                    <TableRow key={item.month}>
                      <TableCell className="font-medium">{item.month}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.orders)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.freightCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.grossMargin)}</TableCell>
                      <TableCell className="text-right">{marginPercent.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
