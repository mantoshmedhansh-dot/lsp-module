"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Loader2,
} from "lucide-react";

interface InventoryData {
  totalSKUs: number;
  totalValue: number;
  avgTurnover: number;
  lowStockItems: number;
  outOfStockItems: number;
  overstockItems: number;
}

interface CategoryData {
  category: string;
  skus: number;
  value: number;
  turnover: number;
}

interface AgingData {
  age: string;
  units: number;
  value: number;
  percentage: number;
}

export default function InventoryReportPage() {
  const [inventoryData, setInventoryData] = useState<InventoryData>({
    totalSKUs: 0, totalValue: 0, avgTurnover: 0, lowStockItems: 0, outOfStockItems: 0, overstockItems: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryData[]>([]);
  const [agingAnalysis, setAgingAnalysis] = useState<AgingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("30days");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/client/reports/inventory?period=${dateRange}`);
      if (!response.ok) throw new Error("Failed to fetch inventory report");

      const data = await response.json();
      setInventoryData(data.inventoryData || {
        totalSKUs: 0, totalValue: 0, avgTurnover: 0, lowStockItems: 0, outOfStockItems: 0, overstockItems: 0,
      });
      setCategoryBreakdown(data.categoryBreakdown || []);
      setAgingAnalysis(data.agingAnalysis || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <h1 className="text-2xl font-bold text-gray-900">Inventory Report</h1>
          <p className="text-gray-600">Stock analysis and inventory health metrics</p>
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
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Total SKUs</p>
          <p className="text-2xl font-bold">{inventoryData.totalSKUs}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Inventory Value</p>
          <p className="text-2xl font-bold">
            {formatCurrency(inventoryData.totalValue)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Avg Turnover</p>
          <p className="text-2xl font-bold">{inventoryData.avgTurnover}x</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">
            {inventoryData.lowStockItems}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">
            {inventoryData.outOfStockItems}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Overstock</p>
          <p className="text-2xl font-bold text-orange-600">
            {inventoryData.overstockItems}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">By Category</h2>
            <p className="text-sm text-gray-600">Inventory distribution by category</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Category
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    SKUs
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Value
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Turnover
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((cat, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{cat.category}</td>
                    <td className="py-3 px-4 text-right">{cat.skus}</td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(cat.value)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-medium ${
                          cat.turnover >= 4
                            ? "text-green-600"
                            : cat.turnover >= 3
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {cat.turnover}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aging Analysis */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Inventory Aging</h2>
            <p className="text-sm text-gray-600">Stock age distribution</p>
          </div>
          <div className="p-4 space-y-4">
            {agingAnalysis.map((age, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{age.age}</span>
                  <div className="text-right">
                    <span className="font-semibold">
                      {formatCurrency(age.value)}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({age.units.toLocaleString()} units)
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      index === 0
                        ? "bg-green-500"
                        : index === 1
                        ? "bg-yellow-500"
                        : index === 2
                        ? "bg-orange-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${age.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{age.percentage}% of inventory</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
