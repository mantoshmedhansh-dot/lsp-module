"use client";

import { useEffect, useState } from "react";
import {
  RotateCcw,
  TrendingUp,
  Package,
  DollarSign,
  Clock,
} from "lucide-react";

interface ReturnsData {
  summary: {
    totalReturns: number;
    rtoPercent: number;
    returnQty: number;
    returnAmount: number;
    avgReturnDays: number;
  };
  returnsByDate: { date: string; count: number; quantity: number }[];
  returnsByReason: { reason: string; count: number }[];
  returnsByType: { type: string; count: number; amount: number }[];
  topReturnedSkus: { skuCode: string; skuName: string; quantity: number }[];
}

function KPICard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    cyan: "bg-cyan-500",
    red: "bg-red-500",
    pink: "bg-pink-500",
    purple: "bg-purple-500",
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
    </div>
  );
}

export default function ReturnsOverviewPage() {
  const [dateRange, setDateRange] = useState("last7days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReturnsData | null>(null);

  useEffect(() => {
    fetchReturnsData();
  }, [dateRange]);

  const fetchReturnsData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/client/returns?range=${dateRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching returns data:", error);
    } finally {
      setLoading(false);
    }
  };

  const defaultData: ReturnsData = {
    summary: {
      totalReturns: 0,
      rtoPercent: 0,
      returnQty: 0,
      returnAmount: 0,
      avgReturnDays: 0,
    },
    returnsByDate: [],
    returnsByReason: [],
    returnsByType: [],
    topReturnedSkus: [],
  };

  const returnsData = data || defaultData;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns Overview</h1>
          <p className="text-sm text-gray-500">
            Monitor return trends and RTO analysis
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              title="Total Returns"
              value={returnsData.summary.totalReturns}
              icon={RotateCcw}
              color="green"
            />
            <KPICard
              title="% RTO"
              value={`${returnsData.summary.rtoPercent.toFixed(1)}%`}
              icon={TrendingUp}
              color="cyan"
            />
            <KPICard
              title="Return Qty"
              value={returnsData.summary.returnQty}
              icon={Package}
              color="red"
            />
            <KPICard
              title="Return Amount"
              value={`₹${returnsData.summary.returnAmount.toLocaleString("en-IN")}`}
              icon={DollarSign}
              color="pink"
            />
            <KPICard
              title="Avg Return Days"
              value={returnsData.summary.avgReturnDays}
              icon={Clock}
              color="purple"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Returns by Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Returns - By Date</h3>
              <div className="h-64">
                {returnsData.returnsByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {returnsData.returnsByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{
                            height: `${Math.max(
                              (item.count /
                                Math.max(
                                  ...returnsData.returnsByDate.map((d) => d.count)
                                )) *
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
                    No return data available
                  </div>
                )}
              </div>
            </div>

            {/* Return Qty by Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Return Qty - By Date</h3>
              <div className="h-64">
                {returnsData.returnsByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {returnsData.returnsByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-green-500 rounded-t"
                          style={{
                            height: `${Math.max(
                              (item.quantity /
                                Math.max(
                                  ...returnsData.returnsByDate.map((d) => d.quantity)
                                )) *
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
                    No return data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Returns by Type */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Returns by Type</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">
                        Return Type
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Count
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnsData.returnsByType.length > 0 ? (
                      returnsData.returnsByType.map((type, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 text-sm font-medium">
                            {type.type.replace(/_/g, " ")}
                          </td>
                          <td className="p-3 text-right text-sm">{type.count}</td>
                          <td className="p-3 text-right text-sm font-medium">
                            ₹{type.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No return data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                      <th className="text-left p-3 text-sm font-medium text-gray-600">
                        SKU
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Return Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnsData.topReturnedSkus.length > 0 ? (
                      returnsData.topReturnedSkus.map((sku, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium text-sm">{sku.skuCode}</div>
                            <div className="text-xs text-gray-500">{sku.skuName}</div>
                          </td>
                          <td className="p-3 text-right text-sm">{sku.quantity}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="p-4 text-center text-gray-500">
                          No return data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Returns by Reason */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Returns by Reason</h3>
            </div>
            <div className="p-6">
              {returnsData.returnsByReason.length > 0 ? (
                <div className="space-y-3">
                  {returnsData.returnsByReason.map((item, index) => {
                    const maxCount = Math.max(
                      ...returnsData.returnsByReason.map((r) => r.count)
                    );
                    const colors = [
                      "bg-blue-500",
                      "bg-green-500",
                      "bg-orange-500",
                      "bg-purple-500",
                      "bg-pink-500",
                      "bg-red-500",
                    ];
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.reason || "Not Specified"}</span>
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
                <div className="h-32 flex items-center justify-center text-gray-400">
                  No return data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
