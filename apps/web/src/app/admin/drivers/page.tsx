"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Phone,
  IdCard,
  Star,
  Edit,
  AlertTriangle,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { useHubFilter } from "@/contexts/HubFilterContext";

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
  totalKm: number;
  rating: number;
  isActive: boolean;
}

const DRIVER_STATUSES = ["AVAILABLE", "ON_TRIP", "ON_LEAVE", "INACTIVE"];
const LICENSE_TYPES = ["LMV", "HMV", "TRANS"];

async function fetchDrivers(params: {
  search?: string;
  status?: string;
  licenseType?: string;
  hubId?: string | null;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("pageSize", "100");
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.licenseType) searchParams.set("licenseType", params.licenseType);
  if (params.hubId) searchParams.set("hubId", params.hubId);
  const res = await fetch(`/api/drivers?${searchParams.toString()}`);
  return res.json();
}

async function updateDriverStatus(driverId: string, status: string) {
  const res = await fetch(`/api/drivers/${driverId}`, {
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

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return date <= thirtyDaysFromNow;
}

export default function AdminDriversPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedLicenseType, setSelectedLicenseType] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-drivers", searchQuery, selectedStatus, selectedLicenseType, selectedHubId],
    queryFn: () =>
      fetchDrivers({
        search: searchQuery || undefined,
        status: selectedStatus || undefined,
        licenseType: selectedLicenseType || undefined,
        hubId: selectedHubId,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ driverId, status }: { driverId: string; status: string }) =>
      updateDriverStatus(driverId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
  });

  const drivers = data?.data?.items || [];

  // Stats
  const stats = {
    total: drivers.length,
    available: drivers.filter((d: Driver) => d.status === "AVAILABLE").length,
    onTrip: drivers.filter((d: Driver) => d.status === "ON_TRIP").length,
    onLeave: drivers.filter((d: Driver) => d.status === "ON_LEAVE").length,
    inactive: drivers.filter((d: Driver) => d.status === "INACTIVE").length,
    expiringLicense: drivers.filter((d: Driver) => isExpiringSoon(d.licenseExpiry))
      .length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Management</h1>
          <p className="text-gray-500">Manage fleet drivers and their status</p>
        </div>
        <Link href="/fleet/drivers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
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
          <p className="text-sm text-gray-500">On Trip</p>
          <p className="text-2xl font-bold text-blue-600">{stats.onTrip}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">On Leave</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.onLeave}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Expiring License</p>
          <p className="text-2xl font-bold text-orange-600">{stats.expiringLicense}</p>
        </Card>
      </div>

      {/* Filters */}
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
            value={selectedStatus || ""}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            {DRIVER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={selectedLicenseType || ""}
            onChange={(e) => setSelectedLicenseType(e.target.value || null)}
            className="px-3 py-2 border rounded-lg"
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

      {/* Drivers Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading drivers...</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    License
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Performance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Alerts
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drivers.map((driver: Driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{driver.name}</p>
                        <p className="text-sm text-gray-500">{driver.employeeCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {driver.phone}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm">{driver.licenseNumber}</p>
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                            {driver.licenseType}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-400" />
                          {driver.rating.toFixed(1)}
                        </div>
                        <p className="text-xs text-gray-500">
                          {driver.totalTrips} trips • {driver.totalKm.toLocaleString()} km
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={driver.status}
                        onChange={(e) =>
                          statusMutation.mutate({
                            driverId: driver.id,
                            status: e.target.value,
                          })
                        }
                        className={`px-2 py-1 text-xs font-medium rounded border-0 ${getStatusColor(
                          driver.status
                        )}`}
                      >
                        {DRIVER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {isExpiringSoon(driver.licenseExpiry) && (
                        <div className="flex items-center gap-1 text-orange-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">License Expiring</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/fleet/drivers/${driver.id}`}>
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
            {drivers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No drivers found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
