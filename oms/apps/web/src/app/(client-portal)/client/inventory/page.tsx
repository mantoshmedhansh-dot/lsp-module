"use client";

import { useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

interface InventoryData {
  summary: {
    totalSaleableQty: number;
    totalDamagedQty: number;
    totalInprocessQty: number;
    distinctSkuInStock: number;
    skuInStockPercent: number;
  };
  inboundByDate: { date: string; quantity: number; skuCount: number }[];
  lowStockSkus: { skuCode: string; skuName: string; quantity: number; reorderLevel: number }[];
  inventoryByLocation: { location: string; quantity: number; skuCount: number }[];
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
    blue: "bg-blue-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
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

export default function InventoryOverviewPage() {
  const [dateRange, setDateRange] = useState("last7days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InventoryData | null>(null);

  useEffect(() => {
    fetchInventoryData();
  }, [dateRange]);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/client/inventory?range=${dateRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  const defaultData: InventoryData = {
    summary: {
      totalSaleableQty: 0,
      totalDamagedQty: 0,
      totalInprocessQty: 0,
      distinctSkuInStock: 0,
      skuInStockPercent: 0,
    },
    inboundByDate: [],
    lowStockSkus: [],
    inventoryByLocation: [],
  };

  const inventoryData = data || defaultData;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Overview</h1>
          <p className="text-sm text-gray-500">Monitor your stock levels</p>
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
          {/* Inventory Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Inventory Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KPICard
                title="Total Saleable Qty"
                value={inventoryData.summary.totalSaleableQty}
                icon={Package}
                color="blue"
              />
              <KPICard
                title="Total Damaged Qty"
                value={inventoryData.summary.totalDamagedQty}
                icon={AlertTriangle}
                color="red"
              />
              <KPICard
                title="Total Inprocess Qty"
                value={inventoryData.summary.totalInprocessQty}
                icon={Clock}
                color="yellow"
              />
              <KPICard
                title="Distinct SKU in Stock"
                value={inventoryData.summary.distinctSkuInStock}
                icon={Package}
                color="green"
              />
              <KPICard
                title="% SKU in Stock"
                value={`${inventoryData.summary.skuInStockPercent.toFixed(1)}%`}
                icon={CheckCircle}
                color="purple"
              />
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Qty Received by Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Qty Received - By Date</h3>
              <div className="h-64">
                {inventoryData.inboundByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {inventoryData.inboundByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{
                            height: `${Math.max(
                              (item.quantity /
                                Math.max(
                                  ...inventoryData.inboundByDate.map((d) => d.quantity)
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
                    No inbound data available
                  </div>
                )}
              </div>
            </div>

            {/* Distinct SKU Received by Date */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                Distinct SKU Received - By Date
              </h3>
              <div className="h-64">
                {inventoryData.inboundByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {inventoryData.inboundByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-green-500 rounded-t"
                          style={{
                            height: `${Math.max(
                              (item.skuCount /
                                Math.max(
                                  ...inventoryData.inboundByDate.map((d) => d.skuCount)
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
                    No inbound data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock SKUs */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Low Stock SKUs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">
                        SKU
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Current Stock
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Reorder Level
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventoryData.lowStockSkus.length > 0 ? (
                      inventoryData.lowStockSkus.map((sku, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium text-sm">{sku.skuCode}</div>
                            <div className="text-xs text-gray-500">{sku.skuName}</div>
                          </td>
                          <td
                            className={`p-3 text-right text-sm font-medium ${
                              sku.quantity <= sku.reorderLevel
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {sku.quantity}
                          </td>
                          <td className="p-3 text-right text-sm">{sku.reorderLevel}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No low stock items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory by Location */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Inventory by Location</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">
                        Location
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        Total Qty
                      </th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">
                        SKU Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventoryData.inventoryByLocation.length > 0 ? (
                      inventoryData.inventoryByLocation.map((loc, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 text-sm font-medium">{loc.location}</td>
                          <td className="p-3 text-right text-sm">
                            {loc.quantity.toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 text-right text-sm">{loc.skuCount}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No location data
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
