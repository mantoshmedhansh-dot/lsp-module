"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Search,
  Filter,
  ChevronRight,
  Plus,
  RefreshCw,
  MapPin,
  Users,
  Clock,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";

const HUB_TYPES = ["GATEWAY", "TRANSSHIPMENT", "SPOKE"] as const;

interface Hub {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  totalBays: number;
  sortingCapacity: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    staff: number;
    servicedPincodes: number;
  };
}

async function fetchHubs(params: {
  page: number;
  type?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  if (params.type) searchParams.set("type", params.type);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/hubs?${searchParams.toString()}`);
  return res.json();
}

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

export default function HubsPage() {
  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hubs", page, selectedType, searchQuery],
    queryFn: () =>
      fetchHubs({
        page,
        type: selectedType || undefined,
        search: searchQuery || undefined,
      }),
  });

  const hubs = data?.data?.items || [];
  const pagination = data?.data || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub Network</h1>
          <p className="text-gray-600">
            Manage your hub network for PTL operations
          </p>
        </div>
        <Link href="/hubs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Hub
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
          All Hubs
        </button>
        {HUB_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              selectedType === type
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            {type.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Search & Actions */}
      <Card padding="sm">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by hub name, code, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </Card>

      {/* Hubs Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading hubs...</p>
        </div>
      ) : hubs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No hubs found</p>
            <Link href="/hubs/new" className="mt-4 inline-block">
              <Button size="sm">Add your first hub</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hubs.map((hub: Hub) => (
            <Card key={hub.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{hub.name}</h3>
                      {!hub.isActive && (
                        <Badge variant="danger" size="sm">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{hub.code}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
                      hub.type
                    )}`}
                  >
                    {hub.type}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-gray-700">
                      {hub.city}, {hub.state}
                    </p>
                    <p className="text-gray-500">{hub.pincode}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-lg font-semibold text-gray-900">
                      {hub.totalBays}
                    </p>
                    <p className="text-xs text-gray-500">Bays</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-lg font-semibold text-gray-900">
                      {hub._count.staff}
                    </p>
                    <p className="text-xs text-gray-500">Staff</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-lg font-semibold text-gray-900">
                      {hub._count.servicedPincodes}
                    </p>
                    <p className="text-xs text-gray-500">Pincodes</p>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Clock className="h-4 w-4" />
                  <span>
                    {hub.operatingHoursStart} - {hub.operatingHoursEnd}
                  </span>
                </div>

                {/* Actions */}
                <Link href={`/hubs/${hub.id}`}>
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
            {pagination.total} hubs
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
