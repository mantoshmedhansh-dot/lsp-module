"use client";

import { useState } from "react";
import {
  Globe,
  Plus,
  MapPin,
  Truck,
  Building2,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminPartnerZonesPage() {
  const [filterPartner, setFilterPartner] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const queryClient = useQueryClient();

  // Note: You'll need to create an API for partner zone mappings
  // This is a placeholder that shows how the UI would work
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

  const partners = partnersData?.data?.items || [];
  const hubs = hubsData?.data?.items || [];

  // Placeholder zones - in real implementation, fetch from API
  const zones = [
    {
      id: "1",
      partnerName: "Delhivery",
      zoneName: "North East Region",
      zoneType: "REMOTE",
      pincodeCount: 150,
      handoverHub: "DEL",
      estimatedTat: 5,
      isActive: true,
    },
    {
      id: "2",
      partnerName: "DTDC",
      zoneName: "Hill Stations",
      zoneType: "LOW_VOLUME",
      pincodeCount: 80,
      handoverHub: "MUM",
      estimatedTat: 4,
      isActive: true,
    },
    {
      id: "3",
      partnerName: "BlueDart",
      zoneName: "Rural Areas",
      zoneType: "LOW_VOLUME",
      pincodeCount: 200,
      handoverHub: "BLR",
      estimatedTat: 3,
      isActive: false,
    },
  ];

  const stats = {
    totalZones: zones.length,
    activeZones: zones.filter((z) => z.isActive).length,
    totalPincodes: zones.reduce((sum, z) => sum + z.pincodeCount, 0),
    partners: new Set(zones.map((z) => z.partnerName)).size,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Zone Mapping</h1>
          <p className="text-gray-500">
            Configure areas where partners handle last-mile delivery
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Zones</p>
              <p className="text-xl font-bold">{stats.totalZones}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Zones</p>
              <p className="text-xl font-bold">{stats.activeZones}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pincodes Covered</p>
              <p className="text-xl font-bold">{stats.totalPincodes}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Partners</p>
              <p className="text-xl font-bold">{stats.partners}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Hybrid Fulfillment Zones</h3>
            <p className="text-sm text-blue-700 mt-1">
              Partner zones define areas where CJDarcl Quick handles first mile and line haul,
              then hands over to partners for last-mile delivery. This enables coverage in
              low-volume areas without building full infrastructure.
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
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
          <select className="px-4 py-2 border rounded-lg">
            <option value="">All Zone Types</option>
            <option value="REMOTE">Remote</option>
            <option value="LOW_VOLUME">Low Volume</option>
            <option value="SERVICEABLE">Serviceable</option>
          </select>
          <select className="px-4 py-2 border rounded-lg">
            <option value="">All Handover Hubs</option>
            {hubs.map((hub: any) => (
              <option key={hub.id} value={hub.id}>
                {hub.code} - {hub.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">Zone Name</th>
                <th className="text-left p-4 font-medium text-gray-600">Partner</th>
                <th className="text-left p-4 font-medium text-gray-600">Zone Type</th>
                <th className="text-left p-4 font-medium text-gray-600">Pincodes</th>
                <th className="text-left p-4 font-medium text-gray-600">Handover Hub</th>
                <th className="text-left p-4 font-medium text-gray-600">TAT (Days)</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{zone.zoneName}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-purple-500" />
                      {zone.partnerName}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        zone.zoneType === "REMOTE"
                          ? "danger"
                          : zone.zoneType === "LOW_VOLUME"
                          ? "warning"
                          : "success"
                      }
                      size="sm"
                    >
                      {zone.zoneType.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {zone.pincodeCount}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {zone.handoverHub}
                    </div>
                  </td>
                  <td className="p-4">{zone.estimatedTat}</td>
                  <td className="p-4">
                    {zone.isActive ? (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <div className="p-5">
              <h2 className="text-lg font-semibold mb-4">Add Partner Zone</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., North East Region"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Partner *
                  </label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select Partner</option>
                    {partners.map((partner: any) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.displayName || partner.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zone Type *
                  </label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option value="SERVICEABLE">Serviceable</option>
                    <option value="LOW_VOLUME">Low Volume</option>
                    <option value="REMOTE">Remote</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Handover Hub *
                  </label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select Hub</option>
                    {hubs.map((hub: any) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.code} - {hub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincodes (comma-separated) *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="110001, 110002, 110003..."
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated TAT (Days) *
                  </label>
                  <input
                    type="number"
                    defaultValue={3}
                    min={1}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button>Create Zone</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
