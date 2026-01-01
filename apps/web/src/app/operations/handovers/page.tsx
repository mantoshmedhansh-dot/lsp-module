"use client";

import { useState } from "react";
import {
  Handshake,
  Plus,
  Search,
  Package,
  CheckCircle2,
  Clock,
  Building2,
  Truck,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "warning",
  HANDED_OVER: "info",
  ACKNOWLEDGED: "success",
};

export default function PartnerHandoversPage() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch handovers
  const { data, isLoading } = useQuery({
    queryKey: ["partner-handovers", filterStatus, filterPartner],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPartner) params.set("partnerId", filterPartner);
      params.set("pageSize", "50");

      const res = await fetch(`/api/partner-handovers?${params}`);
      return res.json();
    },
  });

  // Fetch partners for filter
  const { data: partnersData } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const res = await fetch("/api/partners?pageSize=100");
      return res.json();
    },
  });

  // Fetch hubs for create modal
  const { data: hubsData } = useQuery({
    queryKey: ["hubs"],
    queryFn: async () => {
      const res = await fetch("/api/hubs?pageSize=100");
      return res.json();
    },
  });

  // Acknowledge mutation
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
      queryClient.invalidateQueries({ queryKey: ["partner-handovers"] });
    },
  });

  const handovers = data?.data?.items || [];
  const partners = partnersData?.data?.items || [];
  const hubs = hubsData?.data?.items || [];

  // Stats
  const stats = {
    pending: handovers.filter((h: any) => h.status === "PENDING").length,
    handedOver: handovers.filter((h: any) => h.status === "HANDED_OVER").length,
    acknowledged: handovers.filter((h: any) => h.status === "ACKNOWLEDGED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Handovers</h1>
          <p className="text-gray-500">
            Manage shipment handovers to partner networks
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Handover
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Handshake className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Handed Over</p>
              <p className="text-xl font-bold">{stats.handedOver}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Acknowledged</p>
              <p className="text-xl font-bold">{stats.acknowledged}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="HANDED_OVER">Handed Over</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
          </select>
          <select
            value={filterPartner}
            onChange={(e) => setFilterPartner(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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

      {/* Handovers List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">
                  Handover #
                </th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Partner
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Hub</th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Shipments
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Weight</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">
                  Created
                </th>
                <th className="text-right p-4 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : handovers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No handovers found
                  </td>
                </tr>
              ) : (
                handovers.map((handover: any) => (
                  <tr key={handover.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono font-medium">
                        {handover.handoverNumber}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-purple-500" />
                        <span>
                          {handover.partner?.displayName ||
                            handover.partner?.name ||
                            "-"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>
                          {handover.handoverHub?.code} -{" "}
                          {handover.handoverHub?.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span>{handover.shipmentCount}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {handover.totalWeightKg?.toFixed(1) || 0} kg
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          (STATUS_COLORS[handover.status] as any) || "secondary"
                        }
                      >
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
                            onClick={() =>
                              acknowledgeMutation.mutate(handover.id)
                            }
                            disabled={acknowledgeMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          View
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

      {/* Create Modal */}
      {showCreateModal && (
        <CreateHandoverModal
          partners={partners}
          hubs={hubs}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["partner-handovers"] });
          }}
        />
      )}
    </div>
  );
}

// Create Handover Modal
function CreateHandoverModal({
  partners,
  hubs,
  onClose,
  onSuccess,
}: {
  partners: any[];
  hubs: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [partnerId, setPartnerId] = useState("");
  const [handoverHubId, setHandoverHubId] = useState("");
  const [awbNumbers, setAwbNumbers] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const awbList = awbNumbers
      .split(/[\n,]/)
      .map((awb) => awb.trim())
      .filter(Boolean);

    if (awbList.length === 0) {
      setError("Please enter at least one AWB number");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/partner-handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          handoverHubId,
          awbNumbers: awbList,
          handedOverBy: "HUB_OPERATOR",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to create handover");
        return;
      }

      onSuccess();
    } catch (err) {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <div className="p-5">
          <h2 className="text-lg font-semibold mb-4">Create Partner Handover</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Partner *
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Partner</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.displayName || partner.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Handover Hub *
              </label>
              <select
                value={handoverHubId}
                onChange={(e) => setHandoverHubId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Hub</option>
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.code} - {hub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AWB Numbers * (one per line or comma-separated)
              </label>
              <textarea
                value={awbNumbers}
                onChange={(e) => setAwbNumbers(e.target.value)}
                rows={5}
                required
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                placeholder="CJD20260101ABC123&#10;CJD20260101DEF456&#10;CJD20260101GHI789"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Handover"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
