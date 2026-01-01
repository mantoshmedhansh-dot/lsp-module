"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Users,
  Clock,
  Phone,
  Mail,
  ChevronLeft,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Package,
  X,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";

interface Hub {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  totalBays: number;
  loadingBays: number;
  unloadingBays: number;
  sortingCapacity: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: string;
  staff: Array<{
    id: string;
    employeeCode: string;
    name: string;
    phone: string;
    role: string;
    isActive: boolean;
  }>;
  servicedPincodes: Array<{
    id: string;
    pincode: string;
    type: string;
    priority: number;
  }>;
  _count: {
    staff: number;
    servicedPincodes: number;
  };
}

async function fetchHub(hubId: string) {
  const res = await fetch(`/api/hubs/${hubId}`);
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

function getRoleColor(role: string) {
  switch (role) {
    case "MANAGER":
      return "bg-purple-100 text-purple-800";
    case "SUPERVISOR":
      return "bg-blue-100 text-blue-800";
    case "OPERATOR":
      return "bg-green-100 text-green-800";
    case "LOADER":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function HubDetailPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddPincode, setShowAddPincode] = useState(false);
  const [newPincode, setNewPincode] = useState("");
  const [newPincodeType, setNewPincodeType] = useState<"PICKUP" | "DELIVERY" | "BOTH">("DELIVERY");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["hub", hubId],
    queryFn: () => fetchHub(hubId),
  });

  const addPincodeMutation = useMutation({
    mutationFn: async (data: { pincode: string; type: string }) => {
      const res = await fetch(`/api/hubs/${hubId}/pincodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", hubId] });
      setShowAddPincode(false);
      setNewPincode("");
    },
  });

  const removePincodeMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const res = await fetch(`/api/hubs/${hubId}/pincodes?id=${mappingId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hub", hubId] });
    },
  });

  const deleteHubMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hubs/${hubId}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      router.push("/hubs");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <p className="ml-2 text-gray-500">Loading hub details...</p>
      </div>
    );
  }

  const hub: Hub = data?.data;

  if (!hub) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-gray-300" />
        <p className="mt-2 text-gray-500">Hub not found</p>
        <Link href="/hubs" className="mt-4 inline-block">
          <Button>Back to Hubs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/hubs">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{hub.name}</h1>
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(
                  hub.type
                )}`}
              >
                {hub.type}
              </span>
              {!hub.isActive && (
                <Badge variant="danger" size="sm">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-gray-500">{hub.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Are you sure you want to deactivate this hub?")) {
                deleteHubMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Deactivate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Location Card */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location & Contact
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-gray-900">{hub.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">City & State</p>
                  <p className="text-gray-900">
                    {hub.city}, {hub.state} - {hub.pincode}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="text-gray-900">{hub.contactName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-gray-900 flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {hub.contactPhone}
                  </p>
                </div>
                {hub.contactEmail && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900 flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {hub.contactEmail}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Capacity Card */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Capacity & Operations
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">
                    {hub.totalBays}
                  </p>
                  <p className="text-sm text-gray-500">Total Bays</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {hub.loadingBays}
                  </p>
                  <p className="text-sm text-gray-500">Loading Bays</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {hub.unloadingBays}
                  </p>
                  <p className="text-sm text-gray-500">Unloading Bays</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {hub.sortingCapacity}
                  </p>
                  <p className="text-sm text-gray-500">Pkg/Hour</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>
                  Operating Hours: {hub.operatingHoursStart} -{" "}
                  {hub.operatingHoursEnd}
                </span>
              </div>
            </div>
          </Card>

          {/* Serviced Pincodes */}
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Serviced Pincodes ({hub._count.servicedPincodes})
                </h2>
                <Button
                  size="sm"
                  onClick={() => setShowAddPincode(!showAddPincode)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Pincode
                </Button>
              </div>

              {showAddPincode && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter pincode"
                      value={newPincode}
                      onChange={(e) => setNewPincode(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      maxLength={6}
                    />
                    <select
                      value={newPincodeType}
                      onChange={(e) =>
                        setNewPincodeType(e.target.value as any)
                      }
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DELIVERY">Delivery</option>
                      <option value="PICKUP">Pickup</option>
                      <option value="BOTH">Both</option>
                    </select>
                    <Button
                      onClick={() =>
                        addPincodeMutation.mutate({
                          pincode: newPincode,
                          type: newPincodeType,
                        })
                      }
                      disabled={
                        newPincode.length !== 6 ||
                        addPincodeMutation.isPending
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {hub.servicedPincodes.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No pincodes mapped yet
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {hub.servicedPincodes.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      <span className="font-medium">{mapping.pincode}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          mapping.type === "PICKUP"
                            ? "bg-blue-100 text-blue-700"
                            : mapping.type === "DELIVERY"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {mapping.type}
                      </span>
                      <button
                        onClick={() => removePincodeMutation.mutate(mapping.id)}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff Card */}
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff ({hub._count.staff})
                </h2>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {hub.staff.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No staff assigned yet
                </p>
              ) : (
                <div className="space-y-3">
                  {hub.staff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{staff.name}</p>
                        <p className="text-sm text-gray-500">
                          {staff.employeeCode}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${getRoleColor(
                          staff.role
                        )}`}
                      >
                        {staff.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Today's Inbound</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Today's Outbound</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pending Sort</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bay Utilization</span>
                  <span className="font-medium">0%</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
