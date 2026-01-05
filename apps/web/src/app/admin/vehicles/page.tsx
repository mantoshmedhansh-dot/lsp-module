"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Search,
  Plus,
  RefreshCw,
  Fuel,
  Weight,
  Edit,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { VEHICLE_TYPES } from "@/lib/validations";
import { useHubFilter } from "@/contexts/HubFilterContext";

interface Vehicle {
  id: string;
  registrationNo: string;
  type: string;
  capacityTonnage: number;
  capacityVolumeCBM: number;
  make: string | null;
  model: string | null;
  fuelType: string;
  status: string;
  ownershipType: string;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  isActive: boolean;
}

const VEHICLE_STATUSES = ["AVAILABLE", "IN_TRANSIT", "MAINTENANCE", "BREAKDOWN", "RETIRED"];

async function fetchVehicles(params: { search?: string; status?: string; type?: string; hubId?: string | null }) {
  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", "100");
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.type) searchParams.set("type", params.type);
  if (params.hubId) searchParams.set("hubId", params.hubId);
  const res = await fetch(`/api/vehicles?${searchParams.toString()}`);
  return res.json();
}

async function updateVehicleStatus(vehicleId: string, status: string) {
  const res = await fetch(`/api/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

function getStatusColor(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-100 text-green-800";
    case "IN_TRANSIT":
      return "bg-blue-100 text-blue-800";
    case "MAINTENANCE":
      return "bg-yellow-100 text-yellow-800";
    case "BREAKDOWN":
      return "bg-red-100 text-red-800";
    case "RETIRED":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return date <= thirtyDaysFromNow;
}

export default function AdminVehiclesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-vehicles", searchQuery, selectedStatus, selectedType, selectedHubId],
    queryFn: () =>
      fetchVehicles({
        search: searchQuery || undefined,
        status: selectedStatus || undefined,
        type: selectedType || undefined,
        hubId: selectedHubId,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ vehicleId, status }: { vehicleId: string; status: string }) =>
      updateVehicleStatus(vehicleId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] });
    },
  });

  const vehicles = data?.data?.items || [];

  // Stats
  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v: Vehicle) => v.status === "AVAILABLE").length,
    inTransit: vehicles.filter((v: Vehicle) => v.status === "IN_TRANSIT").length,
    maintenance: vehicles.filter((v: Vehicle) => v.status === "MAINTENANCE").length,
    breakdown: vehicles.filter((v: Vehicle) => v.status === "BREAKDOWN").length,
    expiringDocs: vehicles.filter(
      (v: Vehicle) => isExpiringSoon(v.insuranceExpiry) || isExpiringSoon(v.fitnessExpiry)
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
          <p className="text-gray-500">Manage fleet vehicles and their status</p>
        </div>
        <Link href="/fleet/vehicles/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-2xl font-bold text-green-600">{stats.available}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inTransit}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Breakdown</p>
          <p className="text-2xl font-bold text-red-600">{stats.breakdown}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Expiring Docs</p>
          <p className="text-2xl font-bold text-orange-600">{stats.expiringDocs}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by registration, make, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={selectedStatus || ""}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            {VEHICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={selectedType || ""}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Types</option>
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Vehicles Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading vehicles...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fuel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ownership
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Documents
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.map((vehicle: Vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {vehicle.registrationNo}
                        </p>
                        <p className="text-sm text-gray-500">
                          {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm">{vehicle.type.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Weight className="h-4 w-4 text-gray-400" />
                        {vehicle.capacityTonnage}T / {vehicle.capacityVolumeCBM} CBM
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm">
                        <Fuel className="h-4 w-4 text-gray-400" />
                        {vehicle.fuelType}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          vehicle.ownershipType === "OWNED"
                            ? "bg-green-50 text-green-700"
                            : vehicle.ownershipType === "LEASED"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {vehicle.ownershipType}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={vehicle.status}
                        onChange={(e) =>
                          statusMutation.mutate({
                            vehicleId: vehicle.id,
                            status: e.target.value,
                          })
                        }
                        className={`px-2 py-1 text-xs font-medium rounded border-0 ${getStatusColor(
                          vehicle.status
                        )}`}
                      >
                        {VEHICLE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {(isExpiringSoon(vehicle.insuranceExpiry) ||
                        isExpiringSoon(vehicle.fitnessExpiry)) && (
                        <div className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">Expiring</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/fleet/vehicles/${vehicle.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vehicles.length === 0 && (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No vehicles found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
