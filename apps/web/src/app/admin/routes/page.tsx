"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Route as RouteIcon,
  Search,
  Plus,
  RefreshCw,
  MapPin,
  Clock,
  Truck,
  ArrowRight,
  Edit,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { ROUTE_TYPES, ROUTE_FREQUENCIES } from "@/lib/validations";
import { useHubFilter } from "@/contexts/HubFilterContext";

interface Route {
  id: string;
  code: string;
  name: string;
  type: string;
  distanceKm: number;
  estimatedDurationMin: number;
  departureTime: string | null;
  frequency: string;
  baseCostPerTrip: number | null;
  recommendedVehicle: string | null;
  isActive: boolean;
  originHub: { name: string; code: string } | null;
  destinationHub: { name: string; code: string } | null;
}

async function fetchRoutes(params: { search?: string; type?: string; hubId?: string | null }) {
  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", "100");
  if (params.search) searchParams.set("search", params.search);
  if (params.type) searchParams.set("type", params.type);
  if (params.hubId) searchParams.set("hubId", params.hubId);
  const res = await fetch(`/api/routes?${searchParams.toString()}`);
  return res.json();
}

async function toggleRouteStatus(routeId: string, isActive: boolean) {
  const res = await fetch(`/api/routes/${routeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
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

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function AdminRoutesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-routes", searchQuery, selectedType, selectedHubId],
    queryFn: () =>
      fetchRoutes({
        search: searchQuery || undefined,
        type: selectedType || undefined,
        hubId: selectedHubId,
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ routeId, isActive }: { routeId: string; isActive: boolean }) =>
      toggleRouteStatus(routeId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-routes"] });
    },
  });

  const routes = data?.data?.items || [];

  // Stats
  const stats = {
    total: routes.length,
    active: routes.filter((r: Route) => r.isActive).length,
    lineHaul: routes.filter((r: Route) => r.type === "LINE_HAUL").length,
    milkRunPickup: routes.filter((r: Route) => r.type === "MILK_RUN_PICKUP").length,
    milkRunDelivery: routes.filter((r: Route) => r.type === "MILK_RUN_DELIVERY").length,
    feeder: routes.filter((r: Route) => r.type === "FEEDER").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-500">Define and manage transport routes</p>
        </div>
        <Link href="/routes/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Route
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
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Line Haul</p>
          <p className="text-2xl font-bold text-blue-600">{stats.lineHaul}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Pickup Runs</p>
          <p className="text-2xl font-bold text-green-600">{stats.milkRunPickup}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Delivery Runs</p>
          <p className="text-2xl font-bold text-purple-600">{stats.milkRunDelivery}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Feeder</p>
          <p className="text-2xl font-bold text-orange-600">{stats.feeder}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={selectedType || ""}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Types</option>
            {ROUTE_TYPES.map((type) => (
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

      {/* Routes Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading routes...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Path
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Distance/Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost
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
                {routes.map((route: Route) => (
                  <tr key={route.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{route.code}</p>
                        <p className="text-sm text-gray-500">{route.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
                          route.type
                        )}`}
                      >
                        {route.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-green-500" />
                        <span className="truncate max-w-[100px]">
                          {route.originHub?.code || "Any"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <MapPin className="h-4 w-4 text-red-500" />
                        <span className="truncate max-w-[100px]">
                          {route.destinationHub?.code || "Any"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p>{route.distanceKm} km</p>
                        <p className="text-gray-500">
                          {formatDuration(route.estimatedDurationMin)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p>{route.frequency.replace(/_/g, " ")}</p>
                        {route.departureTime && (
                          <p className="text-gray-500">{route.departureTime}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {route.baseCostPerTrip ? (
                        <span className="text-sm font-medium">
                          Rs. {route.baseCostPerTrip.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          toggleMutation.mutate({
                            routeId: route.id,
                            isActive: !route.isActive,
                          })
                        }
                        className={`flex items-center gap-1 text-sm ${
                          route.isActive ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {route.isActive ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                        {route.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/routes/${route.id}`}>
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
            {routes.length === 0 && (
              <div className="text-center py-12">
                <RouteIcon className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No routes found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
