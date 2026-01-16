"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Truck,
} from "lucide-react";

interface Order {
  id: string;
  orderNo: string;
  externalOrderNo: string | null;
  channel: string;
  paymentMode: string;
  status: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  orderDate: string;
  items: {
    id: string;
    quantity: number;
    sku: {
      code: string;
      name: string;
    };
  }[];
  deliveries: {
    id: string;
    awbNo: string | null;
    status: string;
  }[];
}

const statusColors: Record<string, string> = {
  CREATED: "bg-gray-100 text-gray-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  ALLOCATED: "bg-indigo-100 text-indigo-800",
  PARTIALLY_ALLOCATED: "bg-yellow-100 text-yellow-800",
  PICKLIST_GENERATED: "bg-purple-100 text-purple-800",
  PICKING: "bg-purple-100 text-purple-800",
  PICKED: "bg-cyan-100 text-cyan-800",
  PACKING: "bg-cyan-100 text-cyan-800",
  PACKED: "bg-teal-100 text-teal-800",
  MANIFESTED: "bg-orange-100 text-orange-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-green-100 text-green-800",
  RTO_INITIATED: "bg-red-100 text-red-800",
  RTO_IN_TRANSIT: "bg-red-100 text-red-800",
  RTO_DELIVERED: "bg-red-100 text-red-800",
  CANCELLED: "bg-red-100 text-red-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
};

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    channel: "",
    paymentMode: "",
    dateFrom: "",
    dateTo: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [page, filters]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.channel && { channel: filters.channel }),
        ...(filters.paymentMode && { paymentMode: filters.paymentMode }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });

      const response = await fetch(`/api/v1/client/orders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: "csv",
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.channel && { channel: filters.channel }),
        ...(filters.paymentMode && { paymentMode: filters.paymentMode }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });

      const response = await fetch(`/api/v1/client/orders?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
      }
    } catch (error) {
      console.error("Error exporting orders:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Enquiry</h1>
          <p className="text-sm text-gray-500">
            View and search all your orders
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Order No, Customer Name, AWB..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? "bg-blue-50 border-blue-500 text-blue-600" : "hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="CREATED">Created</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="ALLOCATED">Allocated</option>
                <option value="PICKED">Picked</option>
                <option value="PACKED">Packed</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel
              </label>
              <select
                value={filters.channel}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Channels</option>
                <option value="AMAZON">Amazon</option>
                <option value="FLIPKART">Flipkart</option>
                <option value="MYNTRA">Myntra</option>
                <option value="SHOPIFY">Shopify</option>
                <option value="WEBSITE">Website</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Mode
              </label>
              <select
                value={filters.paymentMode}
                onChange={(e) =>
                  setFilters({ ...filters, paymentMode: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="PREPAID">Prepaid</option>
                <option value="COD">COD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters({ ...filters, dateTo: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {orders.length} of {totalCount} orders
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Package className="w-12 h-12 mb-4" />
            <p>No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700 text-white">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Order No</th>
                  <th className="text-left p-3 text-sm font-medium">Date</th>
                  <th className="text-left p-3 text-sm font-medium">Channel</th>
                  <th className="text-left p-3 text-sm font-medium">Customer</th>
                  <th className="text-left p-3 text-sm font-medium">Items</th>
                  <th className="text-left p-3 text-sm font-medium">Amount</th>
                  <th className="text-left p-3 text-sm font-medium">Payment</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">AWB</th>
                  <th className="text-center p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-blue-600">{order.orderNo}</div>
                      {order.externalOrderNo && (
                        <div className="text-xs text-gray-500">
                          {order.externalOrderNo}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      {new Date(order.orderDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
                        {order.channel}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-sm font-medium">{order.customerName}</div>
                      <div className="text-xs text-gray-500">{order.customerPhone}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {order.items.length} item(s)
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.items.slice(0, 2).map((i) => i.sku.code).join(", ")}
                        {order.items.length > 2 && "..."}
                      </div>
                    </td>
                    <td className="p-3 font-medium">
                      ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          order.paymentMode === "COD"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {order.paymentMode}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          statusColors[order.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {order.deliveries[0]?.awbNo || "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => window.open(`/client/sales/orders/${order.id}`, "_blank")}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {order.deliveries[0]?.awbNo && (
                          <button
                            onClick={() => {
                              // Open tracking URL
                            }}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Track Shipment"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
