"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  ChevronRight,
  Plus,
  RefreshCw,
  Phone,
  IdCard,
  Star,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";

interface Driver {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  status: string;
  totalTrips: number;
  rating: number;
  isActive: boolean;
  createdAt: string;
}

const DRIVER_STATUSES = ["AVAILABLE", "ON_TRIP", "ON_LEAVE", "INACTIVE"];
const LICENSE_TYPES = ["LMV", "HMV", "TRANS"];

async function fetchDrivers(params: {
  page: number;
  status?: string;
  licenseType?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", params.page.toString());
  if (params.status) searchParams.set("status", params.status);
  if (params.licenseType) searchParams.set("licenseType", params.licenseType);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/drivers?${searchParams.toString()}`);
  return res.json();
}

function getStatusColor(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-100 text-green-800";
    case "ON_TRIP":
      return "bg-blue-100 text-blue-800";
    case "ON_LEAVE":
      return "bg-yellow-100 text-yellow-800";
    case "INACTIVE":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getLicenseColor(type: string) {
  switch (type) {
    case "HMV":
      return "bg-purple-100 text-purple-800";
    case "TRANS":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function DriversPage() {
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["drivers", page, selectedStatus, selectedLicenseType, searchQuery],
    queryFn: () =>
      fetchDrivers({
        page,
        status: selectedStatus || undefined,
        licenseType: selectedLicenseType || undefined,
        search: searchQuery || undefined,
      }),
  });

  const drivers = data?.data?.items || [];
  const pagination = data?.data || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-600">Manage your fleet drivers</p>
        </div>
        <Link href="/fleet/drivers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
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
        {DRIVER_STATUSES.map((status) => (
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
              placeholder="Search by name, employee code, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={selectedLicenseType || ""}
            onChange={(e) => setSelectedLicenseType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All License Types</option>
            {LICENSE_TYPES.map((type) => (
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

      {/* Drivers Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading drivers...</p>
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No drivers found</p>
            <Link href="/fleet/drivers/new" className="mt-4 inline-block">
              <Button size="sm">Add your first driver</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver: Driver) => (
            <Card key={driver.id} className="hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                    <p className="text-sm text-gray-500">{driver.employeeCode}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                      driver.status
                    )}`}
                  >
                    {driver.status.replace("_", " ")}
                  </span>
                </div>

                {/* Contact */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{driver.phone}</span>
                </div>

                {/* License */}
                <div className="flex items-center gap-2 mb-3">
                  <IdCard className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {driver.licenseNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getLicenseColor(
                      driver.licenseType
                    )}`}
                  >
                    {driver.licenseType}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span>{driver.rating.toFixed(1)}</span>
                  </div>
                  <span>{driver.totalTrips} trips</span>
                  <span>
                    Exp:{" "}
                    {new Date(driver.licenseExpiry).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Actions */}
                <Link href={`/fleet/drivers/${driver.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    View Profile
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
            {pagination.total} drivers
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
