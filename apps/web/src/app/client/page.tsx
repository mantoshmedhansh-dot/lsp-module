"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Truck,
  AlertTriangle,
  Clock,
  Plus,
  FileText,
  Calculator,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface DashboardStats {
  awaitingPickup: number;
  inTransit: number;
  exceptions: number;
  delivered: number;
  deliveredToday: number;
  totalOrders: number;
}

interface UpcomingPickup {
  id: string;
  pickupNumber: string;
  warehouseName: string;
  requestedDate: string;
  expectedAwbs: number;
  status: string;
}

async function fetchDashboardStats(): Promise<{ data: DashboardStats }> {
  const res = await fetch("/api/client/dashboard/stats");
  return res.json();
}

async function fetchUpcomingPickups(): Promise<{ data: UpcomingPickup[] }> {
  const res = await fetch("/api/client/pickups?status=SCHEDULED&limit=5");
  return res.json();
}

export default function ClientDashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["client-dashboard-stats"],
    queryFn: fetchDashboardStats,
  });

  const { data: pickupsData, isLoading: pickupsLoading } = useQuery({
    queryKey: ["client-upcoming-pickups"],
    queryFn: fetchUpcomingPickups,
  });

  const stats = statsData?.data || {
    awaitingPickup: 0,
    inTransit: 0,
    exceptions: 0,
    delivered: 0,
    deliveredToday: 0,
    totalOrders: 0,
  };

  const upcomingPickups = pickupsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Actions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Link
                href="/client/orders?status=AWAITING_PICKUP"
                className="text-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="text-3xl font-bold text-amber-600">
                  {statsLoading ? "-" : stats.awaitingPickup}
                </p>
                <p className="text-sm text-gray-500 mt-1">Awaiting Pickup</p>
                <p className="text-xs text-primary-600 mt-2">View &rarr;</p>
              </Link>
              <Link
                href="/client/orders?status=IN_TRANSIT"
                className="text-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="text-3xl font-bold text-blue-600">
                  {statsLoading ? "-" : stats.inTransit}
                </p>
                <p className="text-sm text-gray-500 mt-1">In Transit</p>
                <p className="text-xs text-primary-600 mt-2">View &rarr;</p>
              </Link>
              <Link
                href="/client/exceptions"
                className="text-center p-4 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="text-3xl font-bold text-red-600">
                  {statsLoading ? "-" : stats.exceptions}
                </p>
                <p className="text-sm text-gray-500 mt-1">Exceptions</p>
                <p className="text-xs text-primary-600 mt-2">Act Now &rarr;</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/client/orders/new"
                className="flex flex-col items-center p-4 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
                  <Plus className="h-6 w-6 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  Create New Order
                </span>
              </Link>
              <Link
                href="/client/pickups/new"
                className="flex flex-col items-center p-4 border rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-2">
                  <Truck className="h-6 w-6 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  Create New Pickup
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/client/rate-calculator"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:border-primary-300 transition-colors"
        >
          <Calculator className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Rate Calculator</span>
        </Link>
        <Link
          href="/client/support"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:border-primary-300 transition-colors"
        >
          <FileText className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Knowledge Base</span>
        </Link>
        <Link
          href="/client/billing"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:border-primary-300 transition-colors"
        >
          <FileText className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">View Invoices</span>
        </Link>
        <Link
          href="/client/support/new"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:border-primary-300 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Raise Ticket</span>
        </Link>
      </div>

      {/* Upcoming Pickups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary-600" />
            Upcoming Pickups
          </CardTitle>
          <Link href="/client/pickups">
            <Button variant="ghost" size="sm">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pickupsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : upcomingPickups.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No upcoming pickups scheduled</p>
              <Link href="/client/pickups/new">
                <Button variant="outline" className="mt-4">
                  Schedule a Pickup
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingPickups.map((pickup) => (
                <div
                  key={pickup.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                      <Truck className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {pickup.warehouseName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(pickup.requestedDate).toLocaleDateString()} &bull;{" "}
                        {pickup.expectedAwbs} AWBs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={pickup.status === "SCHEDULED" ? "info" : "warning"}
                      size="sm"
                    >
                      {pickup.status === "SCHEDULED" ? "Scheduled" : "Out for Pickup"}
                    </Badge>
                    <Link href={`/client/pickups/${pickup.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-4 p-3 bg-blue-50 rounded-lg">
            Pickup will be attempted during the selected Pickup Slot. Check guidelines
            to keep your shipment ready for pickup.
          </p>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? "-" : stats.deliveredToday}
              </p>
              <p className="text-sm text-gray-500">Delivered Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? "-" : stats.totalOrders}
              </p>
              <p className="text-sm text-gray-500">Total Orders (30d)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? "-" : stats.delivered}
              </p>
              <p className="text-sm text-gray-500">Delivered (30d)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading
                  ? "-"
                  : stats.totalOrders > 0
                  ? ((stats.exceptions / stats.totalOrders) * 100).toFixed(1) + "%"
                  : "0%"}
              </p>
              <p className="text-sm text-gray-500">Exception Rate</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
