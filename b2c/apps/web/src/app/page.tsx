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
  MapPin,
  ArrowRight,
  FileText,
  Menu,
  X,
  Home,
  Settings,
  BarChart3,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch shipment stats from B2C Courier API
      const [statsRes, shipmentsRes] = await Promise.all([
        fetch("/api/v1/shipments/stats"),
        fetch("/api/v1/shipments?limit=5"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          shipmentsToday: statsData.total || 0,
          inTransit: statsData.inTransit || 0,
          delivered: statsData.delivered || 0,
          ndrPending: statsData.ndr || 0,
          codPending: Number(statsData.codPending) || 0,
          rtoInitiated: statsData.rto || 0,
        });
      }

      if (shipmentsRes.ok) {
        const shipmentsData = await shipmentsRes.json();
        const shipments = Array.isArray(shipmentsData) ? shipmentsData : shipmentsData.items || [];
        setRecentShipments(shipments.slice(0, 5).map((s: any) => ({
          id: s.id,
          awb: s.awbNo || s.shipmentNo || "Pending",
          consignee: s.consigneeName || "N/A",
          destination: s.deliveryAddress?.city || "N/A",
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

  const navigation = [
    { name: "Dashboard", href: "/", icon: Home, current: true },
    { name: "Shipments", href: "/shipments", icon: Package, current: false },
    { name: "NDR Management", href: "/ndr", icon: AlertTriangle, current: false },
    { name: "Pickup Addresses", href: "/pickup-addresses", icon: MapPin, current: false },
    { name: "Finance", href: "/finance", icon: IndianRupee, current: false },
    { name: "Reports", href: "/reports", icon: BarChart3, current: false },
    { name: "Settings", href: "/settings", icon: Settings, current: false },
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "" : "hidden"}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <span className="text-xl font-bold text-green-600">CJDQuick B2C</span>
            <button onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  item.current ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r">
          <div className="flex h-16 items-center px-6 border-b">
            <span className="text-xl font-bold text-green-600">CJDQuick B2C</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  item.current ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 sm:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">B2C Courier Portal</span>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 space-y-6">
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
                onClick={() => router.push("/shipments/bulk")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Bulk Upload
              </button>
              <button
                onClick={() => router.push("/shipments/new")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
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
              onClick={() => router.push("/shipments")}
              className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-green-500 hover:shadow-md transition-all"
            >
              <div className="p-3 bg-green-100 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">All Shipments</p>
                <p className="text-sm text-gray-500">Track & manage</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
            </button>

            <button
              onClick={() => router.push("/ndr")}
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
              onClick={() => router.push("/finance/cod")}
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
              onClick={() => router.push("/pickup-addresses")}
              className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="p-3 bg-blue-100 rounded-lg">
                <MapPin className="h-6 w-6 text-blue-600" />
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
                  onClick={() => router.push("/shipments")}
                  className="text-sm text-green-600 hover:text-green-700"
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
                      onClick={() => router.push("/shipments/new")}
                      className="mt-3 text-sm text-green-600 hover:text-green-700"
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
                        onClick={() => router.push(`/shipments?awb=${shipment.awb}`)}
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
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Need Help?</p>
                  <p className="text-sm text-green-600">View shipping guidelines, rate card, or raise a support ticket</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/rate-cards")}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-white rounded-lg border border-green-200 hover:bg-green-50"
                >
                  View Rate Card
                </button>
                <button
                  onClick={() => router.push("/finance/weight-discrepancy")}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-white rounded-lg border border-green-200 hover:bg-green-50"
                >
                  Weight Disputes
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
