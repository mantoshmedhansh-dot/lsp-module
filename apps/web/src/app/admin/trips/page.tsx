"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Navigation,
  Search,
  Plus,
  RefreshCw,
  Truck,
  User,
  Clock,
  MapPin,
  Calendar,
  Play,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { TRIP_STATUSES } from "@/lib/validations";
import { useHubFilter } from "@/contexts/HubFilterContext";

interface Trip {
  id: string;
  tripNumber: string;
  status: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  actualDeparture: string | null;
  actualArrival: string | null;
  totalShipments: number;
  totalWeightKg: number;
  fillRateWeight: number;
  currentLocation: string | null;
  route: { code: string; name: string } | null;
  vehicle: { registrationNo: string; type: string } | null;
  driver: { name: string; employeeCode: string } | null;
}

async function fetchTrips(params: {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  hubId?: string | null;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", "100");
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.hubId) searchParams.set("hubId", params.hubId);
  const res = await fetch(`/api/trips?${searchParams.toString()}`);
  return res.json();
}

async function updateTripStatus(tripId: string, status: string) {
  const res = await fetch(`/api/trips/${tripId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
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
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTripsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-trips", searchQuery, selectedStatus, dateFrom, dateTo, selectedHubId],
    queryFn: () =>
      fetchTrips({
        search: searchQuery || undefined,
        status: selectedStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        hubId: selectedHubId,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ tripId, status }: { tripId: string; status: string }) =>
      updateTripStatus(tripId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
    },
  });

  const trips = data?.data?.items || [];

  // Stats
  const stats = {
    total: trips.length,
    planned: trips.filter((t: Trip) => t.status === "PLANNED").length,
    loading: trips.filter((t: Trip) => t.status === "LOADING").length,
    inTransit: trips.filter((t: Trip) => t.status === "IN_TRANSIT").length,
    completed: trips.filter((t: Trip) => t.status === "COMPLETED").length,
    cancelled: trips.filter((t: Trip) => t.status === "CANCELLED").length,
  };

  // Quick action handlers
  const startTrip = (tripId: string) => {
    statusMutation.mutate({ tripId, status: "IN_TRANSIT" });
  };

  const completeTrip = (tripId: string) => {
    statusMutation.mutate({ tripId, status: "COMPLETED" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Management</h1>
          <p className="text-gray-500">Monitor and manage transport trips</p>
        </div>
        <Link href="/trips/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Plan Trip
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
          <p className="text-sm text-gray-500">Planned</p>
          <p className="text-2xl font-bold text-gray-600">{stats.planned}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Loading</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.loading}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="text-2xl font-bold text-purple-600">{stats.inTransit}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Cancelled</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </Card>
      </div>

      {/* Filters */}
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
          <select
            value={selectedStatus || ""}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            {TRIP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Trips Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading trips...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vehicle / Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Load
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
                {trips.map((trip: Trip) => (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Link
                        href={`/trips/${trip.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {trip.tripNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {trip.route?.code}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-[150px]">
                          {trip.route?.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Truck className="h-4 w-4 text-blue-500" />
                          {trip.vehicle?.registrationNo}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <User className="h-4 w-4" />
                          {trip.driver?.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {formatDateTime(trip.scheduledDeparture)}
                        </div>
                        <p className="text-gray-500">
                          to {formatDateTime(trip.scheduledArrival)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p>{trip.totalShipments} shipments</p>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500"
                              style={{ width: `${trip.fillRateWeight}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {trip.fillRateWeight.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                          trip.status
                        )}`}
                      >
                        {trip.status.replace(/_/g, " ")}
                      </span>
                      {trip.currentLocation && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {trip.currentLocation}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {trip.status === "READY" && (
                          <Button
                            size="sm"
                            onClick={() => startTrip(trip.id)}
                            disabled={statusMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {trip.status === "IN_TRANSIT" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeTrip(trip.id)}
                            disabled={statusMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {["PLANNED", "LOADING"].includes(trip.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() =>
                              statusMutation.mutate({
                                tripId: trip.id,
                                status: "CANCELLED",
                              })
                            }
                            disabled={statusMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={`/trips/${trip.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trips.length === 0 && (
              <div className="text-center py-12">
                <Navigation className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No trips found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
