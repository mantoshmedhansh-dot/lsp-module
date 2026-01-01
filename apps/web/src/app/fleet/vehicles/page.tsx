"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Search,
  Filter,
  ChevronRight,
  Plus,
  RefreshCw,
  Fuel,
  Weight,
  Box,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { VEHICLE_TYPES } from "@/lib/validations";

interface Vehicle {
  id: string;
  registrationNo: string;
  type: string;
  capacityTonnage: number;
  capacityVolumeCBM: number;
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string;
  status: string;
  currentHubId: string | null;
  ownershipType: string;
  isActive: boolean;
  createdAt: string;
}

const VEHICLE_STATUSES = ["AVAILABLE", "IN_TRANSIT", "MAINTENANCE", "BREAKDOWN", "RETIRED"];

async function fetchVehicles(params: {
  page: number;
  type?: string;
  status?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  if (params.type) searchParams.set("type", params.type);
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/vehicles?${searchParams.toString()}`);
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

function getTypeLabel(type: string) {
  return type.replace(/_/g, " ");
}

export default function VehiclesPage() {
  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["vehicles", page, selectedType, selectedStatus, searchQuery],
    queryFn: () =>
      fetchVehicles({
        page,
        type: selectedType || undefined,
        status: selectedStatus || undefined,
        search: searchQuery || undefined,
      }),
  });

  const vehicles = data?.data?.items || [];
  const pagination = data?.data || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-600">Manage your fleet vehicles</p>
        </div>
        <Link href="/fleet/vehicles/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedStatus(null)}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            !selectedStatus
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border hover:bg-gray-50"
          }`}
        >
          All Status
        </button>
        {VEHICLE_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            {status.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
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
            value={selectedType || ""}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Types</option>
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {getTypeLabel(type)}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Vehicles Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading vehicles...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No vehicles found</p>
            <Link href="/fleet/vehicles/new" className="mt-4 inline-block">
              <Button size="sm">Add your first vehicle</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle: Vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {vehicle.registrationNo}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getTypeLabel(vehicle.type)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                      vehicle.status
                    )}`}
                  >
                    {vehicle.status}
                  </span>
                </div>

                {/* Details */}
                {(vehicle.make || vehicle.model) && (
                  <p className="text-sm text-gray-600 mb-3">
                    {[vehicle.make, vehicle.model, vehicle.year]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}

                {/* Capacity */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="h-4 w-4 text-gray-400" />
                    <span>{vehicle.capacityTonnage} Tons</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Box className="h-4 w-4 text-gray-400" />
                    <span>{vehicle.capacityVolumeCBM} CBM</span>
                  </div>
                </div>

                {/* Fuel & Ownership */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Fuel className="h-4 w-4" />
                    <span>{vehicle.fuelType}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      vehicle.ownershipType === "OWNED"
                        ? "bg-green-50 text-green-700"
                        : vehicle.ownershipType === "LEASED"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {vehicle.ownershipType}
                  </span>
                </div>

                {/* Actions */}
                <Link href={`/fleet/vehicles/${vehicle.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    View Details
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * 20 + 1} to{" "}
            {Math.min(pagination.page * 20, pagination.total)} of{" "}
            {pagination.total} vehicles
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
