"use client";

import { useState } from "react";
import {
  Package,
  Search,
  Filter,
  ArrowRight,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Handshake,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

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

export default function ShipmentsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["shipments", page, filterStatus, filterMode, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", "20");
      if (filterStatus) params.set("status", filterStatus);
      if (filterMode) params.set("fulfillmentMode", filterMode);
      if (search) params.set("search", search);

      const res = await fetch(`/api/shipments?${params}`);
      return res.json();
    },
  });

  const shipments = data?.data?.items || [];
  const totalPages = data?.data?.totalPages || 1;
  const total = data?.data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500">{total} shipments in system</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">In Hub</p>
              <p className="text-lg font-bold">
                {shipments.filter((s: any) => s.status === "IN_HUB").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-gray-500">In Transit</p>
              <p className="text-lg font-bold">
                {shipments.filter((s: any) => s.status === "IN_TRANSIT").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Handshake className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">With Partner</p>
              <p className="text-lg font-bold">
                {shipments.filter((s: any) => s.status === "WITH_PARTNER").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">Out for Delivery</p>
              <p className="text-lg font-bold">
                {shipments.filter((s: any) => s.status === "OUT_FOR_DELIVERY").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Delivered</p>
              <p className="text-lg font-bold">
                {shipments.filter((s: any) => s.status === "DELIVERED").length}
              </p>
            </div>
          </div>
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
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Modes</option>
            <option value="OWN_FLEET">Own Fleet</option>
            <option value="HYBRID">Hybrid</option>
            <option value="PARTNER">Partner</option>
          </select>
        </div>
      </Card>

      {/* Shipments Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">AWB</th>
                <th className="text-left p-4 font-medium text-gray-600">Route</th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Consignee
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Mode</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">EDD</th>
                <th className="text-right p-4 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No shipments found
                  </td>
                </tr>
              ) : (
                shipments.map((shipment: any) => (
                  <tr key={shipment.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <Link
                        href={`/shipments/${shipment.id}`}
                        className="font-mono font-medium text-primary-600 hover:underline"
                      >
                        {shipment.awbNumber}
                      </Link>
                      {shipment.consignment && (
                        <p className="text-xs text-gray-500">
                          CN: {shipment.consignment.consignmentNumber}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm">
                        <span>{shipment.shipperPincode}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span>{shipment.consigneePincode}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {shipment.shipperCity} → {shipment.consigneeCity}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{shipment.consigneeName}</p>
                      <p className="text-sm text-gray-500">
                        {shipment.consigneePhone}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          (FULFILLMENT_COLORS[shipment.fulfillmentMode] as any) ||
                          "secondary"
                        }
                        size="sm"
                      >
                        {shipment.fulfillmentMode === "OWN_FLEET" && (
                          <Truck className="h-3 w-3 mr-1" />
                        )}
                        {shipment.fulfillmentMode === "HYBRID" && (
                          <Handshake className="h-3 w-3 mr-1" />
                        )}
                        {shipment.fulfillmentMode?.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          (STATUS_COLORS[shipment.status] as any) || "secondary"
                        }
                      >
                        {shipment.status?.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {shipment.expectedDeliveryDate
                        ? new Date(
                            shipment.expectedDeliveryDate
                          ).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/shipments/${shipment.id}`}>
                        <Button variant="ghost" size="sm">
                          Track
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
