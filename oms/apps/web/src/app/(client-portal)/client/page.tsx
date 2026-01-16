"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
} from "lucide-react";

interface DashboardStats {
  sales: {
    totalOrders: number;
    totalOrderLines: number;
    totalOrderQuantity: number;
    distinctSkuSold: number;
    avgLinesPerOrder: number;
    totalOrderAmount: number;
    avgOrderAmount: number;
    codOrdersPercent: number;
    totalDiscount: number;
    orderQtyPendingStock: number;
    totalPendingOrders: number;
    unfulfillableLineLevel: number;
    totalUnfulfillable: number;
    slaBreachedOrders: number;
    totalFailedOrders: number;
  };
  fulfillment: {
    pendingPicklist: number;
    picklistedPendingPick: number;
    pickedPendingPack: number;
    packedPendingManifest: number;
    manifestedPendingShip: number;
  };
  inventory: {
    totalSaleableQty: number;
    totalDamagedQty: number;
    totalInprocessQty: number;
    distinctSkuInStock: number;
    skuInStockPercent: number;
  };
  returns: {
    totalReturns: number;
    rtoPercent: number;
    returnQty: number;
    returnAmount: number;
    avgReturnDays: number;
  };
}

interface SalesData {
  ordersByDate: { date: string; count: number; amount: number }[];
  ordersByChannel: { channel: string; count: number; amount: number }[];
  ordersByPaymentMode: { paymentMode: string; count: number; amount: number }[];
}

interface FulfillmentData {
  byChannel: { channel: string; pendingPicklist: number; pendingPick: number; pendingPack: number; pendingManifest: number; pendingShip: number; shipByDate: string | null }[];
  byLocation: { location: string; pendingPicklist: number; pendingPick: number; pendingPack: number; pendingManifest: number; pendingShip: number }[];
  shipmentsByDate: { date: string; packed: number; shipped: number }[];
  shipmentsByTransporter: { transporter: string; count: number }[];
}

interface InventoryData {
  inboundByDate: { date: string; quantity: number; skuCount: number }[];
  inventoryByLocation: { location: string; quantity: number; skuCount: number }[];
  inventoryByCategory: { category: string; quantity: number; skuCount: number }[];
  lowStockSkus: { skuCode: string; skuName: string; quantity: number; reorderPoint: number }[];
}

interface ReturnsData {
  returnsByDate: { date: string; count: number; quantity: number }[];
  returnsByReason: { reason: string; count: number }[];
  returnsByType: { type: string; count: number; amount: number }[];
  topReturnedSkus: { skuCode: string; skuName: string; quantity: number }[];
}

// KPI Card Component
function KPICard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  trendValue,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down";
  trendValue?: string;
}) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
    pink: "bg-pink-500",
    yellow: "bg-yellow-500",
    indigo: "bg-indigo-500",
    teal: "bg-teal-500",
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-2xl font-bold mt-1">
            {typeof value === "number" ? value.toLocaleString("en-IN") : value}
          </p>
        </div>
        <div className="opacity-80">
          <Icon className="w-8 h-8" />
        </div>
      </div>
      {trend && trendValue && (
        <div className="mt-2 flex items-center text-sm">
          {trend === "up" ? (
            <TrendingUp className="w-4 h-4 mr-1" />
          ) : (
            <TrendingDown className="w-4 h-4 mr-1" />
          )}
          <span>{trendValue} vs last period</span>
        </div>
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
        active
          ? "bg-white text-blue-600 border-t-2 border-x border-blue-600"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

// Bar Chart Component
function BarChart({
  data,
  labelKey,
  valueKey,
  color = "bg-blue-500",
  height = 200,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Number(d[valueKey]) || 0));

  return (
    <div className="flex items-end space-x-2 h-full" style={{ height }}>
      {data.slice(-14).map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const barHeight = maxValue > 0 ? (value / maxValue) * (height - 40) : 0;
        const label = String(item[labelKey]);

        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="text-xs text-gray-600 mb-1">{value}</div>
            <div
              className={`w-full ${color} rounded-t transition-all duration-300`}
              style={{ height: Math.max(barHeight, 4) }}
              title={`${label}: ${value}`}
            />
            <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left whitespace-nowrap">
              {label.length > 6 ? label.slice(-5) : label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Donut Chart Component
function DonutChart({
  data,
  labelKey,
  valueKey,
  colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  colors?: string[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
  let cumulativePercent = 0;

  const segments = data.map((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const percent = total > 0 ? (value / total) * 100 : 0;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;

    return {
      label: String(item[labelKey]),
      value,
      percent,
      startPercent,
      color: colors[index % colors.length],
    };
  });

  // Create conic gradient
  const gradientStops = segments
    .map((s) => `${s.color} ${s.startPercent}% ${s.startPercent + s.percent}%`)
    .join(", ");

  return (
    <div className="flex items-center justify-center gap-6">
      <div
        className="w-40 h-40 rounded-full relative"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      >
        <div className="absolute inset-6 bg-white rounded-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-600">{s.label}</span>
            <span className="font-medium">({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal Bar Chart Component
function HorizontalBarChart({
  data,
  labelKey,
  valueKey,
  color = "bg-blue-500",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Number(d[valueKey]) || 0));
  const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500", "bg-cyan-500"];

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const label = String(item[labelKey]);

        return (
          <div key={index}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 truncate" style={{ maxWidth: "60%" }}>
                {label}
              </span>
              <span className="font-medium">{value}</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-6">
              <div
                className={`h-6 rounded ${colors[index % colors.length]} transition-all duration-300`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Stacked Bar Chart Component
function StackedBarChart({
  data,
  labelKey,
  keys,
  colors,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  keys: { key: string; label: string }[];
  colors: string[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map((d) => keys.reduce((sum, k) => sum + (Number(d[k.key]) || 0), 0))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs">
        {keys.map((k, i) => (
          <div key={k.key} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${colors[i]}`} />
            <span>{k.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end space-x-2 h-48">
        {data.slice(-10).map((item, index) => {
          const total = keys.reduce((sum, k) => sum + (Number(item[k.key]) || 0), 0);
          const height = maxValue > 0 ? (total / maxValue) * 160 : 0;

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="text-xs text-gray-600 mb-1">{total}</div>
              <div className="w-full flex flex-col-reverse" style={{ height: Math.max(height, 4) }}>
                {keys.map((k, ki) => {
                  const value = Number(item[k.key]) || 0;
                  const segmentHeight = total > 0 ? (value / total) * height : 0;
                  return (
                    <div
                      key={k.key}
                      className={`w-full ${colors[ki]} ${ki === 0 ? "rounded-t" : ""}`}
                      style={{ height: segmentHeight }}
                      title={`${k.label}: ${value}`}
                    />
                  );
                })}
              </div>
              <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left">
                {String(item[labelKey]).slice(-5)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<"sales" | "fulfillment" | "inventory" | "returns">("sales");
  const [dateRange, setDateRange] = useState("last7days");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [fulfillmentData, setFulfillmentData] = useState<FulfillmentData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [returnsData, setReturnsData] = useState<ReturnsData | null>(null);

  useEffect(() => {
    fetchAllData();
  }, [dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, salesRes, fulfillmentRes, inventoryRes, returnsRes] = await Promise.all([
        fetch(`/api/v1/client/dashboard?range=${dateRange}`),
        fetch(`/api/v1/client/sales?range=${dateRange}`),
        fetch(`/api/v1/client/fulfillment?range=${dateRange}`),
        fetch(`/api/v1/client/inventory?range=${dateRange}`),
        fetch(`/api/v1/client/returns?range=${dateRange}`),
      ]);

      if (dashboardRes.ok) setStats(await dashboardRes.json());
      if (salesRes.ok) setSalesData(await salesRes.json());
      if (fulfillmentRes.ok) setFulfillmentData(await fulfillmentRes.json());
      if (inventoryRes.ok) setInventoryData(await inventoryRes.json());
      if (returnsRes.ok) setReturnsData(await returnsRes.json());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Default stats for initial render
  const defaultStats: DashboardStats = {
    sales: {
      totalOrders: 0,
      totalOrderLines: 0,
      totalOrderQuantity: 0,
      distinctSkuSold: 0,
      avgLinesPerOrder: 0,
      totalOrderAmount: 0,
      avgOrderAmount: 0,
      codOrdersPercent: 0,
      totalDiscount: 0,
      orderQtyPendingStock: 0,
      totalPendingOrders: 0,
      unfulfillableLineLevel: 0,
      totalUnfulfillable: 0,
      slaBreachedOrders: 0,
      totalFailedOrders: 0,
    },
    fulfillment: {
      pendingPicklist: 0,
      picklistedPendingPick: 0,
      pickedPendingPack: 0,
      packedPendingManifest: 0,
      manifestedPendingShip: 0,
    },
    inventory: {
      totalSaleableQty: 0,
      totalDamagedQty: 0,
      totalInprocessQty: 0,
      distinctSkuInStock: 0,
      skuInStockPercent: 0,
    },
    returns: {
      totalReturns: 0,
      rtoPercent: 0,
      returnQty: 0,
      returnAmount: 0,
      avgReturnDays: 0,
    },
  };

  const data = stats || defaultStats;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome to your brand dashboard</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="last7days">Last 7 days</option>
          <option value="last30days">Last 30 days</option>
          <option value="last90days">Last 90 days</option>
          <option value="thisMonth">This Month</option>
          <option value="lastMonth">Last Month</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b">
        <TabButton
          active={activeTab === "sales"}
          onClick={() => setActiveTab("sales")}
          icon={ShoppingCart}
          label="Sales"
        />
        <TabButton
          active={activeTab === "fulfillment"}
          onClick={() => setActiveTab("fulfillment")}
          icon={Truck}
          label="Fulfillment"
        />
        <TabButton
          active={activeTab === "inventory"}
          onClick={() => setActiveTab("inventory")}
          icon={Package}
          label="Inventory"
        />
        <TabButton
          active={activeTab === "returns"}
          onClick={() => setActiveTab("returns")}
          icon={RotateCcw}
          label="Returns"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Sales Tab */}
          {activeTab === "sales" && (
            <div className="space-y-6">
              {/* Row 1 - Main KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Total Orders"
                  value={data.sales.totalOrders}
                  icon={ShoppingCart}
                  color="green"
                />
                <KPICard
                  title="Total Order Lines"
                  value={data.sales.totalOrderLines}
                  icon={Package}
                  color="orange"
                />
                <KPICard
                  title="Total Order Quantity"
                  value={data.sales.totalOrderQuantity}
                  icon={BarChart3}
                  color="red"
                />
                <KPICard
                  title="Distinct SKU Sold"
                  value={data.sales.distinctSkuSold}
                  icon={Package}
                  color="blue"
                />
                <KPICard
                  title="Avg Lines Per Order"
                  value={data.sales.avgLinesPerOrder.toFixed(2)}
                  icon={TrendingUp}
                  color="purple"
                />
              </div>

              {/* Row 2 - Financial KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Total Order Amount"
                  value={`₹${data.sales.totalOrderAmount.toLocaleString("en-IN")}`}
                  icon={DollarSign}
                  color="pink"
                />
                <KPICard
                  title="Avg Order Amount"
                  value={`₹${data.sales.avgOrderAmount.toLocaleString("en-IN")}`}
                  icon={TrendingUp}
                  color="pink"
                />
                <KPICard
                  title="% COD Orders"
                  value={`${data.sales.codOrdersPercent.toFixed(1)}%`}
                  icon={DollarSign}
                  color="blue"
                />
                <KPICard
                  title="Total Discount"
                  value={`₹${data.sales.totalDiscount.toLocaleString("en-IN")}`}
                  icon={TrendingDown}
                  color="cyan"
                />
                <KPICard
                  title="Order Qty Pending Stock"
                  value={data.sales.orderQtyPendingStock}
                  icon={Clock}
                  color="green"
                />
              </div>

              {/* Row 3 - Status KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Total Pending Orders"
                  value={data.sales.totalPendingOrders}
                  icon={Clock}
                  color="red"
                />
                <KPICard
                  title="Unfulfillable (Line Level)"
                  value={data.sales.unfulfillableLineLevel}
                  icon={AlertTriangle}
                  color="orange"
                />
                <KPICard
                  title="Total Unfulfillable"
                  value={data.sales.totalUnfulfillable}
                  icon={XCircle}
                  color="red"
                />
                <KPICard
                  title="SLA Breached Orders"
                  value={data.sales.slaBreachedOrders}
                  icon={AlertTriangle}
                  color="pink"
                />
                <KPICard
                  title="Total Failed Orders"
                  value={data.sales.totalFailedOrders}
                  icon={XCircle}
                  color="red"
                />
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Order Count - By Date</h3>
                  <div className="h-64">
                    <BarChart
                      data={salesData?.ordersByDate || []}
                      labelKey="date"
                      valueKey="count"
                      color="bg-blue-500"
                      height={220}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Order Count - By Channel</h3>
                  <div className="h-64 flex items-center justify-center">
                    <DonutChart
                      data={salesData?.ordersByChannel || []}
                      labelKey="channel"
                      valueKey="count"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Order Amount - By Date</h3>
                  <div className="h-64">
                    <BarChart
                      data={salesData?.ordersByDate || []}
                      labelKey="date"
                      valueKey="amount"
                      color="bg-green-500"
                      height={220}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Orders - By Payment Mode</h3>
                  <div className="h-64 flex items-center justify-center">
                    <DonutChart
                      data={salesData?.ordersByPaymentMode || []}
                      labelKey="paymentMode"
                      valueKey="count"
                      colors={["#10B981", "#3B82F6", "#F59E0B"]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fulfillment Tab */}
          {activeTab === "fulfillment" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">In Process Shipment Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Pending Picklist"
                  value={data.fulfillment.pendingPicklist}
                  icon={Clock}
                  color="green"
                />
                <KPICard
                  title="Picklisted Pending Pick"
                  value={data.fulfillment.picklistedPendingPick}
                  icon={Package}
                  color="blue"
                />
                <KPICard
                  title="Picked Pending Pack"
                  value={data.fulfillment.pickedPendingPack}
                  icon={Package}
                  color="orange"
                />
                <KPICard
                  title="Packed Pending Manifest"
                  value={data.fulfillment.packedPendingManifest}
                  icon={Truck}
                  color="purple"
                />
                <KPICard
                  title="Manifested Pending Ship"
                  value={data.fulfillment.manifestedPendingShip}
                  icon={Truck}
                  color="cyan"
                />
              </div>

              {/* Fulfillment by Channel Table */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">In Process Shipment by Channel</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="text-left p-3">Channel Name</th>
                        <th className="text-left p-3">Ship by Date</th>
                        <th className="text-center p-3">Pending Picklist</th>
                        <th className="text-center p-3">Pending Pick</th>
                        <th className="text-center p-3">Pending Pack</th>
                        <th className="text-center p-3">Pending Manifest</th>
                        <th className="text-center p-3">Pending Ship</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fulfillmentData?.byChannel && fulfillmentData.byChannel.length > 0 ? (
                        fulfillmentData.byChannel.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{row.channel}</td>
                            <td className="p-3 text-sm">{row.shipByDate ? new Date(row.shipByDate).toLocaleDateString() : "-"}</td>
                            <td className="p-3 text-center">{row.pendingPicklist}</td>
                            <td className="p-3 text-center">{row.pendingPick}</td>
                            <td className="p-3 text-center">{row.pendingPack}</td>
                            <td className="p-3 text-center">{row.pendingManifest}</td>
                            <td className="p-3 text-center">{row.pendingShip}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-b">
                          <td className="p-3 text-sm text-gray-500" colSpan={7}>
                            No pending shipments for the selected period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fulfillment by Location Table */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">In Process Shipment by Location</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-green-600 text-white">
                      <tr>
                        <th className="text-left p-3">Location</th>
                        <th className="text-center p-3">Pending Picklist</th>
                        <th className="text-center p-3">Pending Pick</th>
                        <th className="text-center p-3">Pending Pack</th>
                        <th className="text-center p-3">Pending Manifest</th>
                        <th className="text-center p-3">Pending Ship</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fulfillmentData?.byLocation && fulfillmentData.byLocation.length > 0 ? (
                        fulfillmentData.byLocation.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{row.location}</td>
                            <td className="p-3 text-center">{row.pendingPicklist}</td>
                            <td className="p-3 text-center">{row.pendingPick}</td>
                            <td className="p-3 text-center">{row.pendingPack}</td>
                            <td className="p-3 text-center">{row.pendingManifest}</td>
                            <td className="p-3 text-center">{row.pendingShip}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-b">
                          <td className="p-3 text-sm text-gray-500" colSpan={6}>
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Packed & Shipped - By Date</h3>
                  <div className="h-64">
                    <StackedBarChart
                      data={fulfillmentData?.shipmentsByDate || []}
                      labelKey="date"
                      keys={[
                        { key: "packed", label: "Packed" },
                        { key: "shipped", label: "Shipped" },
                      ]}
                      colors={["bg-blue-500", "bg-green-500"]}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Shipments by Transporter</h3>
                  <div className="h-64">
                    <HorizontalBarChart
                      data={fulfillmentData?.shipmentsByTransporter || []}
                      labelKey="transporter"
                      valueKey="count"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === "inventory" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Inventory Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Total Saleable Qty"
                  value={data.inventory.totalSaleableQty}
                  icon={Package}
                  color="blue"
                />
                <KPICard
                  title="Total Damaged Qty"
                  value={data.inventory.totalDamagedQty}
                  icon={AlertTriangle}
                  color="red"
                />
                <KPICard
                  title="Total Inprocess Qty"
                  value={data.inventory.totalInprocessQty}
                  icon={Clock}
                  color="yellow"
                />
                <KPICard
                  title="Distinct SKU in Stock"
                  value={data.inventory.distinctSkuInStock}
                  icon={Package}
                  color="green"
                />
                <KPICard
                  title="% SKU in Stock"
                  value={`${data.inventory.skuInStockPercent.toFixed(2)}%`}
                  icon={CheckCircle}
                  color="purple"
                />
              </div>

              {/* Inventory by Location Table */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Inventory by Location</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="text-left p-3">Location</th>
                        <th className="text-right p-3">Total Quantity</th>
                        <th className="text-right p-3">SKU Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData?.inventoryByLocation && inventoryData.inventoryByLocation.length > 0 ? (
                        inventoryData.inventoryByLocation.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{row.location}</td>
                            <td className="p-3 text-right">{row.quantity.toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right">{row.skuCount}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-3 text-gray-500">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Qty Received - By Date</h3>
                  <div className="h-64">
                    <BarChart
                      data={inventoryData?.inboundByDate || []}
                      labelKey="date"
                      valueKey="quantity"
                      color="bg-green-500"
                      height={220}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Inventory by Category</h3>
                  <div className="h-64 flex items-center justify-center">
                    <DonutChart
                      data={inventoryData?.inventoryByCategory || []}
                      labelKey="category"
                      valueKey="quantity"
                    />
                  </div>
                </div>
              </div>

              {/* Low Stock Alert */}
              {inventoryData?.lowStockSkus && inventoryData.lowStockSkus.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b bg-red-50">
                    <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Low Stock Alert
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3">SKU Code</th>
                          <th className="text-left p-3">SKU Name</th>
                          <th className="text-right p-3">Current Qty</th>
                          <th className="text-right p-3">Reorder Point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryData.lowStockSkus.map((sku, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{sku.skuCode}</td>
                            <td className="p-3">{sku.skuName}</td>
                            <td className="p-3 text-right text-red-600 font-medium">{sku.quantity}</td>
                            <td className="p-3 text-right">{sku.reorderPoint}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Returns Tab */}
          {activeTab === "returns" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Total Returns"
                  value={data.returns.totalReturns}
                  icon={RotateCcw}
                  color="green"
                />
                <KPICard
                  title="% RTO"
                  value={`${data.returns.rtoPercent.toFixed(1)}%`}
                  icon={TrendingUp}
                  color="cyan"
                />
                <KPICard
                  title="Return Qty"
                  value={data.returns.returnQty}
                  icon={Package}
                  color="red"
                />
                <KPICard
                  title="Return Amount"
                  value={`₹${data.returns.returnAmount.toLocaleString("en-IN")}`}
                  icon={DollarSign}
                  color="pink"
                />
                <KPICard
                  title="Average Return Days"
                  value={data.returns.avgReturnDays}
                  icon={Clock}
                  color="purple"
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Returns - By Date</h3>
                  <div className="h-64">
                    <BarChart
                      data={returnsData?.returnsByDate || []}
                      labelKey="date"
                      valueKey="count"
                      color="bg-red-500"
                      height={220}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Return Qty - By Date</h3>
                  <div className="h-64">
                    <BarChart
                      data={returnsData?.returnsByDate || []}
                      labelKey="date"
                      valueKey="quantity"
                      color="bg-orange-500"
                      height={220}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Returns by Type</h3>
                  <div className="h-64 flex items-center justify-center">
                    <DonutChart
                      data={returnsData?.returnsByType || []}
                      labelKey="type"
                      valueKey="count"
                      colors={["#EF4444", "#F59E0B", "#10B981"]}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Returns by Reason</h3>
                  <div className="h-64 overflow-auto">
                    <HorizontalBarChart
                      data={returnsData?.returnsByReason || []}
                      labelKey="reason"
                      valueKey="count"
                    />
                  </div>
                </div>
              </div>

              {/* Top Returned SKUs */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Top Returned SKUs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">SKU Code</th>
                        <th className="text-left p-3">SKU Name</th>
                        <th className="text-right p-3">Return Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnsData?.topReturnedSkus && returnsData.topReturnedSkus.length > 0 ? (
                        returnsData.topReturnedSkus.map((sku, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{sku.skuCode}</td>
                            <td className="p-3">{sku.skuName}</td>
                            <td className="p-3 text-right font-medium">{sku.quantity}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-3 text-gray-500">No return data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
