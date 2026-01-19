"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Printer,
  Eye,
  Truck,
  MapPin,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface LorryReceipt {
  id: string;
  lrNumber: string;
  bookingDate: string;
  consigneeName: string;
  consigneeAddress: string;
  destination: string;
  origin: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  totalPackages: number;
  totalWeight: number;
  freightAmount: number;
  status: string;
  deliveredAt: string | null;
}

export default function LRManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lrs, setLrs] = useState<LorryReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("lr") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLrs, setSelectedLrs] = useState<string[]>([]);

  const fetchLRs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/v1/b2b-logistics/lr?${params}`);
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setLrs(items.map((lr: any) => ({
          id: lr.id,
          lrNumber: lr.lrNumber || `LR-${lr.id?.slice(0, 8)}`,
          bookingDate: lr.bookingDate || lr.createdAt,
          consigneeName: lr.consigneeName || lr.consignee?.name || "N/A",
          consigneeAddress: lr.consigneeAddress || lr.deliveryAddress || "N/A",
          destination: lr.destination || lr.deliveryCity || "N/A",
          origin: lr.origin || lr.pickupCity || "N/A",
          vehicleNumber: lr.vehicleNumber || "Not Assigned",
          driverName: lr.driverName || "N/A",
          driverPhone: lr.driverPhone || "-",
          totalPackages: lr.totalPackages || lr.packages || 0,
          totalWeight: lr.totalWeight || lr.weight || 0,
          freightAmount: lr.freightAmount || lr.freight || 0,
          status: lr.status || "BOOKED",
          deliveredAt: lr.deliveredAt,
        })));
        setTotalPages(data.totalPages || Math.ceil((data.total || items.length) / 20));
      } else {
        // Demo data
        setLrs([
          { id: "1", lrNumber: "LR-2026-0001", bookingDate: new Date().toISOString(), consigneeName: "ABC Distributors Pvt Ltd", consigneeAddress: "Plot 45, MIDC Andheri", destination: "Mumbai", origin: "Delhi", vehicleNumber: "MH-12-AB-1234", driverName: "Ramesh Kumar", driverPhone: "9876543210", totalPackages: 25, totalWeight: 450, freightAmount: 12500, status: "IN_TRANSIT", deliveredAt: null },
          { id: "2", lrNumber: "LR-2026-0002", bookingDate: new Date().toISOString(), consigneeName: "XYZ Retailers", consigneeAddress: "Shop 12, Market Yard", destination: "Pune", origin: "Delhi", vehicleNumber: "MH-14-CD-5678", driverName: "Suresh Singh", driverPhone: "9876543211", totalPackages: 15, totalWeight: 280, freightAmount: 8500, status: "DELIVERED", deliveredAt: new Date().toISOString() },
          { id: "3", lrNumber: "LR-2026-0003", bookingDate: new Date().toISOString(), consigneeName: "PQR Traders", consigneeAddress: "Warehouse 5, Industrial Area", destination: "Nagpur", origin: "Delhi", vehicleNumber: "Pending", driverName: "N/A", driverPhone: "-", totalPackages: 40, totalWeight: 850, freightAmount: 18000, status: "BOOKED", deliveredAt: null },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch LRs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchLRs();
  }, [fetchLRs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "IN_TRANSIT":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "POD_PENDING":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: "bg-green-100 text-green-700",
      IN_TRANSIT: "bg-blue-100 text-blue-700",
      BOOKED: "bg-amber-100 text-amber-700",
      POD_PENDING: "bg-orange-100 text-orange-700",
      DISPATCHED: "bg-indigo-100 text-indigo-700",
      CANCELLED: "bg-gray-100 text-gray-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const handleSelectAll = () => {
    if (selectedLrs.length === lrs.length) {
      setSelectedLrs([]);
    } else {
      setSelectedLrs(lrs.map((lr) => lr.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedLrs((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LR Management</h1>
          <p className="text-gray-500">Manage Lorry Receipts for your freight shipments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {/* Export functionality */}}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => router.push("/client/b2b-logistics/lr/new")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create LR
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
              placeholder="Search by LR Number, Consignee, or Vehicle..."
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
            <option value="BOOKED">Booked</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="POD_PENDING">POD Pending</option>
          </select>
          <button
            onClick={fetchLRs}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLrs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">
            {selectedLrs.length} LR(s) selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {/* Print selected */}}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-50"
            >
              <Printer className="h-4 w-4" />
              Print LRs
            </button>
            <button
              onClick={() => setSelectedLrs([])}
              className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* LR Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedLrs.length === lrs.length && lrs.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Freight</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
              ) : lrs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No LRs found</p>
                    <button
                      onClick={() => router.push("/client/b2b-logistics/lr/new")}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Create your first LR
                    </button>
                  </td>
                </tr>
              ) : (
                lrs.map((lr) => (
                  <tr key={lr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLrs.includes(lr.id)}
                        onChange={() => handleSelect(lr.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-blue-600">{lr.lrNumber}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(lr.bookingDate), "dd MMM yyyy")}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{lr.consigneeName}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">{lr.consigneeAddress}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm">
                        <span>{lr.origin}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{lr.destination}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{lr.vehicleNumber}</p>
                        {lr.driverName !== "N/A" && (
                          <p className="text-xs text-gray-500">{lr.driverName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p>{lr.totalPackages} pkgs</p>
                        <p className="text-xs text-gray-500">{lr.totalWeight} kg</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">₹{lr.freightAmount.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(lr.status)}`}>
                        {getStatusIcon(lr.status)}
                        {lr.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/client/b2b-logistics/tracking?lr=${lr.lrNumber}`)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="Track"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/api/print/lr/${lr.id}`, "_blank")}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          title="Print LR"
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
