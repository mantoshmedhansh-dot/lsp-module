"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Package,
  Truck,
  CheckCircle,
} from "lucide-react";

interface FulfillmentData {
  summary: {
    pendingPicklist: number;
    picklistedPendingPick: number;
    pickedPendingPack: number;
    packedPendingManifest: number;
    manifestedPendingShip: number;
  };
  byChannel: {
    channel: string;
    shipByDate: string;
    pendingPicklist: number;
    pendingPick: number;
    pendingPack: number;
    pendingManifest: number;
    pendingShip: number;
  }[];
  byLocation: {
    location: string;
    pendingPicklist: number;
    pendingPick: number;
    pendingPack: number;
    pendingManifest: number;
    pendingShip: number;
  }[];
  shipmentsByDate: { date: string; packed: number; shipped: number }[];
  shipmentsByTransporter: { transporter: string; count: number }[];
}

function StatusCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="opacity-80">
          <Icon className="w-10 h-10" />
        </div>
      </div>
    </div>
  );
}

export default function FulfillmentOverviewPage() {
  const [dateRange, setDateRange] = useState("last7days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FulfillmentData | null>(null);

  useEffect(() => {
    fetchFulfillmentData();
  }, [dateRange]);

  const fetchFulfillmentData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/client/fulfillment?range=${dateRange}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Error fetching fulfillment data:", error);
    } finally {
      setLoading(false);
    }
  };

  const defaultData: FulfillmentData = {
    summary: {
      pendingPicklist: 0,
      picklistedPendingPick: 0,
      pickedPendingPack: 0,
      packedPendingManifest: 0,
      manifestedPendingShip: 0,
    },
    byChannel: [],
    byLocation: [],
    shipmentsByDate: [],
    shipmentsByTransporter: [],
  };

  const fulfillmentData = data || defaultData;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fulfillment Overview</h1>
          <p className="text-sm text-gray-500">
            Track shipment processing status
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
          {/* In Process Shipment Status */}
          <div>
            <h3 className="text-lg font-semibold mb-4">In Process Shipment Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatusCard
                title="Pending Picklist"
                value={fulfillmentData.summary.pendingPicklist}
                icon={Clock}
                color="green"
              />
              <StatusCard
                title="Picklisted Pending Pick"
                value={fulfillmentData.summary.picklistedPendingPick}
                icon={Package}
                color="blue"
              />
              <StatusCard
                title="Picked Pending Pack"
                value={fulfillmentData.summary.pickedPendingPack}
                icon={Package}
                color="orange"
              />
              <StatusCard
                title="Packed Pending Manifest"
                value={fulfillmentData.summary.packedPendingManifest}
                icon={Truck}
                color="purple"
              />
              <StatusCard
                title="Manifested Pending Ship"
                value={fulfillmentData.summary.manifestedPendingShip}
                icon={CheckCircle}
                color="cyan"
              />
            </div>
          </div>

          {/* In Process Shipment by Channel */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">In Process Shipment by Channel</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Channel Name</th>
                    <th className="text-left p-3 text-sm font-medium">Ship by Date</th>
                    <th className="text-center p-3 text-sm font-medium">Pending Picklist</th>
                    <th className="text-center p-3 text-sm font-medium">Pending Pick</th>
                    <th className="text-center p-3 text-sm font-medium">Pending Pack</th>
                    <th className="text-center p-3 text-sm font-medium">Pending Manifest</th>
                    <th className="text-center p-3 text-sm font-medium">Pending Ship</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fulfillmentData.byChannel.length > 0 ? (
                    fulfillmentData.byChannel.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">{row.channel}</td>
                        <td className="p-3 text-sm">
                          {row.shipByDate
                            ? new Date(row.shipByDate).toLocaleDateString("en-IN")
                            : "-"}
                        </td>
                        <td className="p-3 text-center text-sm">{row.pendingPicklist}</td>
                        <td className="p-3 text-center text-sm">{row.pendingPick}</td>
                        <td className="p-3 text-center text-sm">{row.pendingPack}</td>
                        <td className="p-3 text-center text-sm">{row.pendingManifest}</td>
                        <td className="p-3 text-center text-sm">{row.pendingShip}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">
                        No pending shipments
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fulfillment Report by Location */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Fulfillment Report by Location</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700 text-white">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Location</th>
                    <th className="text-center p-3 text-sm font-medium">
                      Pending For Inventory
                    </th>
                    <th className="text-center p-3 text-sm font-medium">
                      Pending Picklist
                    </th>
                    <th className="text-center p-3 text-sm font-medium">
                      Pending Packed
                    </th>
                    <th className="text-center p-3 text-sm font-medium">
                      Pending Manifest
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fulfillmentData.byLocation.length > 0 ? (
                    fulfillmentData.byLocation.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">{row.location}</td>
                        <td className="p-3 text-center text-sm">{row.pendingPicklist}</td>
                        <td className="p-3 text-center text-sm">{row.pendingPick}</td>
                        <td className="p-3 text-center text-sm">{row.pendingPack}</td>
                        <td className="p-3 text-center text-sm">{row.pendingManifest}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">
                        No location data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Packages Packed and Shipped */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                Packages Packed and Shipped - By Date
              </h3>
              <div className="h-64">
                {fulfillmentData.shipmentsByDate.length > 0 ? (
                  <div className="h-full flex items-end space-x-2">
                    {fulfillmentData.shipmentsByDate.map((item, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex space-x-1">
                          <div
                            className="flex-1 bg-blue-500 rounded-t"
                            style={{
                              height: `${Math.max(
                                (item.packed /
                                  Math.max(
                                    ...fulfillmentData.shipmentsByDate.map(
                                      (d) => Math.max(d.packed, d.shipped)
                                    )
                                  )) *
                                  180,
                                4
                              )}px`,
                            }}
                          ></div>
                          <div
                            className="flex-1 bg-red-500 rounded-t"
                            style={{
                              height: `${Math.max(
                                (item.shipped /
                                  Math.max(
                                    ...fulfillmentData.shipmentsByDate.map(
                                      (d) => Math.max(d.packed, d.shipped)
                                    )
                                  )) *
                                  180,
                                4
                              )}px`,
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
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
              <div className="flex justify-center space-x-4 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm">Packed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm">Shipped</span>
                </div>
              </div>
            </div>

            {/* Shipments by Transporter */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Shipment By Transporter</h3>
              <div className="h-64">
                {fulfillmentData.shipmentsByTransporter.length > 0 ? (
                  <div className="space-y-3">
                    {fulfillmentData.shipmentsByTransporter.map((item, index) => {
                      const maxCount = Math.max(
                        ...fulfillmentData.shipmentsByTransporter.map((t) => t.count)
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
                            <span>{item.transporter}</span>
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
        </>
      )}
    </div>
  );
}
