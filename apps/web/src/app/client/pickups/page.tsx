"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Package,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface PickupRequest {
  id: string;
  pickupNumber: string;
  warehouseName: string;
  warehouseCity: string;
  requestedDate: string;
  timeSlotStart: string | null;
  timeSlotEnd: string | null;
  expectedAwbs: number;
  pickedAwbs: number;
  status: string;
  assignedAgentName: string | null;
  assignedAgentPhone: string | null;
  pickedAt: string | null;
}

async function fetchPickups(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`/api/client/pickups?${params.toString()}`);
  return res.json();
}

const PICKUP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  SCHEDULED: { label: "Scheduled", color: "info", icon: Calendar },
  OUT_FOR_PICKUP: { label: "Out for Pickup", color: "warning", icon: Truck },
  PICKED: { label: "Picked", color: "success", icon: CheckCircle },
  PARTIALLY_PICKED: { label: "Partial", color: "warning", icon: AlertCircle },
  CANCELLED: { label: "Cancelled", color: "danger", icon: AlertCircle },
  FAILED: { label: "Failed", color: "danger", icon: AlertCircle },
};

export default function ClientPickupsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-pickups", statusFilter],
    queryFn: () => fetchPickups(statusFilter),
  });

  const pickups: PickupRequest[] = data?.data?.items || [];

  // Group pickups by status
  const scheduled = pickups.filter((p) => p.status === "SCHEDULED");
  const outForPickup = pickups.filter((p) => p.status === "OUT_FOR_PICKUP");
  const completed = pickups.filter(
    (p) => p.status === "PICKED" || p.status === "PARTIALLY_PICKED"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pickup Requests</h1>
          <p className="text-gray-600">Schedule and track your pickups</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/client/pickups/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Pickup
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduled.length}</p>
              <p className="text-sm text-gray-500">Scheduled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Truck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{outForPickup.length}</p>
              <p className="text-sm text-gray-500">Out for Pickup</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completed.length}</p>
              <p className="text-sm text-gray-500">Completed Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {pickups.reduce((sum, p) => sum + p.pickedAwbs, 0)}
              </p>
              <p className="text-sm text-gray-500">AWBs Picked Today</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pickup List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Pickups</CardTitle>
          <div className="flex gap-2">
            {["", "SCHEDULED", "OUT_FOR_PICKUP", "PICKED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  statusFilter === status
                    ? "bg-primary-100 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {status === "" ? "All" : PICKUP_STATUS_CONFIG[status]?.label || status}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : pickups.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No pickup requests found</p>
              <Link href="/client/pickups/new">
                <Button variant="outline" className="mt-4">
                  Schedule Your First Pickup
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pickup ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Requested On
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      AWBs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pickups.map((pickup) => {
                    const statusConfig = PICKUP_STATUS_CONFIG[pickup.status];
                    return (
                      <tr key={pickup.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{pickup.pickupNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900">
                              {pickup.warehouseName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {pickup.warehouseCity}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900">
                              {new Date(pickup.requestedDate).toLocaleDateString()}
                            </p>
                            {pickup.timeSlotStart && (
                              <p className="text-xs text-gray-500">
                                {pickup.timeSlotStart} - {pickup.timeSlotEnd}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm">
                            {pickup.pickedAwbs}/{pickup.expectedAwbs}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusConfig?.color as any || "default"}
                            size="sm"
                          >
                            {statusConfig?.label || pickup.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {pickup.assignedAgentName ? (
                            <div>
                              <p className="text-sm text-gray-900">
                                {pickup.assignedAgentName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {pickup.assignedAgentPhone}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/client/pickups/${pickup.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
