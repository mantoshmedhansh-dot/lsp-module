"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Download,
  Plus,
  Package,
  Truck,
  RotateCcw,
  CheckCircle,
  Clock,
  RefreshCw,
  Printer,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  Input,
} from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  awbNumber: string | null;
  customerName: string;
  deliveryCity: string;
  deliveryPincode: string;
  status: string;
  paymentMode: string;
  codAmount: number;
  manifestedAt: string | null;
  createdAt: string;
  partner?: {
    displayName: string;
  };
}

interface OrdersResponse {
  data: {
    items: Order[];
    total: number;
    page: number;
    pageSize: number;
  };
}

const ORDER_STATES = [
  { key: "all", label: "All Orders", icon: Package },
  { key: "MANIFESTED", label: "Manifested", icon: Clock },
  { key: "IN_TRANSIT", label: "In Transit", icon: Truck },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle },
  { key: "RTO", label: "Returned", icon: RotateCcw },
];

async function fetchOrders(status: string, search: string, page: number): Promise<OrdersResponse> {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", page.toString());
  params.set("pageSize", "20");

  const res = await fetch(`/api/client/orders?${params.toString()}`);
  return res.json();
}

export default function ClientOrdersPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";

  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-orders", selectedStatus, searchQuery, page],
    queryFn: () => fetchOrders(selectedStatus, searchQuery, page),
  });

  const orders = data?.data?.items || [];
  const total = data?.data?.total || 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar - Order States */}
      <div className="w-48 flex-shrink-0">
        <Card className="p-2">
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
            Order States
          </h3>
          <div className="space-y-1">
            {ORDER_STATES.map((state) => (
              <button
                key={state.key}
                onClick={() => {
                  setSelectedStatus(state.key);
                  setPage(1);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                  selectedStatus === state.key
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <state.icon className="h-4 w-4" />
                  <span>{state.label}</span>
                </div>
                {selectedStatus === state.key && (
                  <Badge variant="primary" size="sm">
                    {total}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {ORDER_STATES.find((s) => s.key === selectedStatus)?.label || "All Orders"}
            </h1>
            <p className="text-sm text-gray-500">{total} orders</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Link href="/client/orders/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <form onSubmit={handleSearch} className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by AWB, Order Number, or Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button type="submit" variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </Card>

        {/* Orders Table */}
        <Card>
          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No orders found</p>
              <Link href="/client/orders/new">
                <Button variant="outline" className="mt-4">
                  Create Your First Order
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input type="checkbox" className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Order / AWB
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Destination
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Partner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {order.orderNumber}
                          </p>
                          {order.awbNumber && (
                            <p className="text-sm text-gray-500">
                              {order.awbNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-900">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.deliveryCity} - {order.deliveryPincode}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={order.paymentMode === "COD" ? "warning" : "info"}
                          size="sm"
                        >
                          {order.paymentMode}
                        </Badge>
                        {order.paymentMode === "COD" && (
                          <p className="text-xs text-gray-500 mt-1">
                            ₹{order.codAmount}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {order.partner?.displayName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/client/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          {order.awbNumber && (
                            <>
                              <Button variant="ghost" size="sm">
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </>
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
          {total > 20 && (
            <div className="px-4 py-3 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of{" "}
                {total} results
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
