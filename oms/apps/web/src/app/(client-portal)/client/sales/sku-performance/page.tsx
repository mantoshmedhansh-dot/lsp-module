"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  Loader2,
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

interface Category {
  name: string;
  count: number;
}

export default function SKUPerformancePage() {
  const [skus, setSkus] = useState<SKUPerformance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState<keyof SKUPerformance>("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category", selectedCategory);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const response = await fetch(`/api/v1/client/sku-performance?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch SKU performance");

      const data = await response.json();
      setSkus(data.skus || []);
      setCategories(data.categories || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSKUs = skus;

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

  const topPerformer = skus.length > 0
    ? skus.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev))
    : null;
  const totalRevenue = skus.reduce((sum, sku) => sum + sku.revenue, 0);
  const avgReturnRate = skus.length > 0
    ? skus.reduce((sum, sku) => sum + sku.returnRate, 0) / skus.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

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
              <p className="text-2xl font-bold">{skus.length}</p>
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
              <p className="text-lg font-bold truncate">{topPerformer?.code || "-"}</p>
              <p className="text-xs text-gray-500 truncate">{topPerformer?.name || "No data"}</p>
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
