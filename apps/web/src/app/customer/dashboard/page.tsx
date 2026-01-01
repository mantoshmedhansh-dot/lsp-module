"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Target,
  Calendar,
} from "lucide-react";

interface DashboardData {
  overview: {
    totalShipments: number;
    activeShipments: number;
    deliveredShipments: number;
    pendingPickup: number;
  };
  sla: {
    adherencePercentage: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    averageTat: string;
    targetSla: number;
  };
  statusBreakdown: Record<string, number>;
  recentActivity: Array<{
    id: string;
    awbNumber: string;
    status: string;
    origin: string;
    destination: string;
    updatedAt: string;
    expectedDeliveryDate: string | null;
  }>;
  monthlyTrends: Array<{
    month: string;
    booked: number;
    delivered: number;
  }>;
  billing: {
    creditLimit: number;
    currentBalance: number;
    availableCredit: number;
  };
}

export default function CustomerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    const token = localStorage.getItem("customer_token");
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch("/api/customer/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const slaStatus = data.sla.adherencePercentage >= data.sla.targetSla ? "good" : "warning";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your shipments and SLA performance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/customer/book"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Package className="h-4 w-4" />
            Book Consignment
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Shipments"
          value={data.overview.totalShipments}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Active Shipments"
          value={data.overview.activeShipments}
          icon={Truck}
          color="amber"
          subtitle="In transit"
        />
        <StatCard
          title="Delivered"
          value={data.overview.deliveredShipments}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pending Pickup"
          value={data.overview.pendingPickup}
          icon={Clock}
          color="purple"
        />
      </div>

      {/* SLA Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Adherence Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">SLA Performance</h2>
              <p className="text-sm text-gray-500">Last 30 days delivery performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-500">Target: {data.sla.targetSla}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div
                className={`text-3xl font-bold ${
                  slaStatus === "good" ? "text-green-600" : "text-amber-600"
                }`}
              >
                {data.sla.adherencePercentage}%
              </div>
              <p className="text-sm text-gray-500 mt-1">SLA Adherence</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {slaStatus === "good" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                )}
                <span
                  className={`text-xs ${
                    slaStatus === "good" ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {slaStatus === "good" ? "On Target" : "Below Target"}
                </span>
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {data.sla.onTimeDeliveries}
              </div>
              <p className="text-sm text-gray-500 mt-1">On-Time</p>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {data.sla.lateDeliveries}
              </div>
              <p className="text-sm text-gray-500 mt-1">Late</p>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {data.sla.averageTat}
              </div>
              <p className="text-sm text-gray-500 mt-1">Avg TAT (Days)</p>
            </div>
          </div>

          {/* SLA Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Current SLA</span>
              <span className="font-medium">{data.sla.adherencePercentage}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  slaStatus === "good" ? "bg-green-500" : "bg-amber-500"
                }`}
                style={{ width: `${data.sla.adherencePercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span className="text-gray-600">Target: {data.sla.targetSla}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Billing Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Credit Limit</span>
              <span className="font-semibold text-gray-900">
                ₹{(data.billing.creditLimit || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Current Balance</span>
              <span className="font-semibold text-red-600">
                ₹{(data.billing.currentBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">Available Credit</span>
              <span className="font-semibold text-green-600">
                ₹{(data.billing.availableCredit || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${
                    data.billing.creditLimit
                      ? (data.billing.currentBalance / data.billing.creditLimit) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {data.billing.creditLimit
                ? Math.round((data.billing.currentBalance / data.billing.creditLimit) * 100)
                : 0}
              % credit utilized
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity & Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Shipments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Shipments</h2>
            <Link
              href="/customer/shipments"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No shipments yet</p>
              <Link
                href="/customer/book"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Book your first consignment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 5).map((shipment) => (
                <Link
                  key={shipment.id}
                  href={`/customer/tracking?awb=${shipment.awbNumber}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {shipment.awbNumber}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {shipment.origin} → {shipment.destination}
                    </p>
                  </div>
                  <StatusBadge status={shipment.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Trends */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Monthly Trends</h2>
          </div>

          <div className="space-y-4">
            {data.monthlyTrends.map((month) => (
              <div key={month.month} className="flex items-center gap-4">
                <span className="w-12 text-sm text-gray-500">{month.month}</span>
                <div className="flex-1">
                  <div className="flex gap-1 h-6">
                    <div
                      className="bg-blue-500 rounded"
                      style={{
                        width: `${
                          month.booked
                            ? (month.booked /
                                Math.max(...data.monthlyTrends.map((m) => m.booked || 1))) *
                              100
                            : 0
                        }%`,
                      }}
                      title={`Booked: ${month.booked}`}
                    />
                    <div
                      className="bg-green-500 rounded"
                      style={{
                        width: `${
                          month.delivered
                            ? (month.delivered /
                                Math.max(...data.monthlyTrends.map((m) => m.booked || 1))) *
                              100
                            : 0
                        }%`,
                      }}
                      title={`Delivered: ${month.delivered}`}
                    />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className="text-sm font-medium text-gray-900">{month.booked}</span>
                  <span className="text-sm text-gray-400"> / </span>
                  <span className="text-sm text-green-600">{month.delivered}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-gray-600">Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-gray-600">Delivered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: any;
  color: "blue" | "green" | "amber" | "purple";
  subtitle?: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    BOOKED: { bg: "bg-gray-100", text: "text-gray-700", label: "Booked" },
    IN_HUB: { bg: "bg-blue-100", text: "text-blue-700", label: "In Hub" },
    IN_TRANSIT: { bg: "bg-amber-100", text: "text-amber-700", label: "In Transit" },
    OUT_FOR_DELIVERY: { bg: "bg-purple-100", text: "text-purple-700", label: "Out for Delivery" },
    DELIVERED: { bg: "bg-green-100", text: "text-green-700", label: "Delivered" },
    WITH_PARTNER: { bg: "bg-cyan-100", text: "text-cyan-700", label: "With Partner" },
    FAILED: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
  };

  const config = statusConfig[status] || statusConfig.BOOKED;

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
