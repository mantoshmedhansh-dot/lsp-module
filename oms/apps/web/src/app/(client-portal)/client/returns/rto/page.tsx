"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  MapPin,
  Download,
  Loader2,
} from "lucide-react";

interface RTOAnalysis {
  id: string;
  reason: string;
  count: number;
  percentage: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

interface LocationRTO {
  id: string;
  location: string;
  totalOrders: number;
  rtoOrders: number;
  rtoRate: number;
  trend: "up" | "down" | "stable";
}

export default function RTOAnalysisPage() {
  const [rtoReasons, setRtoReasons] = useState<RTOAnalysis[]>([]);
  const [locationRTODataData, setLocationRTOData] = useState<LocationRTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7days");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/client/returns/rto?period=${dateRange}`);
      if (!response.ok) throw new Error("Failed to fetch RTO data");

      const data = await response.json();
      setRtoReasons(data.reasons || []);
      setLocationRTOData(data.locations || []);
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

  const totalRTO = rtoReasons.reduce((sum, r) => sum + r.count, 0);
  const totalOrders = locationRTODataData.reduce((sum, l) => sum + l.totalOrders, 0);
  const overallRTORate = totalOrders > 0 ? ((totalRTO / totalOrders) * 100).toFixed(1) : "0";

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
          <h1 className="text-2xl font-bold text-gray-900">RTO Analysis</h1>
          <p className="text-gray-600">
            Analyze return to origin patterns and reduce RTO rate
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
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total RTO</p>
              <p className="text-2xl font-bold">{totalRTO}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">RTO Rate</p>
              <p className="text-2xl font-bold text-red-600">{overallRTORate}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Top RTO Reason</p>
              <p className="text-lg font-bold text-gray-900">Customer NA</p>
              <p className="text-sm text-red-600">35.2%</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RTO by Reason */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">RTO by Reason</h2>
            <p className="text-sm text-gray-600">
              Breakdown of return to origin reasons
            </p>
          </div>
          <div className="p-4 space-y-4">
            {rtoReasons.map((reason) => (
              <div key={reason.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {reason.reason}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{reason.count}</span>
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        reason.trend === "up"
                          ? "text-red-600"
                          : reason.trend === "down"
                          ? "text-green-600"
                          : "text-gray-600"
                      }`}
                    >
                      {reason.trend === "up" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : reason.trend === "down" ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {reason.trendPercent > 0 ? "+" : ""}
                      {reason.trendPercent}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{reason.percentage}% of total RTO</p>
              </div>
            ))}
          </div>
        </div>

        {/* RTO by Location */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">RTO by Location</h2>
            <p className="text-sm text-gray-600">
              Geographic distribution of RTO
            </p>
          </div>
          <div className="divide-y">
            {locationRTOData.map((location) => (
              <div
                key={location.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{location.location}</p>
                    <p className="text-sm text-gray-500">
                      {location.totalOrders.toLocaleString()} orders
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-bold ${
                      location.rtoRate > 6
                        ? "text-red-600"
                        : location.rtoRate > 4
                        ? "text-yellow-600"
                        : "text-green-600"
                    }`}
                  >
                    {location.rtoRate}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {location.rtoOrders} RTO orders
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recommendations to Reduce RTO
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-medium text-blue-900 mb-2">
              Address Verification
            </h3>
            <p className="text-sm text-blue-700">
              Implement address verification at checkout to reduce wrong address
              RTOs by up to 40%.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <h3 className="font-medium text-green-900 mb-2">
              Delivery Slot Selection
            </h3>
            <p className="text-sm text-green-700">
              Allow customers to choose delivery slots to reduce "Customer Not
              Available" RTOs.
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <h3 className="font-medium text-purple-900 mb-2">
              COD Verification
            </h3>
            <p className="text-sm text-purple-700">
              Use COD verification calls for high-risk orders to reduce refusal
              RTOs by 25%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
