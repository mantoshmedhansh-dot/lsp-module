"use client";

import { useState } from "react";
import {
  TrendingUp,
  Search,
  ArrowRight,
  Truck,
  Handshake,
  Building2,
  RefreshCw,
  Eye,
  MapPin,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const MODE_COLORS: Record<string, string> = {
  OWN_FLEET: "success",
  HYBRID: "warning",
  PARTNER: "purple",
};

export default function AdminJourneysPage() {
  const [filterMode, setFilterMode] = useState<string>("");
  const [search, setSearch] = useState("");

  // Note: You may need to create a journey plans API endpoint
  // For now, we'll show shipments with their journey data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipments-journeys", filterMode, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterMode) params.set("fulfillmentMode", filterMode);
      if (search) params.set("search", search);
      params.set("pageSize", "50");

      const res = await fetch(`/api/shipments?${params}`);
      return res.json();
    },
  });

  const shipments = data?.data?.items || [];

  // Group by fulfillment mode
  const stats = {
    total: shipments.length,
    ownFleet: shipments.filter((s: any) => s.fulfillmentMode === "OWN_FLEET").length,
    hybrid: shipments.filter((s: any) => s.fulfillmentMode === "HYBRID").length,
    partner: shipments.filter((s: any) => s.fulfillmentMode === "PARTNER").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journey Plans</h1>
          <p className="text-gray-500">View shipment journey routing decisions</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Total Journeys</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-green-600">Own Fleet</p>
              <p className="text-2xl font-bold text-green-700">{stats.ownFleet}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Truck className="h-6 w-6 text-amber-600" />
              <ArrowRight className="h-4 w-4 text-amber-400" />
              <Handshake className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Hybrid</p>
              <p className="text-2xl font-bold text-amber-700">{stats.hybrid}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50">
          <div className="flex items-center gap-3">
            <Handshake className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-purple-600">Partner</p>
              <p className="text-2xl font-bold text-purple-700">{stats.partner}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search AWB number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Modes</option>
            <option value="OWN_FLEET">Own Fleet</option>
            <option value="HYBRID">Hybrid</option>
            <option value="PARTNER">Partner</option>
          </select>
        </div>
      </Card>

      {/* Journey Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 text-center py-12 text-gray-500">
            Loading...
          </div>
        ) : shipments.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500">
            No journeys found
          </div>
        ) : (
          shipments.map((shipment: any) => (
            <Card key={shipment.id} className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-mono font-medium text-primary-600">
                    {shipment.awbNumber}
                  </p>
                  <Badge
                    variant={(MODE_COLORS[shipment.fulfillmentMode] as any) || "secondary"}
                    size="sm"
                    className="mt-1"
                  >
                    {shipment.fulfillmentMode?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <Link href={`/shipments/${shipment.id}`}>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Journey Visualization */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>{shipment.shipperPincode}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                {shipment.fulfillmentMode === "HYBRID" && (
                  <>
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded">
                      <Building2 className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-600">Handover</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </>
                )}
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span>{shipment.consigneePincode}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t flex justify-between text-sm text-gray-500">
                <span>
                  {shipment.shipperCity} → {shipment.consigneeCity}
                </span>
                <span>{shipment.status?.replace(/_/g, " ")}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
