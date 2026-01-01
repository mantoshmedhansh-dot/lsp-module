"use client";

import { useState } from "react";
import {
  Layers,
  Search,
  Plus,
  ArrowRight,
  Package,
  Lock,
  Truck,
  CheckCircle2,
  Box,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "warning",
  CLOSED: "info",
  LOADED: "primary",
  IN_TRANSIT: "success",
  ARRIVED: "success",
};

export default function AdminConsignmentsPage() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterHub, setFilterHub] = useState<string>("");
  const [search, setSearch] = useState("");

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-consignments", filterStatus, filterHub, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterHub) params.set("originHubId", filterHub);
      if (search) params.set("search", search);
      params.set("pageSize", "50");

      const res = await fetch(`/api/consignments?${params}`);
      return res.json();
    },
  });

  const { data: hubsData } = useQuery({
    queryKey: ["hubs-list"],
    queryFn: async () => {
      const res = await fetch("/api/hubs?pageSize=100");
      return res.json();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (consignmentId: string) => {
      const res = await fetch(`/api/consignments/${consignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLOSE" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-consignments"] });
    },
  });

  const consignments = data?.data?.items || [];
  const hubs = hubsData?.data?.items || [];

  const stats = {
    total: consignments.length,
    open: consignments.filter((c: any) => c.status === "OPEN").length,
    closed: consignments.filter((c: any) => c.status === "CLOSED").length,
    inTransit: consignments.filter((c: any) => c.status === "IN_TRANSIT").length,
    arrived: consignments.filter((c: any) => c.status === "ARRIVED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consignment Management</h1>
          <p className="text-gray-500">Manage shipment groupings for line-haul</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/operations/consignments">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Consignment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Open</p>
          <p className="text-2xl font-bold text-amber-600">{stats.open}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Closed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.closed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="text-2xl font-bold text-purple-600">{stats.inTransit}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Arrived</p>
          <p className="text-2xl font-bold text-green-600">{stats.arrived}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search consignment number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="LOADED">Loaded</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
          </select>
          <select
            value={filterHub}
            onChange={(e) => setFilterHub(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Hubs</option>
            {hubs.map((hub: any) => (
              <option key={hub.id} value={hub.id}>
                {hub.code} - {hub.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">Consignment #</th>
                <th className="text-left p-4 font-medium text-gray-600">Route</th>
                <th className="text-left p-4 font-medium text-gray-600">Shipments</th>
                <th className="text-left p-4 font-medium text-gray-600">Weight</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Created</th>
                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : consignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No consignments found
                  </td>
                </tr>
              ) : (
                consignments.map((consignment: any) => (
                  <tr key={consignment.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono font-medium">
                        {consignment.consignmentNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {consignment.originHub?.code || "-"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">
                          {consignment.destinationHub?.code || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span>{consignment._count?.shipments || consignment.shipmentCount || 0}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {consignment.totalWeightKg?.toFixed(1) || 0} kg
                    </td>
                    <td className="p-4">
                      <Badge variant={(STATUS_COLORS[consignment.status] as any) || "secondary"}>
                        {consignment.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(consignment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {consignment.status === "OPEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => closeMutation.mutate(consignment.id)}
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Close
                          </Button>
                        )}
                        <Link href={`/operations/consignments/${consignment.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
