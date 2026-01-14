"use client";

import { useState } from "react";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  Search,
  Filter,
  Plus,
  Eye,
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

const mockInbound: InboundShipment[] = [
  {
    id: "1",
    asnNumber: "ASN-2024-001",
    poNumber: "PO-2024-101",
    vendor: "ABC Suppliers",
    location: "Mumbai Warehouse",
    status: "in_transit",
    expectedDate: "2024-01-20",
    totalItems: 500,
    receivedItems: 0,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    asnNumber: "ASN-2024-002",
    poNumber: "PO-2024-102",
    vendor: "XYZ Electronics",
    location: "Delhi Hub",
    status: "qc_pending",
    expectedDate: "2024-01-18",
    receivedDate: "2024-01-18",
    totalItems: 200,
    receivedItems: 195,
    createdAt: "2024-01-12",
  },
  {
    id: "3",
    asnNumber: "ASN-2024-003",
    poNumber: "PO-2024-103",
    vendor: "Fashion House",
    location: "Bangalore Center",
    status: "completed",
    expectedDate: "2024-01-17",
    receivedDate: "2024-01-16",
    totalItems: 1000,
    receivedItems: 998,
    createdAt: "2024-01-10",
  },
  {
    id: "4",
    asnNumber: "ASN-2024-004",
    poNumber: "PO-2024-104",
    vendor: "Beauty Corp",
    location: "Chennai Warehouse",
    status: "pending",
    expectedDate: "2024-01-22",
    totalItems: 350,
    receivedItems: 0,
    createdAt: "2024-01-16",
  },
  {
    id: "5",
    asnNumber: "ASN-2024-005",
    poNumber: "PO-2024-105",
    vendor: "Sports Gear Ltd",
    location: "Mumbai Warehouse",
    status: "received",
    expectedDate: "2024-01-19",
    receivedDate: "2024-01-19",
    totalItems: 150,
    receivedItems: 150,
    createdAt: "2024-01-14",
  },
];

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredInbound = mockInbound.filter((item) => {
    const matchesSearch =
      item.asnNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.vendor.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    pending: mockInbound.filter((s) => s.status === "pending").length,
    in_transit: mockInbound.filter((s) => s.status === "in_transit").length,
    received: mockInbound.filter((s) => s.status === "received").length,
    qc_pending: mockInbound.filter((s) => s.status === "qc_pending").length,
    completed: mockInbound.filter((s) => s.status === "completed").length,
  };

  const totalExpectedItems = mockInbound.reduce(
    (sum, item) => sum + item.totalItems,
    0
  );
  const totalReceivedItems = mockInbound.reduce(
    (sum, item) => sum + item.receivedItems,
    0
  );

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
              <p className="text-2xl font-bold">{mockInbound.length}</p>
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
