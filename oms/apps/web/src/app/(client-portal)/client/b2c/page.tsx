"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  Plus,
  Upload,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  ArrowRight,
  FileText,
} from "lucide-react";

interface B2CStats {
  shipmentsToday: number;
  inTransit: number;
  delivered: number;
  ndrPending: number;
  codPending: number;
  rtoInitiated: number;
}

interface RecentShipment {
  id: string;
  awb: string;
  consignee: string;
  destination: string;
  status: string;
  createdAt: string;
}

export default function B2CCourierDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<B2CStats>({
    shipmentsToday: 0,
    inTransit: 0,
    delivered: 0,
    ndrPending: 0,
    codPending: 0,
    rtoInitiated: 0,
  });
  const [recentShipments, setRecentShipments] = useState<RecentShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch shipment stats
      const [statsRes, shipmentsRes] = await Promise.all([
        fetch("/api/v1/logistics/stats"),
        fetch("/api/v1/deliveries?limit=5&sort=-createdAt"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          shipmentsToday: statsData.shipmentsToday || 0,
          inTransit: statsData.inTransit || 0,
          delivered: statsData.delivered || 0,
          ndrPending: statsData.ndrPending || 0,
          codPending: statsData.codPending || 0,
          rtoInitiated: statsData.rtoInitiated || 0,
        });
      }

      if (shipmentsRes.ok) {
        const shipmentsData = await shipmentsRes.json();
        const shipments = Array.isArray(shipmentsData) ? shipmentsData : shipmentsData.items || [];
        setRecentShipments(shipments.slice(0, 5).map((s: any) => ({
          id: s.id,
          awb: s.awbNumber || s.trackingNumber || "Pending",
          consignee: s.consigneeName || s.customerName || "N/A",
          destination: s.destination || s.city || "N/A",
          status: s.status || "PENDING",
          createdAt: s.createdAt,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Shipments Today",
      value: stats.shipmentsToday,
      icon: Package,
      color: "bg-blue-500",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "In Transit",
      value: stats.inTransit,
      icon: Truck,
      color: "bg-amber-500",
    },
    {
      title: "Delivered",
      value: stats.delivered,
      icon: CheckCircle,
      color: "bg-green-500",
      trend: "+8%",
      trendUp: true,
    },
    {
      title: "NDR Pending",
      value: stats.ndrPending,
      icon: AlertTriangle,
      color: "bg-red-500",
      highlight: stats.ndrPending > 0,
    },
    {
      title: "COD Pending",
      value: stats.codPending,
      icon: IndianRupee,
      color: "bg-purple-500",
    },
    {
      title: "RTO Initiated",
      value: stats.rtoInitiated,
      icon: TrendingDown,
      color: "bg-orange-500",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: "bg-green-100 text-green-700",
      IN_TRANSIT: "bg-blue-100 text-blue-700",
      OUT_FOR_DELIVERY: "bg-amber-100 text-amber-700",
      NDR: "bg-red-100 text-red-700",
      RTO: "bg-orange-100 text-orange-700",
      PENDING: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B2C Courier Dashboard</h1>
          <p className="text-gray-500">Manage your parcel shipments and deliveries</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => router.push("/client/b2c/shipments/bulk")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => router.push("/client/b2c/shipments/new")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Shipment
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className={`bg-white rounded-lg border p-4 ${
              stat.highlight ? "ring-2 ring-red-500 ring-opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              {stat.trend && (
                <span className={`text-xs font-medium ${stat.trendUp ? "text-green-600" : "text-red-600"}`}>
                  {stat.trendUp ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                  {" "}{stat.trend}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{isLoading ? "-" : stat.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => router.push("/client/b2c/shipments")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-100 rounded-lg">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">All Shipments</p>
            <p className="text-sm text-gray-500">Track & manage</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/control-tower/ndr")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-red-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">NDR Management</p>
            <p className="text-sm text-gray-500">{stats.ndrPending} pending</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/finance/cod-reconciliation")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-purple-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-100 rounded-lg">
            <IndianRupee className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">COD Remittance</p>
            <p className="text-sm text-gray-500">View pending</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/b2c/pickup-addresses")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-green-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-green-100 rounded-lg">
            <MapPin className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">Pickup Addresses</p>
            <p className="text-sm text-gray-500">Manage locations</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>
      </div>

      {/* Recent Shipments & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Shipments */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent Shipments</h2>
            <button
              onClick={() => router.push("/client/b2c/shipments")}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : recentShipments.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No shipments yet</p>
                <button
                  onClick={() => router.push("/client/b2c/shipments/new")}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  Create your first shipment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => router.push(`/client/b2c/shipments?awb=${shipment.awb}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded border">
                        <Package className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{shipment.awb}</p>
                        <p className="text-xs text-gray-500">{shipment.consignee}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(shipment.status)}`}>
                        {shipment.status.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{shipment.destination}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Performance */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Delivery Performance (Last 7 Days)</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">On-Time Delivery</span>
                  <span className="text-sm font-medium">85%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-green-500 rounded-full" style={{ width: "85%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">First Attempt Delivery</span>
                  <span className="text-sm font-medium">72%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: "72%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">RTO Rate</span>
                  <span className="text-sm font-medium text-red-600">8%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-red-500 rounded-full" style={{ width: "8%" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">NDR Resolution</span>
                  <span className="text-sm font-medium">68%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-amber-500 rounded-full" style={{ width: "68%" }} />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">2.1</p>
                <p className="text-xs text-gray-500">Avg. Days to Deliver</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">1.3</p>
                <p className="text-xs text-gray-500">Avg. Attempts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">4.2</p>
                <p className="text-xs text-gray-500">Avg. Rating</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">Need Help?</p>
              <p className="text-sm text-blue-600">View shipping guidelines, rate card, or raise a support ticket</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/client/logistics/rate-cards")}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-50"
            >
              View Rate Card
            </button>
            <button
              onClick={() => router.push("/client/finance/weight-discrepancy")}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-50"
            >
              Weight Disputes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
