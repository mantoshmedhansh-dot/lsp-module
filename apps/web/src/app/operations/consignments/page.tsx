"use client";

import { useState } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Lock,
  Truck,
  CheckCircle2,
  Clock,
  Box,
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

const STATUS_ICONS: Record<string, any> = {
  OPEN: Box,
  CLOSED: Lock,
  LOADED: Truck,
  IN_TRANSIT: Truck,
  ARRIVED: CheckCircle2,
};

export default function ConsignmentsDashboard() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterHub, setFilterHub] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch consignments
  const { data, isLoading } = useQuery({
    queryKey: ["consignments", filterStatus, filterHub, search],
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

  // Fetch hubs for filter
  const { data: hubsData } = useQuery({
    queryKey: ["hubs"],
    queryFn: async () => {
      const res = await fetch("/api/hubs?pageSize=100");
      return res.json();
    },
  });

  // Close consignment mutation
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
      queryClient.invalidateQueries({ queryKey: ["consignments"] });
    },
  });

  const consignments = data?.data?.items || [];
  const hubs = hubsData?.data?.items || [];

  // Stats
  const stats = {
    open: consignments.filter((c: any) => c.status === "OPEN").length,
    closed: consignments.filter((c: any) => c.status === "CLOSED").length,
    inTransit: consignments.filter((c: any) => c.status === "IN_TRANSIT").length,
    total: consignments.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consignments</h1>
          <p className="text-gray-500">
            Manage shipment consignments for line-haul operations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Consignment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Box className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Open</p>
              <p className="text-xl font-bold">{stats.open}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Lock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Closed</p>
              <p className="text-xl font-bold">{stats.closed}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-xl font-bold">{stats.inTransit}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Package className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search consignment number..."
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
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="LOADED">Loaded</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
          </select>
          <select
            value={filterHub}
            onChange={(e) => setFilterHub(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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

      {/* Consignments List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">
                  Consignment
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Route</th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Shipments
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Weight</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Created
                </th>
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
              ) : consignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No consignments found
                  </td>
                </tr>
              ) : (
                consignments.map((consignment: any) => {
                  const StatusIcon =
                    STATUS_ICONS[consignment.status] || Package;
                  return (
                    <tr key={consignment.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <Link
                          href={`/operations/consignments/${consignment.id}`}
                          className="font-mono font-medium text-primary-600 hover:underline"
                        >
                          {consignment.consignmentNumber}
                        </Link>
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
                        <p className="text-sm text-gray-500">
                          {consignment.originHub?.city} →{" "}
                          {consignment.destinationHub?.city}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <span>
                            {consignment._count?.shipments ||
                              consignment.shipmentCount ||
                              0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {consignment.totalWeightKg?.toFixed(1) || 0} kg
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            (STATUS_COLORS[consignment.status] as any) ||
                            "secondary"
                          }
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
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
                              disabled={closeMutation.isPending}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Close
                            </Button>
                          )}
                          <Link href={`/operations/consignments/${consignment.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateConsignmentModal
          hubs={hubs}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["consignments"] });
          }}
        />
      )}
    </div>
  );
}

// Create Consignment Modal
function CreateConsignmentModal({
  hubs,
  onClose,
  onSuccess,
}: {
  hubs: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [originHubId, setOriginHubId] = useState("");
  const [destinationHubId, setDestinationHubId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/consignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originHubId, destinationHubId, notes }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to create consignment");
        return;
      }

      onSuccess();
    } catch (err) {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <div className="p-5">
          <h2 className="text-lg font-semibold mb-4">Create New Consignment</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origin Hub *
              </label>
              <select
                value={originHubId}
                onChange={(e) => setOriginHubId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Origin Hub</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.code} - {hub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination Hub *
              </label>
              <select
                value={destinationHubId}
                onChange={(e) => setDestinationHubId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Destination Hub</option>
                {hubs
                  .filter((h) => h.id !== originHubId)
                  .map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.code} - {hub.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Optional notes..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Consignment"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
