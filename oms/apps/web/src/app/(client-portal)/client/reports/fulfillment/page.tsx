"use client";

import { useState } from "react";
import {
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function FulfillmentReportPage() {
  const [dateRange, setDateRange] = useState("30days");

  const fulfillmentData = {
    totalShipments: 2450,
    delivered: 2180,
    inTransit: 185,
    pending: 45,
    exceptions: 40,
    avgDeliveryTime: 3.2,
    onTimeRate: 94.5,
    slaCompliance: 96.2,
  };

  const courierPerformance = [
    {
      courier: "Delhivery",
      shipments: 850,
      delivered: 785,
      avgTime: 2.8,
      sla: 97.2,
    },
    {
      courier: "BlueDart",
      shipments: 620,
      delivered: 580,
      avgTime: 2.5,
      sla: 98.1,
    },
    {
      courier: "Shiprocket",
      shipments: 480,
      delivered: 445,
      avgTime: 3.5,
      sla: 94.5,
    },
    {
      courier: "Ecom Express",
      shipments: 320,
      delivered: 290,
      avgTime: 3.8,
      sla: 92.8,
    },
    { courier: "DTDC", shipments: 180, delivered: 160, avgTime: 4.2, sla: 90.5 },
  ];

  const zonePerformance = [
    { zone: "North", shipments: 680, avgTime: 2.5, onTime: 96.2 },
    { zone: "South", shipments: 520, avgTime: 3.0, onTime: 94.8 },
    { zone: "East", shipments: 380, avgTime: 3.5, onTime: 92.5 },
    { zone: "West", shipments: 620, avgTime: 2.8, onTime: 95.5 },
    { zone: "Central", shipments: 250, avgTime: 3.2, onTime: 93.8 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fulfillment Report</h1>
          <p className="text-gray-600">
            Shipping performance and delivery analytics
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold">
                {fulfillmentData.totalShipments.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">
                {fulfillmentData.delivered.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                {((fulfillmentData.delivered / fulfillmentData.totalShipments) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Delivery Time</p>
              <p className="text-2xl font-bold">{fulfillmentData.avgDeliveryTime} days</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SLA Compliance</p>
              <p className="text-2xl font-bold text-green-600">
                {fulfillmentData.slaCompliance}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courier Performance */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Courier Performance
            </h2>
            <p className="text-sm text-gray-600">Performance by logistics partner</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">
                    Courier
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Shipments
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    Avg Time
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">
                    SLA %
                  </th>
                </tr>
              </thead>
              <tbody>
                {courierPerformance.map((courier, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{courier.courier}</td>
                    <td className="py-3 px-4 text-right">{courier.shipments}</td>
                    <td className="py-3 px-4 text-right">{courier.avgTime}d</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-medium ${
                          courier.sla >= 95
                            ? "text-green-600"
                            : courier.sla >= 90
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {courier.sla}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Zone Performance */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Zone Performance</h2>
            <p className="text-sm text-gray-600">Delivery performance by region</p>
          </div>
          <div className="divide-y">
            {zonePerformance.map((zone, index) => (
              <div
                key={index}
                className="p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{zone.zone}</p>
                  <p className="text-sm text-gray-500">
                    {zone.shipments} shipments
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{zone.avgTime}d avg</p>
                  <p
                    className={`text-sm ${
                      zone.onTime >= 95
                        ? "text-green-600"
                        : zone.onTime >= 90
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {zone.onTime}% on-time
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
