"use client";

import { useState } from "react";
import {
  Package,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  Filter,
  ArrowUpDown,
} from "lucide-react";

interface SKUPerformance {
  id: string;
  code: string;
  name: string;
  category: string;
  totalOrders: number;
  totalUnits: number;
  revenue: number;
  avgOrderValue: number;
  returnRate: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

const mockSKUs: SKUPerformance[] = [
  {
    id: "1",
    code: "SKU-001",
    name: "Premium Cotton T-Shirt",
    category: "Apparel",
    totalOrders: 1250,
    totalUnits: 3500,
    revenue: 875000,
    avgOrderValue: 700,
    returnRate: 2.5,
    trend: "up",
    trendPercent: 15.3,
  },
  {
    id: "2",
    code: "SKU-002",
    name: "Wireless Earbuds Pro",
    category: "Electronics",
    totalOrders: 890,
    totalUnits: 1200,
    revenue: 1560000,
    avgOrderValue: 1752,
    returnRate: 5.2,
    trend: "up",
    trendPercent: 22.1,
  },
  {
    id: "3",
    code: "SKU-003",
    name: "Organic Face Cream",
    category: "Beauty",
    totalOrders: 650,
    totalUnits: 850,
    revenue: 425000,
    avgOrderValue: 654,
    returnRate: 1.8,
    trend: "stable",
    trendPercent: 0.5,
  },
  {
    id: "4",
    code: "SKU-004",
    name: "Running Shoes Elite",
    category: "Footwear",
    totalOrders: 420,
    totalUnits: 580,
    revenue: 696000,
    avgOrderValue: 1657,
    returnRate: 8.5,
    trend: "down",
    trendPercent: -5.2,
  },
  {
    id: "5",
    code: "SKU-005",
    name: "Smart Watch Series 5",
    category: "Electronics",
    totalOrders: 380,
    totalUnits: 420,
    revenue: 1260000,
    avgOrderValue: 3316,
    returnRate: 3.1,
    trend: "up",
    trendPercent: 18.7,
  },
];

export default function SKUPerformancePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof SKUPerformance>("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredSKUs = mockSKUs
    .filter(
      (sku) =>
        sku.code.toLowerCase().includes(search.toLowerCase()) ||
        sku.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

  const handleSort = (column: keyof SKUPerformance) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const topPerformer = mockSKUs.reduce((prev, curr) =>
    curr.revenue > prev.revenue ? curr : prev
  );
  const totalRevenue = mockSKUs.reduce((sum, sku) => sum + sku.revenue, 0);
  const avgReturnRate =
    mockSKUs.reduce((sum, sku) => sum + sku.returnRate, 0) / mockSKUs.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Performance</h1>
          <p className="text-gray-600">
            Analyze product performance across all channels
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total SKUs</p>
              <p className="text-2xl font-bold">{mockSKUs.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Top Performer</p>
              <p className="text-lg font-bold truncate">{topPerformer.code}</p>
              <p className="text-xs text-gray-500 truncate">{topPerformer.name}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Return Rate</p>
              <p className="text-2xl font-bold">{avgReturnRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  SKU
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Category
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("totalOrders")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Orders
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("totalUnits")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Units Sold
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("revenue")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Revenue
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("returnRate")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Return Rate
                    <ArrowUpDown className="w-4 h-4" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSKUs.map((sku) => (
                <tr key={sku.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{sku.code}</p>
                      <p className="text-sm text-gray-500">{sku.name}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {sku.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {sku.totalOrders.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {sku.totalUnits.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {formatCurrency(sku.revenue)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className={`font-medium ${
                        sku.returnRate > 5
                          ? "text-red-600"
                          : sku.returnRate > 3
                          ? "text-yellow-600"
                          : "text-green-600"
                      }`}
                    >
                      {sku.returnRate}%
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div
                      className={`flex items-center justify-end gap-1 ${
                        sku.trend === "up"
                          ? "text-green-600"
                          : sku.trend === "down"
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {sku.trend === "up" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : sku.trend === "down" ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : null}
                      <span className="font-medium">
                        {sku.trendPercent > 0 ? "+" : ""}
                        {sku.trendPercent}%
                      </span>
                    </div>
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
