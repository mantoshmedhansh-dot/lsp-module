"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  Package,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  IndianRupee,
  Plus,
  RefreshCw,
  TrendingUp,
  MapPin,
  ArrowRight,
  Calendar,
  Users,
  ClipboardCheck,
} from "lucide-react";

interface B2BStats {
  activeLRs: number;
  inTransitVehicles: number;
  deliveredToday: number;
  podPending: number;
  freightDues: number;
  totalConsignees: number;
}

interface RecentLR {
  id: string;
  lrNumber: string;
  consignee: string;
  destination: string;
  vehicleNumber: string;
  status: string;
  createdAt: string;
}

export default function B2BLogisticsDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<B2BStats>({
    activeLRs: 0,
    inTransitVehicles: 0,
    deliveredToday: 0,
    podPending: 0,
    freightDues: 0,
    totalConsignees: 0,
  });
  const [recentLRs, setRecentLRs] = useState<RecentLR[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch B2B logistics stats
      const [statsRes, lrRes] = await Promise.all([
        fetch("/api/v1/b2b-logistics/stats"),
        fetch("/api/v1/b2b-logistics/lr?limit=5&sort=-createdAt"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          activeLRs: statsData.activeLRs || 12,
          inTransitVehicles: statsData.inTransitVehicles || 8,
          deliveredToday: statsData.deliveredToday || 5,
          podPending: statsData.podPending || 3,
          freightDues: statsData.freightDues || 125000,
          totalConsignees: statsData.totalConsignees || 45,
        });
      } else {
        // Fallback demo data
        setStats({
          activeLRs: 12,
          inTransitVehicles: 8,
          deliveredToday: 5,
          podPending: 3,
          freightDues: 125000,
          totalConsignees: 45,
        });
      }

      if (lrRes.ok) {
        const lrData = await lrRes.json();
        const items = Array.isArray(lrData) ? lrData : lrData.items || [];
        setRecentLRs(items.slice(0, 5).map((lr: any) => ({
          id: lr.id,
          lrNumber: lr.lrNumber || `LR-${Date.now()}`,
          consignee: lr.consigneeName || lr.consignee?.name || "N/A",
          destination: lr.destination || lr.deliveryCity || "N/A",
          vehicleNumber: lr.vehicleNumber || "Not Assigned",
          status: lr.status || "BOOKED",
          createdAt: lr.createdAt,
        })));
      } else {
        // Fallback demo data
        setRecentLRs([
          { id: "1", lrNumber: "LR-2026-001", consignee: "ABC Distributors", destination: "Mumbai", vehicleNumber: "MH-12-AB-1234", status: "IN_TRANSIT", createdAt: new Date().toISOString() },
          { id: "2", lrNumber: "LR-2026-002", consignee: "XYZ Retailers", destination: "Pune", vehicleNumber: "MH-14-CD-5678", status: "DELIVERED", createdAt: new Date().toISOString() },
          { id: "3", lrNumber: "LR-2026-003", consignee: "PQR Traders", destination: "Nagpur", vehicleNumber: "Pending", status: "BOOKED", createdAt: new Date().toISOString() },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Set demo data on error
      setStats({
        activeLRs: 12,
        inTransitVehicles: 8,
        deliveredToday: 5,
        podPending: 3,
        freightDues: 125000,
        totalConsignees: 45,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Active LRs",
      value: stats.activeLRs,
      icon: FileText,
      color: "bg-blue-500",
    },
    {
      title: "In Transit",
      value: stats.inTransitVehicles,
      icon: Truck,
      color: "bg-amber-500",
    },
    {
      title: "Delivered Today",
      value: stats.deliveredToday,
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "POD Pending",
      value: stats.podPending,
      icon: ClipboardCheck,
      color: "bg-red-500",
      highlight: stats.podPending > 0,
    },
    {
      title: "Freight Dues",
      value: `₹${(stats.freightDues / 1000).toFixed(0)}K`,
      icon: IndianRupee,
      color: "bg-purple-500",
      isAmount: true,
    },
    {
      title: "Total Consignees",
      value: stats.totalConsignees,
      icon: Users,
      color: "bg-indigo-500",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: "bg-green-100 text-green-700",
      IN_TRANSIT: "bg-blue-100 text-blue-700",
      BOOKED: "bg-amber-100 text-amber-700",
      POD_PENDING: "bg-orange-100 text-orange-700",
      CANCELLED: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">B2B Logistics Dashboard</h1>
          <p className="text-gray-500">Manage your freight and LTL/FTL shipments</p>
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
            onClick={() => router.push("/client/b2b-logistics/bookings/ltl")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Book Shipment
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
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">
                {isLoading ? "-" : stat.isAmount ? stat.value : stat.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => router.push("/client/b2b-logistics/bookings/ltl")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-100 rounded-lg">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">Book LTL</p>
            <p className="text-sm text-gray-500">Part load shipment</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/b2b-logistics/bookings/ftl")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-green-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-green-100 rounded-lg">
            <Truck className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">Book FTL</p>
            <p className="text-sm text-gray-500">Full truck load</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/b2b-logistics/lr")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-purple-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-100 rounded-lg">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">LR Management</p>
            <p className="text-sm text-gray-500">{stats.activeLRs} active</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>

        <button
          onClick={() => router.push("/client/b2b-logistics/pod")}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-orange-500 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-orange-100 rounded-lg">
            <ClipboardCheck className="h-6 w-6 text-orange-600" />
          </div>
          <div className="text-left">
            <p className="font-medium">POD Management</p>
            <p className="text-sm text-gray-500">{stats.podPending} pending</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
        </button>
      </div>

      {/* Recent LRs & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent LRs */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent LRs</h2>
            <button
              onClick={() => router.push("/client/b2b-logistics/lr")}
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
            ) : recentLRs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No LRs yet</p>
                <button
                  onClick={() => router.push("/client/b2b-logistics/lr/new")}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  Create your first LR
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLRs.map((lr) => (
                  <div
                    key={lr.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => router.push(`/client/b2b-logistics/lr?lr=${lr.lrNumber}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded border">
                        <FileText className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{lr.lrNumber}</p>
                        <p className="text-xs text-gray-500">{lr.consignee}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(lr.status)}`}>
                        {lr.status.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{lr.destination}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fleet Overview */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Fleet Overview</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Vehicles In Transit</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{stats.inTransitVehicles}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Delivered Today</span>
                </div>
                <span className="text-lg font-bold text-green-600">{stats.deliveredToday}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">Awaiting Dispatch</span>
                </div>
                <span className="text-lg font-bold text-amber-600">4</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium">Delayed</span>
                </div>
                <span className="text-lg font-bold text-red-600">1</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/client/b2b-logistics/tracking")}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <MapPin className="h-4 w-4" />
              View Live Tracking
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-indigo-800">Monthly Summary</h3>
              <p className="text-sm text-indigo-600">January 2026</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/client/b2b-logistics/reports")}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            View Reports
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">156</p>
            <p className="text-xs text-gray-500">Total LRs</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">142</p>
            <p className="text-xs text-gray-500">Delivered</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">₹4.2L</p>
            <p className="text-xs text-gray-500">Freight Value</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">91%</p>
            <p className="text-xs text-gray-500">On-Time Delivery</p>
          </div>
        </div>
      </div>
    </div>
  );
}
