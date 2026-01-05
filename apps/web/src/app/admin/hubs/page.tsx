"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  MapPin,
  Phone,
  Users,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { useHubFilter } from "@/contexts/HubFilterContext";

interface Hub {
  id: string;
  code: string;
  name: string;
  type: string;
  city: string;
  state: string;
  pincode: string;
  totalBays: number;
  sortingCapacity: number;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  _count?: { staff: number; servicedPincodes: number };
}

async function fetchHubs(params: { search?: string; type?: string; hubId?: string | null }) {
  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", "100");
  if (params.search) searchParams.set("search", params.search);
  if (params.type) searchParams.set("type", params.type);
  if (params.hubId) searchParams.set("hubId", params.hubId);
  const res = await fetch(`/api/hubs?${searchParams.toString()}`);
  return res.json();
}

async function toggleHubStatus(hubId: string, isActive: boolean) {
  const res = await fetch(`/api/hubs/${hubId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  return res.json();
}

const HUB_TYPES = ["GATEWAY", "TRANSSHIPMENT", "SPOKE"];

function getTypeColor(type: string) {
  switch (type) {
    case "GATEWAY":
      return "bg-purple-100 text-purple-800";
    case "TRANSSHIPMENT":
      return "bg-blue-100 text-blue-800";
    case "SPOKE":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function AdminHubsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hubs", searchQuery, selectedType, selectedHubId],
    queryFn: () =>
      fetchHubs({
        search: searchQuery || undefined,
        type: selectedType || undefined,
        hubId: selectedHubId,
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ hubId, isActive }: { hubId: string; isActive: boolean }) =>
      toggleHubStatus(hubId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hubs"] });
    },
  });

  const hubs = data?.data?.items || [];

  // Stats
  const stats = {
    total: hubs.length,
    active: hubs.filter((h: Hub) => h.isActive).length,
    gateway: hubs.filter((h: Hub) => h.type === "GATEWAY").length,
    transshipment: hubs.filter((h: Hub) => h.type === "TRANSSHIPMENT").length,
    spoke: hubs.filter((h: Hub) => h.type === "SPOKE").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub Network Management</h1>
          <p className="text-gray-500">Manage transshipment centers and distribution hubs</p>
        </div>
        <Link href="/hubs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Hub
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Hubs</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Gateway</p>
          <p className="text-2xl font-bold text-purple-600">{stats.gateway}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Transshipment</p>
          <p className="text-2xl font-bold text-blue-600">{stats.transshipment}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Spoke</p>
          <p className="text-2xl font-bold text-green-600">{stats.spoke}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, name, or city..."
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
            {HUB_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Hubs Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading hubs...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hub
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
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
                {hubs.map((hub: Hub) => (
                  <tr key={hub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{hub.code}</p>
                        <p className="text-sm text-gray-500">{hub.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
                          hub.type
                        )}`}
                      >
                        {hub.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {hub.city}, {hub.state}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{hub.pincode}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm">{hub.totalBays} bays</p>
                      <p className="text-xs text-gray-500">
                        {hub.sortingCapacity}/hr capacity
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm">{hub.contactName}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="h-3 w-3" />
                        {hub.contactPhone}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          toggleMutation.mutate({
                            hubId: hub.id,
                            isActive: !hub.isActive,
                          })
                        }
                        className={`flex items-center gap-1 text-sm ${
                          hub.isActive ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {hub.isActive ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                        {hub.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/hubs/${hub.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/hubs/${hub.id}`}>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hubs.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No hubs found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
