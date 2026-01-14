"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Download,
  Calendar,
} from "lucide-react";

export default function SalesReportPage() {
  const [dateRange, setDateRange] = useState("30days");

  const salesData = {
    totalRevenue: 4850000,
    totalOrders: 2450,
    avgOrderValue: 1980,
    unitsSold: 5680,
    revenueGrowth: 12.5,
    orderGrowth: 8.3,
  };

  const topProducts = [
    { name: "Premium Cotton T-Shirt", revenue: 875000, units: 3500 },
    { name: "Wireless Earbuds Pro", revenue: 780000, units: 520 },
    { name: "Smart Watch Series 5", revenue: 650000, units: 195 },
    { name: "Running Shoes Elite", revenue: 520000, units: 325 },
    { name: "Organic Face Cream", revenue: 425000, units: 850 },
  ];

  const channelBreakdown = [
    { channel: "Amazon", revenue: 1940000, orders: 980, percentage: 40 },
    { channel: "Flipkart", revenue: 1455000, orders: 735, percentage: 30 },
    { channel: "Website", revenue: 970000, orders: 490, percentage: 20 },
    { channel: "Myntra", revenue: 485000, orders: 245, percentage: 10 },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-gray-600">Comprehensive sales analytics and trends</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(salesData.totalRevenue)}
              </p>
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4" />+{salesData.revenueGrowth}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold">
                {salesData.totalOrders.toLocaleString()}
              </p>
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4" />+{salesData.orderGrowth}%
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold">
                {formatCurrency(salesData.avgOrderValue)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Units Sold</p>
              <p className="text-2xl font-bold">
                {salesData.unitsSold.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Top Products</h2>
            <p className="text-sm text-gray-600">Best selling products by revenue</p>
          </div>
          <div className="divide-y">
            {topProducts.map((product, index) => (
              <div key={index} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      {product.units.toLocaleString()} units
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(product.revenue)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Channel Breakdown
            </h2>
            <p className="text-sm text-gray-600">Sales distribution by channel</p>
          </div>
          <div className="p-4 space-y-4">
            {channelBreakdown.map((channel, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {channel.channel}
                  </span>
                  <div className="text-right">
                    <span className="font-semibold">
                      {formatCurrency(channel.revenue)}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({channel.orders} orders)
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${channel.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {channel.percentage}% of total sales
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
