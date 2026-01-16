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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Boxes,
  RefreshCw,
  Download,
  Archive,
} from "lucide-react";

export default function InventoryReportsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["inventory-reports"],
    queryFn: async () => {
      const res = await fetch("/api/v1/reports?type=inventory");
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const summary = data?.inventorySummary || {
    totalSkus: 0,
    totalValue: 0,
    lowStockSkus: 0,
    outOfStockSkus: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Reports</h1>
          <p className="text-muted-foreground">
            Stock levels, aging analysis, and inventory health
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalSkus)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatNumber(summary.lowStockSkus)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatNumber(summary.outOfStockSkus)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Levels by Location */}
      <Card>
        <CardHeader>
          <CardTitle>Stock by Location</CardTitle>
          <CardDescription>Inventory distribution across warehouses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.stockByLocation || []).map((item: { location: string; skuCount: number; totalUnits: number; value: number; utilization: number }) => (
                  <TableRow key={item.location}>
                    <TableCell className="font-medium">{item.location}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.skuCount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.totalUnits)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.utilization > 80 ? "destructive" : item.utilization > 60 ? "default" : "secondary"}>
                        {item.utilization}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Aging Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Aging</CardTitle>
          <CardDescription>Stock age distribution</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Age Bucket</TableHead>
                  <TableHead className="text-right">SKUs</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.agingAnalysis || [
                  { bucket: "0-30 days", skus: 0, units: 0, value: 0, percentage: 0 },
                  { bucket: "31-60 days", skus: 0, units: 0, value: 0, percentage: 0 },
                  { bucket: "61-90 days", skus: 0, units: 0, value: 0, percentage: 0 },
                  { bucket: "90+ days", skus: 0, units: 0, value: 0, percentage: 0 },
                ]).map((item: { bucket: string; skus: number; units: number; value: number; percentage: number }) => (
                  <TableRow key={item.bucket}>
                    <TableCell className="font-medium">{item.bucket}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.skus)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.units)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                    <TableCell className="text-right">{item.percentage}%</TableCell>
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
