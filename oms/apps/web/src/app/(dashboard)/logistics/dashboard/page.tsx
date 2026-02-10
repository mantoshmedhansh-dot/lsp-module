"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Shipment {
  id: string;
  status: string;
  deliveredAt: string | null;
  createdAt: string;
  shippedAt: string | null;
  estimatedDelivery: string | null;
  transporterName: string | null;
  transporterCode: string | null;
}

interface Transporter {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count?: {
    deliveries: number;
  };
}

interface ShipmentStats {
  total: number;
  inTransit: number;
  deliveredToday: number;
  pendingPickup: number;
  delayed: number;
  ndrPending: number;
}

interface CourierPerformance {
  name: string;
  code: string;
  onTime: number;
  delayed: number;
  total: number;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isDelayed(shipment: Shipment): boolean {
  if (shipment.status === "DELIVERED" || shipment.status === "FAILED") return false;
  if (!shipment.estimatedDelivery) return false;
  return new Date(shipment.estimatedDelivery) < new Date();
}

function computeStats(shipments: Shipment[]): ShipmentStats {
  const total = shipments.length;
  const inTransit = shipments.filter(
    (s) => s.status === "IN_TRANSIT" || s.status === "OUT_FOR_DELIVERY"
  ).length;
  const deliveredToday = shipments.filter(
    (s) => s.status === "DELIVERED" && isToday(s.deliveredAt)
  ).length;
  const pendingPickup = shipments.filter(
    (s) => s.status === "PENDING" || s.status === "PICKED_UP"
  ).length;
  const delayed = shipments.filter((s) => isDelayed(s)).length;
  const ndrPending = shipments.filter(
    (s) => s.status === "FAILED" || s.status === "RTO_INITIATED"
  ).length;

  return { total, inTransit, deliveredToday, pendingPickup, delayed, ndrPending };
}

function computeCourierPerformance(
  shipments: Shipment[],
  transporters: Transporter[]
): CourierPerformance[] {
  const courierMap = new Map<
    string,
    { name: string; code: string; delivered: number; total: number; onTimeCount: number }
  >();

  for (const shipment of shipments) {
    const key = shipment.transporterCode || shipment.transporterName || "UNKNOWN";
    if (!courierMap.has(key)) {
      const transporter = transporters.find(
        (t) => t.code === shipment.transporterCode || t.name === shipment.transporterName
      );
      courierMap.set(key, {
        name: transporter?.name || shipment.transporterName || key,
        code: shipment.transporterCode || key,
        delivered: 0,
        total: 0,
        onTimeCount: 0,
      });
    }
    const entry = courierMap.get(key)!;
    entry.total++;
    if (shipment.status === "DELIVERED") {
      entry.delivered++;
      if (!isDelayed(shipment)) {
        entry.onTimeCount++;
      }
    }
  }

  return Array.from(courierMap.values())
    .filter((c) => c.total > 0)
    .map((c) => ({
      name: c.name,
      code: c.code,
      onTime: c.total > 0 ? Math.round((c.onTimeCount / c.total) * 100) : 0,
      delayed: c.total > 0 ? Math.round(((c.total - c.onTimeCount) / c.total) * 100) : 0,
      total: c.total,
    }))
    .sort((a, b) => b.total - a.total);
}

export default function LogisticsDashboardPage() {
  const {
    data: shipmentsData,
    isLoading: shipmentsLoading,
    refetch: refetchShipments,
  } = useQuery({
    queryKey: ["logistics-dashboard-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch shipments");
      const result = await res.json();
      const items: Shipment[] = Array.isArray(result)
        ? result
        : result?.shipments || result?.data || result?.items || [];
      return items;
    },
  });

  const {
    data: transportersData,
    isLoading: transportersLoading,
    refetch: refetchTransporters,
  } = useQuery({
    queryKey: ["logistics-dashboard-transporters"],
    queryFn: async () => {
      const res = await fetch("/api/v1/transporters?limit=100");
      if (!res.ok) throw new Error("Failed to fetch transporters");
      const result = await res.json();
      const items: Transporter[] = Array.isArray(result)
        ? result
        : result?.data || result?.items || [];
      return items;
    },
  });

  const isLoading = shipmentsLoading || transportersLoading;
  const shipments = shipmentsData || [];
  const transporters = transportersData || [];

  const shipmentStats = computeStats(shipments);
  const courierPerformance = computeCourierPerformance(shipments, transporters);

  // Estimate cost savings based on delivered shipments (simplified metric)
  const costSavings = shipments.filter((s) => s.status === "DELIVERED").length * 150;

  const stats = [
    {
      title: "Total Shipments",
      value: shipmentStats.total.toLocaleString(),
      subtitle: "All shipments in system",
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "In Transit",
      value: shipmentStats.inTransit.toLocaleString(),
      subtitle: "Currently moving",
      icon: Truck,
      color: "text-orange-600",
    },
    {
      title: "Delivered Today",
      value: shipmentStats.deliveredToday.toLocaleString(),
      subtitle: "Successful deliveries",
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Pending Pickup",
      value: shipmentStats.pendingPickup.toLocaleString(),
      subtitle: "Awaiting pickup",
      icon: Clock,
      color: "text-yellow-600",
    },
  ];

  const handleRefresh = () => {
    refetchShipments();
    refetchTransporters();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor shipment performance and courier metrics
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Courier Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Courier Performance</CardTitle>
          <CardDescription>
            On-time delivery rates by courier partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {courierPerformance.length > 0 ? (
            <div className="space-y-4">
              {courierPerformance.map((courier) => (
                <div key={courier.code} className="flex items-center gap-4">
                  <div className="w-24 font-medium">{courier.name}</div>
                  <div className="flex-1">
                    <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="bg-green-500"
                        style={{ width: `${courier.onTime}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${courier.delayed}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <Badge variant={courier.onTime >= 90 ? "default" : "secondary"}>
                      {courier.onTime}% OTD
                    </Badge>
                  </div>
                  <div className="w-20 text-right text-sm text-muted-foreground">
                    {courier.total} shipments
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No courier performance data</p>
              <p className="text-sm text-muted-foreground">
                Metrics will appear once shipments are processed
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Delayed Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{shipmentStats.delayed}</p>
            <p className="text-sm text-muted-foreground">Shipments delayed beyond SLA</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              NDR Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{shipmentStats.ndrPending}</p>
            <p className="text-sm text-muted-foreground">Non-delivery reports pending action</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Cost Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {costSavings > 0 ? `\u20B9${costSavings.toLocaleString()}` : "--"}
            </p>
            <p className="text-sm text-muted-foreground">Estimated savings via optimization</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
