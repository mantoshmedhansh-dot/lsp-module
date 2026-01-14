"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Package,
  FileText,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
  summary: {
    totalOrders: number;
    pendingOrders: number;
    totalSpent: number;
    creditAvailable: number;
    creditLimit: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  pendingQuotations: Array<{
    id: string;
    quotationNumber: string;
    totalAmount: number;
    expiresAt: string;
  }>;
}

export default function B2BDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch("/api/portal/dashboard");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "secondary",
      PROCESSING: "default",
      SHIPPED: "default",
      DELIVERED: "outline",
      CANCELLED: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Mock data for demonstration
  const mockData: DashboardData = data || {
    summary: {
      totalOrders: 156,
      pendingOrders: 3,
      totalSpent: 2450000,
      creditAvailable: 500000,
      creditLimit: 1000000,
    },
    recentOrders: [
      { id: "1", orderNumber: "B2B-2024-0156", status: "SHIPPED", totalAmount: 45000, createdAt: "2024-01-14" },
      { id: "2", orderNumber: "B2B-2024-0155", status: "DELIVERED", totalAmount: 72000, createdAt: "2024-01-12" },
      { id: "3", orderNumber: "B2B-2024-0154", status: "PROCESSING", totalAmount: 38500, createdAt: "2024-01-10" },
    ],
    pendingQuotations: [
      { id: "1", quotationNumber: "QT-2024-0089", totalAmount: 125000, expiresAt: "2024-01-20" },
      { id: "2", quotationNumber: "QT-2024-0088", totalAmount: 85000, expiresAt: "2024-01-18" },
    ],
  };

  const creditUsedPercent = ((mockData.summary.creditLimit - mockData.summary.creditAvailable) / mockData.summary.creditLimit) * 100;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome to Your B2B Portal</h1>
        <p className="text-blue-100 mt-1">
          Manage your orders, quotations, and account in one place
        </p>
        <div className="mt-4 flex gap-3">
          <Button asChild variant="secondary">
            <Link href="/portal/catalog">
              <Package className="h-4 w-4 mr-2" />
              Browse Catalog
            </Link>
          </Button>
          <Button asChild variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
            <Link href="/portal/quotations/new">
              <FileText className="h-4 w-4 mr-2" />
              Request Quote
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.summary.totalOrders}</div>
            <p className="text-xs text-gray-500 mt-1">
              {mockData.summary.pendingOrders} pending delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Spent
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockData.summary.totalSpent.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">Lifetime purchases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Credit Available
            </CardTitle>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockData.summary.creditAvailable.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Used</span>
                <span>{creditUsedPercent.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${creditUsedPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending Quotes
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.pendingQuotations.length}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting your approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders & Pending Quotations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/orders">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockData.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-sm text-gray-500">{order.createdAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {order.totalAmount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </p>
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Quotations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Quotations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/quotations">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {mockData.pendingQuotations.length > 0 ? (
              <div className="space-y-4">
                {mockData.pendingQuotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div>
                      <Link
                        href={`/portal/quotations/${quote.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {quote.quotationNumber}
                      </Link>
                      <p className="text-sm text-amber-700 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires: {quote.expiresAt}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {quote.totalAmount.toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                        })}
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/portal/quotations/${quote.id}`}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No pending quotations</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/portal/quotations/new">Request a new quote</Link>
                </Button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/portal/catalog">
                <Package className="h-6 w-6 mb-2" />
                <span>Browse Products</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/portal/quotations/new">
                <FileText className="h-6 w-6 mb-2" />
                <span>Request Quote</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/portal/orders">
                <ShoppingCart className="h-6 w-6 mb-2" />
                <span>Track Orders</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" asChild>
              <Link href="/portal/account/credit">
                <CreditCard className="h-6 w-6 mb-2" />
                <span>View Credit</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
