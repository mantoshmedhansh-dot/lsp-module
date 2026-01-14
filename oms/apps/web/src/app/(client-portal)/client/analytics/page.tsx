"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  DollarSign,
  Target,
  Calendar,
  Download,
} from "lucide-react";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("30days");

  const kpis = {
    revenue: { value: 4850000, change: 12.5, trend: "up" },
    orders: { value: 2450, change: 8.3, trend: "up" },
    customers: { value: 1850, change: 15.2, trend: "up" },
    aov: { value: 1980, change: -2.1, trend: "down" },
  };

  const conversionFunnel = [
    { stage: "Visitors", count: 125000, rate: 100 },
    { stage: "Product Views", count: 45000, rate: 36 },
    { stage: "Add to Cart", count: 8500, rate: 6.8 },
    { stage: "Checkout", count: 3200, rate: 2.56 },
    { stage: "Completed Orders", count: 2450, rate: 1.96 },
  ];

  const channelMetrics = [
    {
      channel: "Amazon",
      revenue: 1940000,
      orders: 980,
      aov: 1980,
      growth: 15.3,
    },
    {
      channel: "Flipkart",
      revenue: 1455000,
      orders: 735,
      aov: 1980,
      growth: 8.2,
    },
    {
      channel: "Website",
      revenue: 970000,
      orders: 490,
      aov: 1980,
      growth: 22.5,
    },
    { channel: "Myntra", revenue: 485000, orders: 245, aov: 1980, growth: -3.1 },
  ];

  const cohortData = [
    { month: "Jan 2024", acquired: 450, m1: 68, m2: 42, m3: 28 },
    { month: "Dec 2023", acquired: 380, m1: 72, m2: 45, m3: 32 },
    { month: "Nov 2023", acquired: 520, m1: 65, m2: 38, m3: 25 },
    { month: "Oct 2023", acquired: 410, m1: 70, m2: 48, m3: 35 },
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
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">
            Business intelligence and performance insights
          </p>
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
            <option value="year">This Year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(kpis.revenue.value)}
              </p>
              <p
                className={`text-sm flex items-center gap-1 mt-1 ${
                  kpis.revenue.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {kpis.revenue.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {kpis.revenue.change > 0 ? "+" : ""}
                {kpis.revenue.change}%
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
              <p className="text-sm text-gray-600">Orders</p>
              <p className="text-2xl font-bold">
                {kpis.orders.value.toLocaleString()}
              </p>
              <p
                className={`text-sm flex items-center gap-1 mt-1 ${
                  kpis.orders.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {kpis.orders.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {kpis.orders.change > 0 ? "+" : ""}
                {kpis.orders.change}%
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
              <p className="text-sm text-gray-600">Customers</p>
              <p className="text-2xl font-bold">
                {kpis.customers.value.toLocaleString()}
              </p>
              <p
                className={`text-sm flex items-center gap-1 mt-1 ${
                  kpis.customers.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {kpis.customers.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {kpis.customers.change > 0 ? "+" : ""}
                {kpis.customers.change}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold">{formatCurrency(kpis.aov.value)}</p>
              <p
                className={`text-sm flex items-center gap-1 mt-1 ${
                  kpis.aov.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {kpis.aov.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {kpis.aov.change > 0 ? "+" : ""}
                {kpis.aov.change}%
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Conversion Funnel
            </h2>
            <p className="text-sm text-gray-600">
              Customer journey from visit to purchase
            </p>
          </div>
          <div className="p-4 space-y-4">
            {conversionFunnel.map((stage, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{stage.stage}</span>
                  <div className="text-right">
                    <span className="font-semibold">
                      {stage.count.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({stage.rate}%)
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${stage.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Channel Performance
            </h2>
            <p className="text-sm text-gray-600">Sales across marketplaces</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Channel
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Revenue
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Orders
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody>
                {channelMetrics.map((channel, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{channel.channel}</td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(channel.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right">{channel.orders}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-medium ${
                          channel.growth > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {channel.growth > 0 ? "+" : ""}
                        {channel.growth}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cohort Analysis */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Customer Retention (Cohort Analysis)
          </h2>
          <p className="text-sm text-gray-600">
            Repeat purchase rates by acquisition month
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Cohort
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Acquired
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Month 1
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Month 2
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Month 3
                </th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map((cohort, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{cohort.month}</td>
                  <td className="py-3 px-4 text-right">{cohort.acquired}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        cohort.m1 >= 70
                          ? "bg-green-100 text-green-700"
                          : cohort.m1 >= 60
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {cohort.m1}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        cohort.m2 >= 45
                          ? "bg-green-100 text-green-700"
                          : cohort.m2 >= 35
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {cohort.m2}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        cohort.m3 >= 30
                          ? "bg-green-100 text-green-700"
                          : cohort.m3 >= 25
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {cohort.m3}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
