"use client";

import { useState } from "react";
import {
  Handshake,
  Plus,
  Package,
  CheckCircle2,
  Clock,
  Building2,
  Truck,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useHubFilter } from "@/contexts/HubFilterContext";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "warning",
  HANDED_OVER: "info",
  ACKNOWLEDGED: "success",
};

export default function AdminHandoversPage() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { selectedHubId } = useHubFilter();

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-handovers", filterStatus, filterPartner, selectedHubId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPartner) params.set("partnerId", filterPartner);
      if (selectedHubId) params.set("hubId", selectedHubId);
      params.set("pageSize", "50");

      const res = await fetch(`/api/partner-handovers?${params}`);
      return res.json();
    },
  });

  const { data: partnersData } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const res = await fetch("/api/partners?pageSize=100");
      return res.json();
    },
  });

  const { data: hubsData } = useQuery({
    queryKey: ["hubs"],
    queryFn: async () => {
      const res = await fetch("/api/hubs?pageSize=100");
      return res.json();
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (handoverId: string) => {
      const res = await fetch(`/api/partner-handovers/${handoverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACKNOWLEDGE" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-handovers"] });
    },
  });

  const handovers = data?.data?.items || [];
  const partners = partnersData?.data?.items || [];
  const hubs = hubsData?.data?.items || [];

  const stats = {
    total: handovers.length,
    pending: handovers.filter((h: any) => h.status === "PENDING").length,
    handedOver: handovers.filter((h: any) => h.status === "HANDED_OVER").length,
    acknowledged: handovers.filter((h: any) => h.status === "ACKNOWLEDGED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Handovers</h1>
          <p className="text-gray-500">Manage shipment handovers to partner networks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/operations/handovers">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Handover
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Handed Over</p>
          <p className="text-2xl font-bold text-blue-600">{stats.handedOver}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Acknowledged</p>
          <p className="text-2xl font-bold text-green-600">{stats.acknowledged}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="HANDED_OVER">Handed Over</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
          </select>
          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Partners</option>
            {partners.map((partner: any) => (
              <option key={partner.id} value={partner.id}>
                {partner.displayName || partner.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">Handover #</th>
                <th className="text-left p-4 font-medium text-gray-600">Partner</th>
                <th className="text-left p-4 font-medium text-gray-600">Hub</th>
                <th className="text-left p-4 font-medium text-gray-600">Shipments</th>
                <th className="text-left p-4 font-medium text-gray-600">Weight</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Created</th>
                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : handovers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">No handovers found</td>
                </tr>
              ) : (
                handovers.map((handover: any) => (
                  <tr key={handover.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono font-medium">{handover.handoverNumber}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-purple-500" />
                        <span>{handover.partner?.displayName || handover.partner?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{handover.handoverHub?.code} - {handover.handoverHub?.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span>{handover.shipmentCount}</span>
                      </div>
                    </td>
                    <td className="p-4">{handover.totalWeightKg?.toFixed(1) || 0} kg</td>
                    <td className="p-4">
                      <Badge variant={(STATUS_COLORS[handover.status] as any) || "secondary"}>
                        {handover.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(handover.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {handover.status === "HANDED_OVER" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeMutation.mutate(handover.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
