"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Calendar,
  Package,
  Truck,
  RotateCcw,
  DollarSign,
} from "lucide-react";

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
}

const reportTypes: ReportType[] = [
  {
    id: "sales",
    name: "Sales Report",
    description: "Detailed sales analysis including order values, channels, and trends",
    icon: DollarSign,
    category: "Sales & Revenue",
  },
  {
    id: "sku-sales",
    name: "SKU Wise Sales Report",
    description: "Sales breakdown by individual SKU with quantity and revenue",
    icon: Package,
    category: "Sales & Revenue",
  },
  {
    id: "order-lifecycle",
    name: "Order Life Cycle Report",
    description: "Track orders through each stage from creation to delivery",
    icon: FileText,
    category: "Sales & Revenue",
  },
  {
    id: "inventory",
    name: "Inventory Report",
    description: "Current stock levels, SKU-wise breakdown by location",
    icon: Package,
    category: "Inventory",
  },
  {
    id: "inventory-ageing",
    name: "Inventory Ageing Report",
    description: "Age analysis of inventory stock",
    icon: Calendar,
    category: "Inventory",
  },
  {
    id: "fulfillment",
    name: "Fulfillment Report",
    description: "Order processing and shipment status by location and channel",
    icon: Truck,
    category: "Fulfillment",
  },
  {
    id: "dispatch",
    name: "Dispatch Report",
    description: "Manifested and shipped orders with transporter details",
    icon: Truck,
    category: "Fulfillment",
  },
  {
    id: "returns",
    name: "Returns Report",
    description: "Return analysis by type, reason, and SKU",
    icon: RotateCcw,
    category: "Returns",
  },
  {
    id: "rto",
    name: "RTO Analysis Report",
    description: "Return to Origin orders analysis and trends",
    icon: RotateCcw,
    category: "Returns",
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDownload = async (reportId: string) => {
    if (!dateFrom || !dateTo) {
      alert("Please select date range");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        report: reportId,
        dateFrom,
        dateTo,
        format: "csv",
      });

      const response = await fetch(`/api/v1/client/reports?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportId}-report-${dateFrom}-to-${dateTo}.csv`;
        a.click();
      } else {
        alert("Failed to generate report");
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      alert("Error downloading report");
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(reportTypes.map((r) => r.category))];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">
          Generate and download detailed reports
        </p>
      </div>

      {/* Date Range Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setDateFrom(weekAgo.toISOString().split("T")[0]);
                setDateTo(today.toISOString().split("T")[0]);
              }}
              className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                setDateFrom(monthAgo.toISOString().split("T")[0]);
                setDateTo(today.toISOString().split("T")[0]);
              }}
              className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                setDateFrom(firstDay.toISOString().split("T")[0]);
                setDateTo(today.toISOString().split("T")[0]);
              }}
              className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      {categories.map((category) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-4">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes
              .filter((r) => r.category === category)
              .map((report) => (
                <div
                  key={report.id}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <report.icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{report.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      <button
                        onClick={() => handleDownload(report.id)}
                        disabled={loading || !dateFrom || !dateTo}
                        className="mt-3 flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        <span>{loading ? "Generating..." : "Download CSV"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
