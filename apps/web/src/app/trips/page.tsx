"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Search,
  ChevronRight,
  Plus,
  RefreshCw,
  MapPin,
  Clock,
  User,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { TRIP_STATUSES, ROUTE_TYPES } from "@/lib/validations";

interface Trip {
  id: string;
  tripNumber: string;
  routeId: string;
  vehicleId: string;
  driverId: string;
  type: string;
  originHubId: string | null;
  destinationHubId: string | null;
  scheduledDeparture: string;
  scheduledArrival: string;
  actualDeparture: string | null;
  actualArrival: string | null;
  totalShipments: number;
  totalWeightKg: number;
  fillRateWeight: number;
  fillRateVolume: number;
  status: string;
  currentLocation: string | null;
  createdAt: string;
  route: { id: string; code: string; name: string } | null;
  vehicle: { id: string; registrationNo: string; type: string } | null;
  driver: { id: string; name: string; employeeCode: string; phone: string } | null;
}

async function fetchTrips(params: {
  page: number;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  if (params.status) searchParams.set("status", params.status);
  if (params.type) searchParams.set("type", params.type);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/trips?${searchParams.toString()}`);
  return res.json();
}

function getStatusColor(status: string) {
  switch (status) {
    case "PLANNED":
      return "bg-gray-100 text-gray-800";
    case "LOADING":
      return "bg-yellow-100 text-yellow-800";
    case "READY":
      return "bg-blue-100 text-blue-800";
    case "IN_TRANSIT":
      return "bg-purple-100 text-purple-800";
    case "ARRIVED":
      return "bg-green-100 text-green-800";
    case "UNLOADING":
      return "bg-orange-100 text-orange-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TripsPage() {
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["trips", page, selectedStatus, searchQuery, dateFrom, dateTo],
    queryFn: () =>
      fetchTrips({
        page,
        status: selectedStatus || undefined,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const trips = data?.data?.items || [];
  const pagination = data?.data || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
          <p className="text-gray-600">Manage and track transport trips</p>
        </div>
        <Link href="/trips/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Plan Trip
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
        {TRIP_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            {status.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <Card padding="sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by trip number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Trips List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading trips...</p>
        </div>
      ) : trips.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No trips found</p>
            <Link href="/trips/new" className="mt-4 inline-block">
              <Button size="sm">Plan your first trip</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip: Trip) => (
            <Card key={trip.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  {/* Left - Trip Info */}
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{trip.tripNumber}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(
                          trip.status
                        )}`}
                      >
                        {trip.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-gray-500">
                        {trip.route?.code} - {trip.route?.name}
                      </span>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>
                          {formatDateTime(trip.scheduledDeparture)} -{" "}
                          {formatDateTime(trip.scheduledArrival)}
                        </span>
                      </div>
                    </div>

                    {/* Vehicle & Driver */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{trip.vehicle?.registrationNo}</span>
                        <span className="text-gray-400">
                          ({trip.vehicle?.type?.replace(/_/g, " ")})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-500" />
                        <span>{trip.driver?.name}</span>
                        <span className="text-gray-400">({trip.driver?.employeeCode})</span>
                      </div>
                    </div>

                    {/* Current Location */}
                    {trip.currentLocation && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <MapPin className="h-4 w-4" />
                        <span>{trip.currentLocation}</span>
                      </div>
                    )}
                  </div>

                  {/* Right - Stats */}
                  <div className="text-right">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Shipments</p>
                        <p className="text-lg font-semibold">{trip.totalShipments}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Weight</p>
                        <p className="text-lg font-semibold">{trip.totalWeightKg} kg</p>
                      </div>
                    </div>

                    {/* Fill Rate */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500"
                          style={{ width: `${trip.fillRateWeight}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {trip.fillRateWeight.toFixed(0)}% filled
                      </span>
                    </div>

                    <Link href={`/trips/${trip.id}`} className="mt-3 inline-block">
                      <Button variant="outline" size="sm">
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
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
            {pagination.total} trips
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
