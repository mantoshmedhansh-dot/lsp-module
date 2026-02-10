"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  Eye,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

interface CODReconciliation {
  id: string;
  reconciliationNo: string;
  status: string;
  reconciliationDate: string;
  expectedAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  transporter?: { id: string; name: string; code: string };
  _count?: { transactions: number };
  createdAt: string;
}

export default function FinanceDashboardPage() {
  // Fetch COD reconciliation stats
  const { data: codData, isLoading: codLoading } = useQuery({
    queryKey: ["finance-cod-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/finance/cod-reconciliations/count");
      if (!res.ok) throw new Error("Failed to fetch COD stats");
      return res.json();
    },
  });

  // Fetch order count for revenue estimation
  const { data: ordersData } = useQuery({
    queryKey: ["finance-orders-count"],
    queryFn: async () => {
      const res = await fetch("/api/v1/orders?limit=1");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  // Fetch shipment count
  const { data: shipmentsData } = useQuery({
    queryKey: ["finance-shipments-count"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?limit=1");
      if (!res.ok) throw new Error("Failed to fetch shipments");
      return res.json();
    },
  });

  // Fetch recent COD reconciliations
  const { data: recentRecData, isLoading: recentLoading, refetch } = useQuery({
    queryKey: ["finance-recent-reconciliations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/finance/cod-reconciliations?limit=5");
      if (!res.ok) throw new Error("Failed to fetch recent reconciliations");
      return res.json();
    },
  });

  // Normalize COD stats
  const codStats = codData || {};
  const totalExpected = codStats.totalExpected || codStats.total_expected || 0;
  const totalReceived = codStats.totalReceived || codStats.total_received || 0;
  const totalReconciled = codStats.reconciled || codStats.totalReconciled || 0;
  const totalPending = codStats.pending || codStats.totalPending || 0;

  // Normalize order/shipment counts
  const orderCount = ordersData?.total || ordersData?.count || 0;
  const shipmentCount = shipmentsData?.total || shipmentsData?.count || 0;

  // Normalize recent reconciliations
  const recentReconciliations: CODReconciliation[] = Array.isArray(recentRecData)
    ? recentRecData
    : recentRecData?.items || recentRecData?.data || [];

  const stats = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalExpected),
      subtitle: `${orderCount} orders / ${shipmentCount} shipments`,
      icon: IndianRupee,
      color: "text-green-600",
    },
    {
      title: "COD Outstanding",
      value: formatCurrency(totalExpected - totalReceived),
      subtitle: "Pending collection",
      icon: Clock,
      color: "text-orange-600",
    },
    {
      title: "Reconciled",
      value: formatCurrency(totalReconciled),
      subtitle: "Successfully reconciled",
      icon: CheckCircle,
      color: "text-blue-600",
    },
    {
      title: "Pending",
      value: formatCurrency(totalPending),
      subtitle: "Awaiting reconciliation",
      icon: AlertTriangle,
      color: "text-yellow-600",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    RECONCILED: "bg-green-100 text-green-800",
    DISPUTED: "bg-red-100 text-red-800",
    CLOSED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of COD, reconciliation, and financial metrics
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {codLoading ? "..." : stat.value}
              </div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/cod-reconciliation">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                COD Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {codLoading ? "..." : formatCurrency(totalExpected - totalReceived)}
              </p>
              <p className="text-sm text-muted-foreground">Pending reconciliation</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/weight-discrepancy">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Weight Discrepancies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{shipmentCount}</p>
              <p className="text-sm text-muted-foreground">Shipments to review</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/freight-billing">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Freight Billing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{shipmentCount}</p>
              <p className="text-sm text-muted-foreground">Shipments billed</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent COD Reconciliations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent COD Reconciliations</CardTitle>
              <CardDescription>Latest reconciliation activities</CardDescription>
            </div>
            <Link href="/finance/cod-reconciliation">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : recentReconciliations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <IndianRupee className="h-12 w-12 mb-4" />
              <p>No reconciliations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reconciliation No</TableHead>
                  <TableHead>Transporter</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReconciliations.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-mono font-medium">
                      {rec.reconciliationNo}
                    </TableCell>
                    <TableCell>{rec.transporter?.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(rec.reconciliationDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(rec.expectedAmount)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(rec.receivedAmount)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        rec.differenceAmount < 0
                          ? "text-red-600"
                          : rec.differenceAmount > 0
                          ? "text-green-600"
                          : ""
                      }`}
                    >
                      {formatCurrency(rec.differenceAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[rec.status] || "bg-gray-100 text-gray-800"}>
                        {rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/finance/cod-reconciliation/${rec.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
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
