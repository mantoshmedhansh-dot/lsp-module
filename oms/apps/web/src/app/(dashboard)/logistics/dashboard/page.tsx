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
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalShipments: number;
  inTransit: number;
  outForDelivery: number;
  deliveredToday: number;
  pendingPickup: number;
  delayed: number;
  ndrPending: number;
  rtoCount: number;
  deliveryRate: number;
  avgTATDays: number;
  statusBreakdown: Record<string, number>;
}

interface CourierPerformance {
  transporterId: string;
  transporterName: string;
  transporterCode: string | null;
  totalShipments: number;
  delivered: number;
  deliveryRate: number;
  onTimeRate: number;
  avgTATDays: number;
  ndrCount: number;
  delayed: number;
}

export default function LogisticsDashboardPage() {
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ["logistics-dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/logistics-dashboard/stats?period=30d");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
  });

  const {
    data: courierData,
    isLoading: courierLoading,
    refetch: refetchCourier,
  } = useQuery<CourierPerformance[]>({
    queryKey: ["logistics-dashboard-courier"],
    queryFn: async () => {
      const res = await fetch(
        "/api/v1/logistics-dashboard/courier-performance?period=30d"
      );
      if (!res.ok) throw new Error("Failed to fetch courier performance");
      const result = await res.json();
      return Array.isArray(result)
        ? result
        : result?.items || result?.data || [];
    },
  });

  const isLoading = statsLoading || courierLoading;
  const s = dashboardStats || {
    totalShipments: 0,
    inTransit: 0,
    outForDelivery: 0,
    deliveredToday: 0,
    pendingPickup: 0,
    delayed: 0,
    ndrPending: 0,
    rtoCount: 0,
    deliveryRate: 0,
    avgTATDays: 0,
    statusBreakdown: {},
  };
  const couriers = courierData || [];

  const stats = [
    {
      title: "Total Shipments",
      value: s.totalShipments.toLocaleString(),
      subtitle: "Last 30 days",
      icon: Package,
      color: "text-blue-600",
    },
    {
      title: "In Transit",
      value: (s.inTransit + s.outForDelivery).toLocaleString(),
      subtitle: "Currently moving",
      icon: Truck,
      color: "text-orange-600",
    },
    {
      title: "Delivered Today",
      value: s.deliveredToday.toLocaleString(),
      subtitle: "Successful deliveries",
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      title: "Pending Pickup",
      value: s.pendingPickup.toLocaleString(),
      subtitle: "Awaiting pickup",
      icon: Clock,
      color: "text-yellow-600",
    },
  ];

  const handleRefresh = () => {
    refetchStats();
    refetchCourier();
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
          <h1 className="text-3xl font-bold tracking-tight">
            Shipping Dashboard
          </h1>
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
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Summary Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Delivery Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Avg TAT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {s.avgTATDays > 0 ? `${s.avgTATDays} days` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              Average turnaround time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-600" />
              RTO Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.rtoCount}</div>
            <p className="text-xs text-muted-foreground">
              Return to origin shipments
            </p>
          </CardContent>
        </Card>
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
          {couriers.length > 0 ? (
            <div className="space-y-4">
              {couriers.map((courier) => (
                <div key={courier.transporterId} className="flex items-center gap-4">
                  <div className="w-28 font-medium truncate">
                    {courier.transporterName}
                  </div>
                  <div className="flex-1">
                    <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="bg-green-500"
                        style={{ width: `${courier.onTimeRate}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{
                          width: `${Math.max(0, 100 - courier.onTimeRate)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <Badge
                      variant={
                        courier.onTimeRate >= 90 ? "default" : "secondary"
                      }
                    >
                      {courier.onTimeRate}% OTD
                    </Badge>
                  </div>
                  <div className="w-24 text-right text-sm text-muted-foreground">
                    {courier.totalShipments} shipments
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No courier performance data
              </p>
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
            <p className="text-2xl font-bold">{s.delayed}</p>
            <p className="text-sm text-muted-foreground">
              Shipments delayed beyond SLA
            </p>
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
            <p className="text-2xl font-bold">{s.ndrPending}</p>
            <p className="text-sm text-muted-foreground">
              Non-delivery reports pending action
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Delivery Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {s.deliveryRate > 0 ? `${s.deliveryRate}%` : "--"}
            </p>
            <p className="text-sm text-muted-foreground">
              Overall delivery success rate
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
