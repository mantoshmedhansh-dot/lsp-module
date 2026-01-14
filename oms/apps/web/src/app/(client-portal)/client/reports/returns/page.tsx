"use client";

import { useState } from "react";
import {
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Download,
  DollarSign,
} from "lucide-react";

export default function ReturnsReportPage() {
  const [dateRange, setDateRange] = useState("30days");

  const returnsData = {
    totalReturns: 285,
    rtoReturns: 175,
    customerReturns: 110,
    returnRate: 5.8,
    refundValue: 425000,
    avgProcessingTime: 4.5,
  };

  const returnReasons = [
    { reason: "Product Quality Issue", count: 68, percentage: 23.9 },
    { reason: "Wrong Size/Fit", count: 55, percentage: 19.3 },
    { reason: "Product Not as Described", count: 48, percentage: 16.8 },
    { reason: "Customer Changed Mind", count: 42, percentage: 14.7 },
    { reason: "Damaged in Transit", count: 38, percentage: 13.3 },
    { reason: "Other", count: 34, percentage: 11.9 },
  ];

  const categoryReturns = [
    { category: "Apparel", returns: 95, rate: 7.2 },
    { category: "Footwear", returns: 68, rate: 8.5 },
    { category: "Electronics", returns: 52, rate: 4.2 },
    { category: "Beauty", returns: 38, rate: 3.8 },
    { category: "Accessories", returns: 32, rate: 5.5 },
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
          <h1 className="text-2xl font-bold text-gray-900">Returns Report</h1>
          <p className="text-gray-600">
            Return analytics and refund processing metrics
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
          <p className="text-sm text-gray-600">Total Returns</p>
          <p className="text-2xl font-bold">{returnsData.totalReturns}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">RTO Returns</p>
          <p className="text-2xl font-bold text-orange-600">
            {returnsData.rtoReturns}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Customer Returns</p>
          <p className="text-2xl font-bold text-blue-600">
            {returnsData.customerReturns}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Return Rate</p>
          <p className="text-2xl font-bold text-red-600">
            {returnsData.returnRate}%
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Refund Value</p>
          <p className="text-2xl font-bold">
            {formatCurrency(returnsData.refundValue)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600">Avg Processing</p>
          <p className="text-2xl font-bold">{returnsData.avgProcessingTime}d</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Return Reasons */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Return Reasons</h2>
            <p className="text-sm text-gray-600">Why customers return products</p>
          </div>
          <div className="p-4 space-y-4">
            {returnReasons.map((reason, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {reason.reason}
                  </span>
                  <span className="text-sm text-gray-600">{reason.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{reason.percentage}% of returns</p>
              </div>
            ))}
          </div>
        </div>

        {/* Returns by Category */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Returns by Category
            </h2>
            <p className="text-sm text-gray-600">
              Return rates across product categories
            </p>
          </div>
          <div className="divide-y">
            {categoryReturns.map((cat, index) => (
              <div
                key={index}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{cat.category}</p>
                    <p className="text-sm text-gray-500">{cat.returns} returns</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold ${
                      cat.rate > 7
                        ? "text-red-600"
                        : cat.rate > 5
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {cat.rate}%
                  </p>
                  <p className="text-sm text-gray-500">return rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recommendations to Reduce Returns
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-medium text-blue-900 mb-2">
              Improve Size Guides
            </h3>
            <p className="text-sm text-blue-700">
              19.3% of returns are due to sizing issues. Enhanced size guides
              could reduce these significantly.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <h3 className="font-medium text-green-900 mb-2">
              Better Product Images
            </h3>
            <p className="text-sm text-green-700">
              Add 360-degree views and detailed photos to reduce "not as
              described" returns by up to 40%.
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <h3 className="font-medium text-purple-900 mb-2">
              Quality Control
            </h3>
            <p className="text-sm text-purple-700">
              Enhance QC processes to catch quality issues before shipping and
              reduce damage-related returns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
