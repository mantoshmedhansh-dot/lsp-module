"use client";

import { useState } from "react";
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  MapPin,
  ExternalLink,
} from "lucide-react";

interface Shipment {
  id: string;
  awb: string;
  orderNumber: string;
  transporter: string;
  status: "in_transit" | "out_for_delivery" | "delivered" | "exception" | "pending";
  origin: string;
  destination: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  weight: number;
  createdAt: string;
}

const mockShipments: Shipment[] = [
  {
    id: "1",
    awb: "AWB123456789",
    orderNumber: "ORD-2024-001",
    transporter: "Delhivery",
    status: "in_transit",
    origin: "Mumbai",
    destination: "Delhi",
    estimatedDelivery: "2024-01-20",
    weight: 1.5,
    createdAt: "2024-01-18",
  },
  {
    id: "2",
    awb: "AWB987654321",
    orderNumber: "ORD-2024-002",
    transporter: "BlueDart",
    status: "out_for_delivery",
    origin: "Bangalore",
    destination: "Chennai",
    estimatedDelivery: "2024-01-19",
    weight: 0.8,
    createdAt: "2024-01-17",
  },
  {
    id: "3",
    awb: "AWB456789123",
    orderNumber: "ORD-2024-003",
    transporter: "Shiprocket",
    status: "delivered",
    origin: "Delhi",
    destination: "Jaipur",
    estimatedDelivery: "2024-01-18",
    actualDelivery: "2024-01-17",
    weight: 2.3,
    createdAt: "2024-01-15",
  },
  {
    id: "4",
    awb: "AWB789123456",
    orderNumber: "ORD-2024-004",
    transporter: "Ecom Express",
    status: "exception",
    origin: "Hyderabad",
    destination: "Pune",
    estimatedDelivery: "2024-01-19",
    weight: 1.2,
    createdAt: "2024-01-16",
  },
  {
    id: "5",
    awb: "AWB321654987",
    orderNumber: "ORD-2024-005",
    transporter: "DTDC",
    status: "pending",
    origin: "Kolkata",
    destination: "Patna",
    estimatedDelivery: "2024-01-21",
    weight: 3.5,
    createdAt: "2024-01-18",
  },
];

const statusConfig = {
  pending: {
    label: "Pending Pickup",
    color: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  in_transit: {
    label: "In Transit",
    color: "bg-blue-100 text-blue-700",
    icon: Truck,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "bg-yellow-100 text-yellow-700",
    icon: Package,
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  exception: {
    label: "Exception",
    color: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
};

export default function ShipmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredShipments = mockShipments.filter((shipment) => {
    const matchesSearch =
      shipment.awb.toLowerCase().includes(search.toLowerCase()) ||
      shipment.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: mockShipments.length,
    pending: mockShipments.filter((s) => s.status === "pending").length,
    in_transit: mockShipments.filter((s) => s.status === "in_transit").length,
    out_for_delivery: mockShipments.filter((s) => s.status === "out_for_delivery")
      .length,
    delivered: mockShipments.filter((s) => s.status === "delivered").length,
    exception: mockShipments.filter((s) => s.status === "exception").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600">Track all your shipments in real-time</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === status
                ? "bg-blue-600 text-white"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {status === "all"
              ? "All"
              : status === "in_transit"
              ? "In Transit"
              : status === "out_for_delivery"
              ? "Out for Delivery"
              : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
            ({count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by AWB or Order Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Shipments List */}
        <div className="divide-y">
          {filteredShipments.map((shipment) => {
            const StatusIcon = statusConfig[shipment.status].icon;
            return (
              <div
                key={shipment.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-medium text-gray-900">
                        {shipment.awb}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                          statusConfig[shipment.status].color
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[shipment.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Order: {shipment.orderNumber}</span>
                      <span>|</span>
                      <span>{shipment.transporter}</span>
                      <span>|</span>
                      <span>{shipment.weight} kg</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {shipment.origin} → {shipment.destination}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Est. Delivery:{" "}
                      <span className="font-medium">
                        {new Date(shipment.estimatedDelivery).toLocaleDateString()}
                      </span>
                    </p>
                    {shipment.actualDelivery && (
                      <p className="text-sm text-green-600">
                        Delivered:{" "}
                        {new Date(shipment.actualDelivery).toLocaleDateString()}
                      </p>
                    )}
                    <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 ml-auto">
                      Track <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredShipments.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No shipments found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
