"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  Search,
  Plus,
  Eye,
  Loader2,
} from "lucide-react";

interface InboundShipment {
  id: string;
  asnNumber: string;
  poNumber: string;
  vendor: string;
  location: string;
  status: "pending" | "in_transit" | "received" | "qc_pending" | "completed";
  expectedDate: string;
  receivedDate?: string;
  totalItems: number;
  receivedItems: number;
  createdAt: string;
}

const statusConfig = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700", icon: Clock },
  in_transit: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-700",
    icon: Truck,
  },
  received: {
    label: "Received",
    color: "bg-yellow-100 text-yellow-700",
    icon: Package,
  },
  qc_pending: {
    label: "QC Pending",
    color: "bg-orange-100 text-orange-700",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
};

export default function InboundPage() {
  const [inboundItems, setInboundItems] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/v1/client/inventory/inbound?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch inbound data");

      const data = await response.json();
      setInboundItems(data.shipments || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredInbound = inboundItems;

  const statusCounts = {
    pending: inboundItems.filter((s) => s.status === "pending").length,
    in_transit: inboundItems.filter((s) => s.status === "in_transit").length,
    received: inboundItems.filter((s) => s.status === "received").length,
    qc_pending: inboundItems.filter((s) => s.status === "qc_pending").length,
    completed: inboundItems.filter((s) => s.status === "completed").length,
  };

  const totalExpectedItems = inboundItems.reduce(
    (sum, item) => sum + item.totalItems,
    0
  );
  const totalReceivedItems = inboundItems.reduce(
    (sum, item) => sum + item.receivedItems,
    0
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Inbound Shipments</h1>
          <p className="text-gray-600">Track incoming inventory shipments</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Create ASN
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold">{inboundItems.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-blue-600">
                {statusCounts.in_transit}
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
              <p className="text-sm text-gray-600">QC Pending</p>
              <p className="text-2xl font-bold text-orange-600">
                {statusCounts.qc_pending}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receive Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {totalExpectedItems > 0
                  ? ((totalReceivedItems / totalExpectedItems) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ASN, PO, or Vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="qc_pending">QC Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  ASN / PO
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Vendor
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Location
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">
                  Items
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Expected Date
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInbound.map((item) => {
                const StatusIcon = statusConfig[item.status].icon;
                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.asnNumber}
                        </p>
                        <p className="text-sm text-gray-500">{item.poNumber}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{item.vendor}</td>
                    <td className="py-4 px-4 text-gray-600">{item.location}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="font-medium">
                        {item.receivedItems}/{item.totalItems}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {new Date(item.expectedDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                          statusConfig[item.status].color
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[item.status].label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button className="text-blue-600 hover:text-blue-700">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInbound.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No inbound shipments found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
