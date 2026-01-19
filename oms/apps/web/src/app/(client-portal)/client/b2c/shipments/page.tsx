"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Package,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  MapPin,
  Phone,
  Clock,
  Truck,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface Shipment {
  id: string;
  awbNumber: string;
  orderNumber: string;
  consigneeName: string;
  consigneePhone: string;
  destination: string;
  pincode: string;
  status: string;
  paymentMode: string;
  amount: number;
  weight: number;
  courier: string;
  createdAt: string;
  deliveredAt: string | null;
}

export default function B2CShipmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("awb") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);

  const fetchShipments = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("paymentMode", paymentFilter);

      // Use B2C Courier shipments API
      const response = await fetch(`/api/v1/shipments?${params}`);
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setShipments(items.map((d: any) => ({
          id: d.id,
          awbNumber: d.awbNo || d.shipmentNo || "Pending",
          orderNumber: d.orderReference || d.shipmentNo || "-",
          consigneeName: d.consigneeName || "N/A",
          consigneePhone: d.consigneePhone || "-",
          destination: d.deliveryAddress?.city || "N/A",
          pincode: d.deliveryAddress?.pincode || "-",
          status: d.status || "PENDING",
          paymentMode: d.paymentMode || "PREPAID",
          amount: d.codAmount || 0,
          weight: d.weight || 0,
          courier: d.courierName || "Not Assigned",
          createdAt: d.createdAt,
          deliveredAt: d.deliveredDate,
        })));
        setTotalPages(data.totalPages || Math.ceil((data.total || items.length) / 20));
      }
    } catch (error) {
      console.error("Failed to fetch shipments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, paymentFilter]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "IN_TRANSIT":
      case "OUT_FOR_DELIVERY":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "NDR":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "RTO":
      case "RTO_DELIVERED":
        return <XCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: "bg-green-100 text-green-700",
      IN_TRANSIT: "bg-blue-100 text-blue-700",
      OUT_FOR_DELIVERY: "bg-amber-100 text-amber-700",
      PICKED_UP: "bg-indigo-100 text-indigo-700",
      NDR: "bg-red-100 text-red-700",
      RTO: "bg-orange-100 text-orange-700",
      RTO_DELIVERED: "bg-orange-100 text-orange-700",
      CANCELLED: "bg-gray-100 text-gray-700",
      PENDING: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const handleSelectAll = () => {
    if (selectedShipments.length === shipments.length) {
      setSelectedShipments([]);
    } else {
      setSelectedShipments(shipments.map((s) => s.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedShipments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    if (selectedShipments.length === 0) return;
    // Open print labels for selected shipments
    const awbs = shipments
      .filter((s) => selectedShipments.includes(s.id))
      .map((s) => s.awbNumber)
      .join(",");
    window.open(`/api/print/labels?awbs=${awbs}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
          <p className="text-gray-500">Manage and track all your B2C shipments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/client/b2c/shipments/bulk")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => router.push("/client/b2c/shipments/new")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Shipment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by AWB, Order No, or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending Pickup</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="NDR">NDR</option>
            <option value="RTO">RTO</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Payment</option>
            <option value="COD">COD</option>
            <option value="PREPAID">Prepaid</option>
          </select>
          <button
            onClick={fetchShipments}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedShipments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">
            {selectedShipments.length} shipment(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkPrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-50"
            >
              <Printer className="h-4 w-4" />
              Print Labels
            </button>
            <button
              onClick={() => setSelectedShipments([])}
              className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Shipments Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedShipments.length === shipments.length && shipments.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AWB / Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No shipments found</p>
                    <button
                      onClick={() => router.push("/client/b2c/shipments/new")}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Create your first shipment
                    </button>
                  </td>
                </tr>
              ) : (
                shipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={() => handleSelect(shipment.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{shipment.awbNumber}</p>
                        <p className="text-xs text-gray-500">{shipment.orderNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm">{shipment.consigneeName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {shipment.consigneePhone}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-sm">{shipment.destination}</span>
                        <span className="text-xs text-gray-500">({shipment.pincode})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(shipment.status)}`}>
                        {getStatusIcon(shipment.status)}
                        {shipment.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        shipment.paymentMode === "COD" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                      }`}>
                        {shipment.paymentMode}
                      </span>
                      {shipment.paymentMode === "COD" && (
                        <p className="text-xs text-gray-500 mt-1">₹{shipment.amount}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{shipment.courier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {format(new Date(shipment.createdAt), "dd MMM")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/client/logistics/tracking?awb=${shipment.awbNumber}`)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="Track"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/api/print/label/${shipment.id}`, "_blank")}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="Print Label"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
