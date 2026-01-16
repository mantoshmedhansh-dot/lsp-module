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
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercentage } from "@/lib/utils";
import {
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  MapPin,
} from "lucide-react";

export default function LogisticsReportsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logistics-reports", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to,
        type: "logistics",
      });
      const res = await fetch(`/api/v1/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const summary = data?.logisticsSummary || {
    totalShipments: 0,
    delivered: 0,
    inTransit: 0,
    rto: 0,
    avgDeliveryDays: 0,
  };

  const deliveryRate = summary.totalShipments > 0
    ? (summary.delivered / summary.totalShipments) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics Reports</h1>
          <p className="text-muted-foreground">
            Shipping performance, carrier metrics, and delivery analytics
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalShipments)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(summary.delivered)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatNumber(summary.inTransit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RTO</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatNumber(summary.rto)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgDeliveryDays?.toFixed(1) || 0} days</div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Delivery Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Delivery Success Rate</span>
              <span className="font-bold">{formatPercentage(deliveryRate)}</span>
            </div>
            <Progress value={deliveryRate} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Carrier Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Carrier Performance</CardTitle>
          <CardDescription>Delivery metrics by transporter</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">RTO</TableHead>
                  <TableHead className="text-right">Delivery %</TableHead>
                  <TableHead className="text-right">Avg Days</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.transporterPerformance || []).map((item: { transporter: string; shipments: number; delivered: number; rto: number; avgDeliveryDays: number }) => {
                  const rate = item.shipments > 0 ? (item.delivered / item.shipments) * 100 : 0;
                  return (
                    <TableRow key={item.transporter}>
                      <TableCell className="font-medium">{item.transporter}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.shipments)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatNumber(item.delivered)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatNumber(item.rto)}</TableCell>
                      <TableCell className="text-right">{formatPercentage(rate)}</TableCell>
                      <TableCell className="text-right">{item.avgDeliveryDays?.toFixed(1) || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rate >= 95 ? "default" : rate >= 85 ? "secondary" : "destructive"}>
                          {rate >= 95 ? "Excellent" : rate >= 85 ? "Good" : "Poor"}
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

      {/* Zone-wise Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Zone-wise Performance</CardTitle>
          <CardDescription>Delivery metrics by region</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">RTO Rate</TableHead>
                  <TableHead className="text-right">Avg TAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.zonePerformance || [
                  { zone: "Metro", shipments: 0, delivered: 0, rtoRate: 0, avgTat: 0 },
                  { zone: "Tier 1", shipments: 0, delivered: 0, rtoRate: 0, avgTat: 0 },
                  { zone: "Tier 2", shipments: 0, delivered: 0, rtoRate: 0, avgTat: 0 },
                  { zone: "Remote", shipments: 0, delivered: 0, rtoRate: 0, avgTat: 0 },
                ]).map((item: { zone: string; shipments: number; delivered: number; rtoRate: number; avgTat: number }) => (
                  <TableRow key={item.zone}>
                    <TableCell className="font-medium">{item.zone}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.shipments)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.delivered)}</TableCell>
                    <TableCell className="text-right">{formatPercentage(item.rtoRate)}</TableCell>
                    <TableCell className="text-right">{item.avgTat?.toFixed(1) || "-"} days</TableCell>
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
