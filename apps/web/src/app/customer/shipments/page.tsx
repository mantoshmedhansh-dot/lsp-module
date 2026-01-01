"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Truck,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from "lucide-react";

interface Shipment {
  id: string;
  awbNumber: string;
  status: string;
  originCity: string;
  originPincode: string;
  destinationCity: string;
  destinationPincode: string;
  weightKg: number;
  receiverName: string;
  expectedDeliveryDate: string | null;
  createdAt: string;
  lastScan: {
    scanType: string;
    scanTime: string;
    location: string;
  } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchShipments = async (page = 1) => {
    setLoading(true);
    const token = localStorage.getItem("customer_token");

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/customer/shipments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setShipments(data.data.items);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching shipments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [statusFilter]);

  const statusOptions = [
    { value: "ALL", label: "All Shipments" },
    { value: "BOOKED", label: "Booked" },
    { value: "IN_HUB", label: "In Hub" },
    { value: "IN_TRANSIT", label: "In Transit" },
    { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "FAILED", label: "Failed" },
  ];

  const statusConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
    BOOKED: { icon: Package, color: "text-gray-600", bgColor: "bg-gray-100" },
    PICKED_UP: { icon: Package, color: "text-blue-600", bgColor: "bg-blue-100" },
    IN_HUB: { icon: MapPin, color: "text-blue-600", bgColor: "bg-blue-100" },
    IN_TRANSIT: { icon: Truck, color: "text-amber-600", bgColor: "bg-amber-100" },
    OUT_FOR_DELIVERY: { icon: Truck, color: "text-purple-600", bgColor: "bg-purple-100" },
    DELIVERED: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
    WITH_PARTNER: { icon: Truck, color: "text-cyan-600", bgColor: "bg-cyan-100" },
    FAILED: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  };

  const filteredShipments = searchQuery
    ? shipments.filter(
        (s) =>
          s.awbNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.receiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.destinationCity.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shipments;

  const getSlaStatus = (shipment: Shipment) => {
    if (shipment.status === "DELIVERED") return "delivered";
    if (!shipment.expectedDeliveryDate) return "unknown";

    const now = new Date();
    const expected = new Date(shipment.expectedDeliveryDate);
    const daysRemaining = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return "delayed";
    if (daysRemaining <= 1) return "at_risk";
    return "on_track";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Shipments</h1>
          <p className="text-gray-500">View and track all your shipments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchShipments(pagination.page)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/customer/book"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Package className="h-4 w-4" />
            Book New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by AWB, receiver name, or city..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading shipments...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No shipments found</h3>
          <p className="text-gray-500 mt-2">
            {searchQuery
              ? "Try adjusting your search query"
              : statusFilter !== "ALL"
              ? "No shipments with this status"
              : "You haven't booked any shipments yet"}
          </p>
          {statusFilter === "ALL" && !searchQuery && (
            <Link
              href="/customer/book"
              className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Book Your First Consignment
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    AWB Number
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    Route
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    Consignee
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    SLA
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    Booked
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredShipments.map((shipment) => {
                  const config = statusConfig[shipment.status] || statusConfig.BOOKED;
                  const Icon = config.icon;
                  const slaStatus = getSlaStatus(shipment);

                  return (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/customer/tracking?awb=${shipment.awbNumber}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {shipment.awbNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span>{shipment.originCity}</span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <span>{shipment.destinationCity}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {shipment.originPincode} → {shipment.destinationPincode}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {shipment.receiverName}
                        </p>
                        <p className="text-xs text-gray-500">{shipment.weightKg} kg</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor}`}>
                          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                          <span className={`text-xs font-medium ${config.color}`}>
                            {shipment.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            slaStatus === "on_track"
                              ? "bg-green-50 text-green-600"
                              : slaStatus === "at_risk"
                              ? "bg-amber-50 text-amber-600"
                              : slaStatus === "delayed"
                              ? "bg-red-50 text-red-600"
                              : slaStatus === "delivered"
                              ? "bg-green-50 text-green-600"
                              : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          {slaStatus === "on_track" && "On Track"}
                          {slaStatus === "at_risk" && "At Risk"}
                          {slaStatus === "delayed" && "Delayed"}
                          {slaStatus === "delivered" && "Delivered"}
                          {slaStatus === "unknown" && "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(shipment.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/customer/tracking?awb=${shipment.awbNumber}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Track
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredShipments.map((shipment) => {
              const config = statusConfig[shipment.status] || statusConfig.BOOKED;
              const Icon = config.icon;
              const slaStatus = getSlaStatus(shipment);

              return (
                <Link
                  key={shipment.id}
                  href={`/customer/tracking?awb=${shipment.awbNumber}`}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-blue-600">{shipment.awbNumber}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{shipment.receiverName}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      <span className={`text-xs font-medium ${config.color}`}>
                        {shipment.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{shipment.originCity}</span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span>{shipment.destinationCity}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(shipment.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        slaStatus === "on_track"
                          ? "bg-green-50 text-green-600"
                          : slaStatus === "delayed"
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {slaStatus.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                {pagination.total} shipments
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchShipments(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchShipments(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
