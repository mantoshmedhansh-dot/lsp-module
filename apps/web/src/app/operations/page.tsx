"use client";

import {
  ScanLine,
  Package,
  Handshake,
  Truck,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export default function OperationsDashboard() {
  // Fetch summary stats
  const { data: shipmentsData } = useQuery({
    queryKey: ["shipments-summary"],
    queryFn: async () => {
      const res = await fetch("/api/shipments?pageSize=1000");
      return res.json();
    },
  });

  const { data: consignmentsData } = useQuery({
    queryKey: ["consignments-summary"],
    queryFn: async () => {
      const res = await fetch("/api/consignments?pageSize=1000");
      return res.json();
    },
  });

  const { data: handoversData } = useQuery({
    queryKey: ["handovers-summary"],
    queryFn: async () => {
      const res = await fetch("/api/partner-handovers?pageSize=1000");
      return res.json();
    },
  });

  const shipments = shipmentsData?.data?.items || [];
  const consignments = consignmentsData?.data?.items || [];
  const handovers = handoversData?.data?.items || [];

  // Calculate stats
  const stats = {
    shipmentsInHub: shipments.filter((s: any) => s.status === "IN_HUB").length,
    shipmentsInTransit: shipments.filter((s: any) => s.status === "IN_TRANSIT")
      .length,
    shipmentsWithPartner: shipments.filter(
      (s: any) => s.status === "WITH_PARTNER"
    ).length,
    shipmentsOFD: shipments.filter((s: any) => s.status === "OUT_FOR_DELIVERY")
      .length,
    shipmentsDelivered: shipments.filter((s: any) => s.status === "DELIVERED")
      .length,
    openConsignments: consignments.filter((c: any) => c.status === "OPEN")
      .length,
    transitConsignments: consignments.filter(
      (c: any) => c.status === "IN_TRANSIT"
    ).length,
    pendingHandovers: handovers.filter((h: any) => h.status === "PENDING")
      .length,
  };

  const quickActions = [
    {
      href: "/operations/scanning",
      icon: ScanLine,
      label: "Hub Scanning",
      description: "Scan shipments for in/out operations",
      color: "bg-blue-500",
    },
    {
      href: "/operations/consignments",
      icon: Package,
      label: "Manage Consignments",
      description: "Create and manage consignments",
      color: "bg-green-500",
    },
    {
      href: "/operations/handovers",
      icon: Handshake,
      label: "Partner Handovers",
      description: "Handover shipments to partners",
      color: "bg-purple-500",
    },
    {
      href: "/shipments",
      icon: Truck,
      label: "Track Shipments",
      description: "View all shipments and tracking",
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-gray-500">
          Hub operations, scanning, and shipment management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Hub</p>
              <p className="text-2xl font-bold">{stats.shipmentsInHub}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-2xl font-bold">{stats.shipmentsInTransit}</p>
            </div>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Truck className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">With Partner</p>
              <p className="text-2xl font-bold">{stats.shipmentsWithPartner}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Handshake className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Delivered Today</p>
              <p className="text-2xl font-bold">{stats.shipmentsDelivered}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{action.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alerts & Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Consignments */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Open Consignments</h3>
              <Badge variant="warning">{stats.openConsignments}</Badge>
            </div>
            {stats.openConsignments > 0 ? (
              <div className="space-y-3">
                {consignments
                  .filter((c: any) => c.status === "OPEN")
                  .slice(0, 5)
                  .map((consignment: any) => (
                    <div
                      key={consignment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium">
                          {consignment.consignmentNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {consignment._count?.shipments || 0} shipments
                        </p>
                      </div>
                      <Link href={`/operations/consignments/${consignment.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                <Link
                  href="/operations/consignments"
                  className="block text-center text-sm text-primary-600 hover:underline pt-2"
                >
                  View all consignments →
                </Link>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No open consignments
              </p>
            )}
          </div>
        </Card>

        {/* Pending Handovers */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Pending Handovers</h3>
              <Badge variant="warning">{stats.pendingHandovers}</Badge>
            </div>
            {stats.pendingHandovers > 0 ? (
              <div className="space-y-3">
                {handovers
                  .filter((h: any) => h.status === "PENDING")
                  .slice(0, 5)
                  .map((handover: any) => (
                    <div
                      key={handover.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium">
                          {handover.handoverNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {handover.partner?.name} • {handover.shipmentCount}{" "}
                          shipments
                        </p>
                      </div>
                      <Link href="/operations/handovers">
                        <Button variant="ghost" size="sm">
                          Process
                        </Button>
                      </Link>
                    </div>
                  ))}
                <Link
                  href="/operations/handovers"
                  className="block text-center text-sm text-primary-600 hover:underline pt-2"
                >
                  View all handovers →
                </Link>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No pending handovers
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Fulfillment Mode Breakdown */}
      <Card>
        <div className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Fulfillment Mode Distribution
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <Truck className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">
                {shipments.filter((s: any) => s.fulfillmentMode === "OWN_FLEET")
                  .length}
              </p>
              <p className="text-sm text-green-600">Own Fleet</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Truck className="h-6 w-6 text-amber-600" />
                <ArrowRight className="h-4 w-4 text-amber-400" />
                <Handshake className="h-6 w-6 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {shipments.filter((s: any) => s.fulfillmentMode === "HYBRID")
                  .length}
              </p>
              <p className="text-sm text-amber-600">Hybrid</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Handshake className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-700">
                {shipments.filter((s: any) => s.fulfillmentMode === "PARTNER")
                  .length}
              </p>
              <p className="text-sm text-purple-600">Partner</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
