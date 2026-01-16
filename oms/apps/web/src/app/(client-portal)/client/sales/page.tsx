"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Package,
  TrendingUp,
  DollarSign,
  ArrowRight,
  BarChart3,
} from "lucide-react";

interface SalesData {
  summary: {
    totalOrders: number;
    totalOrderLines: number;
    totalOrderQuantity: number;
    totalOrderAmount: number;
    avgOrderAmount: number;
    distinctSkuSold: number;
  };
  ordersByDate: { date: string; count: number; amount: number }[];
  ordersByChannel: { channel: string; count: number; amount: number }[];
  topSellingSkus: { skuCode: string; skuName: string; quantity: number; amount: number }[];
  topCategories: { category: string; quantity: number; amount: number }[];
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
  };

  const content = (
    <div className={`${colorClasses[color]} rounded-lg p-4 text-white shadow-lg h-full`}>
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
      {href && (
        <div className="mt-2 flex items-center text-sm opacity-80">
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:scale-105 transition-transform">
        {content}
      </Link>
    );
  }

  return content;
}

export default function SalesOverviewPage() {
  const [dateRange, setDateRange] = useState("last7days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesData | null>(null);

  useEffect(() => {
    fetchSalesData();
  }, [dateRange]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/client/sales?range=${dateRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  const defaultData: SalesData = {
    summary: {
      totalOrders: 0,
      totalOrderLines: 0,
      totalOrderQuantity: 0,
      totalOrderAmount: 0,
      avgOrderAmount: 0,
      distinctSkuSold: 0,
    },
    ordersByDate: [],
    ordersByChannel: [],
    topSellingSkus: [],
    topCategories: [],
  };

  const salesData = data || defaultData;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Overview</h1>
          <p className="text-sm text-gray-500">
            Monitor your sales performance
          </p>
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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPICard
              title="Total Orders"
              value={salesData.summary.totalOrders}
              icon={ShoppingCart}
              color="green"
              href="/client/sales/orders"
            />
            <KPICard
              title="Order Lines"
              value={salesData.summary.totalOrderLines}
              icon={Package}
              color="orange"
            />
            <KPICard
              title="Total Qty"
              value={salesData.summary.totalOrderQuantity}
              icon={BarChart3}
              color="blue"
            />
            <KPICard
              title="SKUs Sold"
              value={salesData.summary.distinctSkuSold}
              icon={Package}
              color="purple"
            />
            <KPICard
              title="Total Amount"
              value={`₹${salesData.summary.totalOrderAmount.toLocaleString("en-IN")}`}
              icon={DollarSign}
              color="pink"
            />
            <KPICard
              title="Avg Order Value"
              value={`₹${Math.round(salesData.summary.avgOrderAmount).toLocaleString("en-IN")}`}
              icon={TrendingUp}
              color="green"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders by Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Order Count - By Date</h3>
              <div className="h-64">
                {salesData.ordersByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {salesData.ordersByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{
                            height: `${Math.max(
                              (item.count /
                                Math.max(...salesData.ordersByDate.map((d) => d.count))) *
                                200,
                              4
                            )}px`,
                          }}
                        ></div>
                        <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left">
                          {new Date(item.date).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>

            {/* Orders by Channel */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Order Count - By Channel</h3>
              <div className="h-64">
                {salesData.ordersByChannel.length > 0 ? (
                  <div className="space-y-3">
                    {salesData.ordersByChannel.map((item, index) => {
                      const maxCount = Math.max(
                        ...salesData.ordersByChannel.map((c) => c.count)
                      );
                      const colors = [
                        "bg-blue-500",
                        "bg-green-500",
                        "bg-orange-500",
                        "bg-purple-500",
                        "bg-pink-500",
                      ];
                      return (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{item.channel}</span>
                            <span className="font-medium">{item.count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded h-6">
                            <div
                              className={`h-6 rounded ${colors[index % colors.length]}`}
                              style={{
                                width: `${(item.count / maxCount) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling SKUs */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Top Selling SKUs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">SKU</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Qty</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesData.topSellingSkus.length > 0 ? (
                      salesData.topSellingSkus.map((sku, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium text-sm">{sku.skuCode}</div>
                            <div className="text-xs text-gray-500">{sku.skuName}</div>
                          </td>
                          <td className="p-3 text-right text-sm">{sku.quantity}</td>
                          <td className="p-3 text-right text-sm font-medium">
                            ₹{sku.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Categories */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Top Categories</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Category</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Qty</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salesData.topCategories.length > 0 ? (
                      salesData.topCategories.map((cat, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 text-sm font-medium">{cat.category || "Uncategorized"}</td>
                          <td className="p-3 text-right text-sm">{cat.quantity}</td>
                          <td className="p-3 text-right text-sm font-medium">
                            ₹{cat.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
