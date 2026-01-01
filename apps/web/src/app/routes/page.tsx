"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Route as RouteIcon,
  Search,
  ChevronRight,
  Plus,
  RefreshCw,
  MapPin,
  Clock,
  Truck,
  ArrowRight,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { ROUTE_TYPES, ROUTE_FREQUENCIES } from "@/lib/validations";

interface Route {
  id: string;
  code: string;
  name: string;
  type: string;
  originHubId: string | null;
  destinationHubId: string | null;
  distanceKm: number;
  estimatedDurationMin: number;
  departureTime: string | null;
  arrivalTime: string | null;
  frequency: string;
  baseCostPerTrip: number | null;
  recommendedVehicle: string | null;
  isActive: boolean;
  createdAt: string;
  originHub: { id: string; name: string; code: string } | null;
  destinationHub: { id: string; name: string; code: string } | null;
}

async function fetchRoutes(params: {
  page: number;
  type?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  if (params.type) searchParams.set("type", params.type);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/routes?${searchParams.toString()}`);
  return res.json();
}

function getTypeColor(type: string) {
  switch (type) {
    case "LINE_HAUL":
      return "bg-blue-100 text-blue-800";
    case "MILK_RUN_PICKUP":
      return "bg-green-100 text-green-800";
    case "MILK_RUN_DELIVERY":
      return "bg-purple-100 text-purple-800";
    case "FEEDER":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getFrequencyLabel(freq: string) {
  switch (freq) {
    case "DAILY":
      return "Daily";
    case "MON_WED_FRI":
      return "Mon, Wed, Fri";
    case "TUE_THU_SAT":
      return "Tue, Thu, Sat";
    case "WEEKLY":
      return "Weekly";
    case "ON_DEMAND":
      return "On Demand";
    default:
      return freq;
  }
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function RoutesPage() {
  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["routes", page, selectedType, searchQuery],
    queryFn: () =>
      fetchRoutes({
        page,
        type: selectedType || undefined,
        search: searchQuery || undefined,
      }),
  });

  const routes = data?.data?.items || [];
  const pagination = data?.data || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routes</h1>
          <p className="text-gray-600">Manage transport routes between hubs</p>
        </div>
        <Link href="/routes/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Route
          </Button>
        </Link>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedType(null)}
          className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
            !selectedType
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 border hover:bg-gray-50"
          }`}
        >
          All Types
        </button>
        {ROUTE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedType === type
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            {type.replace(/_/g, " ")}
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
              placeholder="Search by route code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Routes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading routes...</p>
        </div>
      ) : routes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <RouteIcon className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No routes found</p>
            <Link href="/routes/new" className="mt-4 inline-block">
              <Button size="sm">Create your first route</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route: Route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{route.code}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(
                          route.type
                        )}`}
                      >
                        {route.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{route.name}</p>
                  </div>
                  {!route.isActive && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Route Path */}
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                  <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {route.originHub?.name || "Any Origin"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {route.destinationHub?.name || "Any Destination"}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <RouteIcon className="h-4 w-4 text-gray-400" />
                    <span>{route.distanceKm} km</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{formatDuration(route.estimatedDurationMin)}</span>
                  </div>
                </div>

                {/* Schedule & Cost */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{getFrequencyLabel(route.frequency)}</span>
                  {route.departureTime && (
                    <span>Departs: {route.departureTime}</span>
                  )}
                  {route.baseCostPerTrip && (
                    <span className="font-medium text-gray-700">
                      Rs. {route.baseCostPerTrip.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Recommended Vehicle */}
                {route.recommendedVehicle && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Truck className="h-4 w-4" />
                    <span>{route.recommendedVehicle.replace(/_/g, " ")}</span>
                  </div>
                )}

                {/* Actions */}
                <Link href={`/routes/${route.id}`}>
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
            {pagination.total} routes
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
