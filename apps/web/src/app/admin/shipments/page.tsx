"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Search,
  Filter,
  ArrowRight,
  Truck,
  Handshake,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useHubFilter } from "@/contexts/HubFilterContext";

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "secondary",
  PICKED_UP: "info",
  IN_HUB: "primary",
  CONSOLIDATED: "primary",
  LOADED: "primary",
  IN_TRANSIT: "warning",
  WITH_PARTNER: "purple",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  DELIVERY_FAILED: "danger",
  RTO_INITIATED: "danger",
};

const FULFILLMENT_COLORS: Record<string, string> = {
  OWN_FLEET: "success",
  HYBRID: "warning",
  PARTNER: "purple",
};

export default function AdminShipmentsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("");
  const [search, setSearch] = useState("");
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-shipments", page, filterStatus, filterMode, selectedHubId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", "25");
      if (filterStatus) params.set("status", filterStatus);
      if (filterMode) params.set("fulfillmentMode", filterMode);
      if (selectedHubId) params.set("hubId", selectedHubId);
      if (search) params.set("search", search);

      const res = await fetch(`/api/shipments?${params}`);
      return res.json();
    },
  });

  const shipments = data?.data?.items || [];
  const totalPages = data?.data?.totalPages || 1;
  const total = data?.data?.total || 0;

  // Calculate stats
  const stats = {
    total,
    inHub: shipments.filter((s: any) => s.status === "IN_HUB").length,
    inTransit: shipments.filter((s: any) => s.status === "IN_TRANSIT").length,
    withPartner: shipments.filter((s: any) => s.status === "WITH_PARTNER").length,
    delivered: shipments.filter((s: any) => s.status === "DELIVERED").length,
    failed: shipments.filter((s: any) => s.status === "DELIVERY_FAILED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipment Management</h1>
          <p className="text-gray-500">
            {total} total shipments in the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">In Hub</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inHub}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="text-2xl font-bold text-amber-600">{stats.inTransit}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">With Partner</p>
          <p className="text-2xl font-bold text-purple-600">{stats.withPartner}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search AWB, name, phone..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="BOOKED">Booked</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_HUB">In Hub</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="WITH_PARTNER">With Partner</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="DELIVERY_FAILED">Failed</option>
          </select>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Modes</option>
            <option value="OWN_FLEET">Own Fleet</option>
            <option value="HYBRID">Hybrid</option>
            <option value="PARTNER">Partner</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">AWB</th>
                <th className="text-left p-4 font-medium text-gray-600">Route</th>
                <th className="text-left p-4 font-medium text-gray-600">Consignee</th>
                <th className="text-left p-4 font-medium text-gray-600">Mode</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Current Hub</th>
                <th className="text-left p-4 font-medium text-gray-600">Created</th>
                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No shipments found
                  </td>
                </tr>
              ) : (
                shipments.map((shipment: any) => (
                  <tr key={shipment.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono font-medium text-primary-600">
                        {shipment.awbNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm">
                        <span>{shipment.shipperPincode}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span>{shipment.consigneePincode}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{shipment.consigneeName}</p>
                      <p className="text-sm text-gray-500">{shipment.consigneeCity}</p>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={(FULFILLMENT_COLORS[shipment.fulfillmentMode] as any) || "secondary"}
                        size="sm"
                      >
                        {shipment.fulfillmentMode?.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={(STATUS_COLORS[shipment.status] as any) || "secondary"}
                      >
                        {shipment.status?.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {shipment.currentHubId ? "In Hub" : "-"}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(shipment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/shipments/${shipment.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
