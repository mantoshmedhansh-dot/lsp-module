"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Truck,
  Users,
  Route,
  Navigation,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Plus,
  ChevronRight,
  Zap,
  Package,
  Layers,
  ScanLine,
  Handshake,
  Globe,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";

async function fetchDashboardStats() {
  const [hubsRes, vehiclesRes, driversRes, routesRes, tripsRes, shipmentsRes, consignmentsRes, handoversRes] = await Promise.all([
    fetch("/api/hubs?pageSize=1000"),
    fetch("/api/vehicles?pageSize=1000"),
    fetch("/api/drivers?pageSize=1000"),
    fetch("/api/routes?pageSize=1000"),
    fetch("/api/trips?pageSize=1000"),
    fetch("/api/shipments?pageSize=1000"),
    fetch("/api/consignments?pageSize=1000"),
    fetch("/api/partner-handovers?pageSize=1000"),
  ]);

  const [hubs, vehicles, drivers, routes, trips, shipments, consignments, handovers] = await Promise.all([
    hubsRes.json(),
    vehiclesRes.json(),
    driversRes.json(),
    routesRes.json(),
    tripsRes.json(),
    shipmentsRes.json(),
    consignmentsRes.json(),
    handoversRes.json(),
  ]);

  return { hubs, vehicles, drivers, routes, trips, shipments, consignments, handovers };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{title}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
            <div className={`p-3 rounded-full ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PhaseCard({
  phase,
  title,
  description,
  stats,
  actions,
  color,
}: {
  phase: string;
  title: string;
  description: string;
  stats: { label: string; value: number | string; status?: string }[];
  actions: { label: string; href: string; primary?: boolean }[];
  color: string;
}) {
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`text-xs font-bold ${color} px-2 py-1 rounded`}>
              {phase}
            </span>
            <h3 className="text-lg font-semibold text-gray-900 mt-2">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
              {stat.status && (
                <span
                  className={`text-xs ${
                    stat.status === "active"
                      ? "text-green-600"
                      : stat.status === "warning"
                      ? "text-yellow-600"
                      : "text-gray-500"
                  }`}
                >
                  {stat.status === "active" ? "Active" : stat.status}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {actions.map((action, idx) => (
            <Link key={idx} href={action.href} className="flex-1">
              <Button
                variant={action.primary ? "default" : "outline"}
                size="sm"
                className="w-full"
              >
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboardStats,
  });

  const hubs = data?.hubs?.data?.items || [];
  const vehicles = data?.vehicles?.data?.items || [];
  const drivers = data?.drivers?.data?.items || [];
  const routes = data?.routes?.data?.items || [];
  const trips = data?.trips?.data?.items || [];
  const shipments = data?.shipments?.data?.items || [];
  const consignments = data?.consignments?.data?.items || [];
  const handovers = data?.handovers?.data?.items || [];

  // Calculate stats
  const hubStats = {
    total: hubs.length,
    active: hubs.filter((h: any) => h.isActive).length,
    gateway: hubs.filter((h: any) => h.type === "GATEWAY").length,
    transshipment: hubs.filter((h: any) => h.type === "TRANSSHIPMENT").length,
  };

  const vehicleStats = {
    total: vehicles.length,
    available: vehicles.filter((v: any) => v.status === "AVAILABLE").length,
    inTransit: vehicles.filter((v: any) => v.status === "IN_TRANSIT").length,
    maintenance: vehicles.filter((v: any) => v.status === "MAINTENANCE").length,
  };

  const driverStats = {
    total: drivers.length,
    available: drivers.filter((d: any) => d.status === "AVAILABLE").length,
    onTrip: drivers.filter((d: any) => d.status === "ON_TRIP").length,
    onLeave: drivers.filter((d: any) => d.status === "ON_LEAVE").length,
  };

  const routeStats = {
    total: routes.length,
    active: routes.filter((r: any) => r.isActive).length,
    lineHaul: routes.filter((r: any) => r.type === "LINE_HAUL").length,
    milkRun: routes.filter((r: any) => r.type?.includes("MILK_RUN")).length,
  };

  const tripStats = {
    total: trips.length,
    planned: trips.filter((t: any) => t.status === "PLANNED").length,
    inTransit: trips.filter((t: any) => t.status === "IN_TRANSIT").length,
    completed: trips.filter((t: any) => t.status === "COMPLETED").length,
  };

  const shipmentStats = {
    total: shipments.length,
    inHub: shipments.filter((s: any) => s.status === "IN_HUB").length,
    inTransit: shipments.filter((s: any) => s.status === "IN_TRANSIT").length,
    withPartner: shipments.filter((s: any) => s.status === "WITH_PARTNER").length,
    delivered: shipments.filter((s: any) => s.status === "DELIVERED").length,
    ownFleet: shipments.filter((s: any) => s.fulfillmentMode === "OWN_FLEET").length,
    hybrid: shipments.filter((s: any) => s.fulfillmentMode === "HYBRID").length,
    partner: shipments.filter((s: any) => s.fulfillmentMode === "PARTNER").length,
  };

  const consignmentStats = {
    total: consignments.length,
    open: consignments.filter((c: any) => c.status === "OPEN").length,
    inTransit: consignments.filter((c: any) => c.status === "IN_TRANSIT").length,
  };

  const handoverStats = {
    total: handovers.length,
    pending: handovers.filter((h: any) => h.status === "PENDING").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <p className="ml-2 text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            PTL Operations Dashboard
          </h1>
          <p className="text-gray-500">
            Manage your hub network, fleet, and transport operations
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <StatCard
          title="Hubs"
          value={hubStats.total}
          subtitle={`${hubStats.active} active`}
          icon={Building2}
          color="bg-blue-100 text-blue-600"
          href="/admin/hubs"
        />
        <StatCard
          title="Vehicles"
          value={vehicleStats.total}
          subtitle={`${vehicleStats.available} available`}
          icon={Truck}
          color="bg-green-100 text-green-600"
          href="/admin/vehicles"
        />
        <StatCard
          title="Drivers"
          value={driverStats.total}
          subtitle={`${driverStats.available} available`}
          icon={Users}
          color="bg-purple-100 text-purple-600"
          href="/admin/drivers"
        />
        <StatCard
          title="Routes"
          value={routeStats.total}
          subtitle={`${routeStats.active} active`}
          icon={Route}
          color="bg-orange-100 text-orange-600"
          href="/admin/routes"
        />
        <StatCard
          title="Trips"
          value={tripStats.total}
          subtitle={`${tripStats.inTransit} in transit`}
          icon={Navigation}
          color="bg-indigo-100 text-indigo-600"
          href="/admin/trips"
        />
        <StatCard
          title="Shipments"
          value={shipmentStats.total}
          subtitle={`${shipmentStats.inTransit} in transit`}
          icon={Package}
          color="bg-amber-100 text-amber-600"
          href="/admin/shipments"
        />
        <StatCard
          title="Consignments"
          value={consignmentStats.total}
          subtitle={`${consignmentStats.open} open`}
          icon={Layers}
          color="bg-cyan-100 text-cyan-600"
          href="/admin/consignments"
        />
        <StatCard
          title="Handovers"
          value={handoverStats.total}
          subtitle={`${handoverStats.pending} pending`}
          icon={Handshake}
          color="bg-pink-100 text-pink-600"
          href="/admin/handovers"
        />
      </div>

      {/* Phase Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PhaseCard
          phase="PHASE I"
          title="Hub Network"
          description="Manage transshipment centers and pincode coverage"
          color="bg-blue-100 text-blue-800"
          stats={[
            { label: "Gateway Hubs", value: hubStats.gateway },
            { label: "Transshipment", value: hubStats.transshipment },
            { label: "Active Hubs", value: hubStats.active, status: "active" },
            { label: "Total Capacity", value: `${hubs.reduce((acc: number, h: any) => acc + (h.sortingCapacity || 0), 0).toLocaleString()}/hr` },
          ]}
          actions={[
            { label: "View Hubs", href: "/admin/hubs" },
            { label: "Add Hub", href: "/hubs/new", primary: true },
          ]}
        />

        <PhaseCard
          phase="PHASE II"
          title="Fleet Management"
          description="Manage vehicles and drivers for PTL operations"
          color="bg-green-100 text-green-800"
          stats={[
            { label: "Available Vehicles", value: vehicleStats.available },
            { label: "In Transit", value: vehicleStats.inTransit },
            { label: "Available Drivers", value: driverStats.available },
            { label: "On Trip", value: driverStats.onTrip },
          ]}
          actions={[
            { label: "View Fleet", href: "/admin/vehicles" },
            { label: "Add Vehicle", href: "/fleet/vehicles/new", primary: true },
          ]}
        />

        <PhaseCard
          phase="PHASE III"
          title="Routes & Trips"
          description="Define routes and plan transport trips"
          color="bg-purple-100 text-purple-800"
          stats={[
            { label: "Active Routes", value: routeStats.active },
            { label: "Line Haul", value: routeStats.lineHaul },
            { label: "Planned Trips", value: tripStats.planned },
            { label: "In Transit", value: tripStats.inTransit },
          ]}
          actions={[
            { label: "View Routes", href: "/admin/routes" },
            { label: "Plan Trip", href: "/trips/new", primary: true },
          ]}
        />

        <PhaseCard
          phase="PHASE IV"
          title="Shipment Orchestration"
          description="Manage shipments with hybrid fulfillment (own fleet + partners)"
          color="bg-amber-100 text-amber-800"
          stats={[
            { label: "Own Fleet", value: shipmentStats.ownFleet },
            { label: "Hybrid", value: shipmentStats.hybrid },
            { label: "Partner", value: shipmentStats.partner },
            { label: "Delivered", value: shipmentStats.delivered },
          ]}
          actions={[
            { label: "View Shipments", href: "/admin/shipments" },
            { label: "Hub Scanning", href: "/admin/scanning", primary: true },
          ]}
        />
      </div>

      {/* Operations Quick Access */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary-600" />
            Operations Center
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/scanning">
              <div className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                <ScanLine className="h-8 w-8 text-blue-600 mb-2" />
                <h3 className="font-medium text-gray-900">Hub Scanning</h3>
                <p className="text-sm text-gray-500">Scan shipments at hubs</p>
              </div>
            </Link>
            <Link href="/admin/consignments">
              <div className="p-4 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors cursor-pointer">
                <Layers className="h-8 w-8 text-cyan-600 mb-2" />
                <h3 className="font-medium text-gray-900">Consignments</h3>
                <p className="text-sm text-gray-500">{consignmentStats.open} open consignments</p>
              </div>
            </Link>
            <Link href="/admin/handovers">
              <div className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer">
                <Handshake className="h-8 w-8 text-purple-600 mb-2" />
                <h3 className="font-medium text-gray-900">Partner Handovers</h3>
                <p className="text-sm text-gray-500">{handoverStats.pending} pending</p>
              </div>
            </Link>
            <Link href="/admin/partner-zones">
              <div className="p-4 bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors cursor-pointer">
                <Globe className="h-8 w-8 text-pink-600 mb-2" />
                <h3 className="font-medium text-gray-900">Partner Zones</h3>
                <p className="text-sm text-gray-500">Configure coverage areas</p>
              </div>
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/hubs/new">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Building2 className="h-6 w-6" />
                <span>Add Hub</span>
              </Button>
            </Link>
            <Link href="/fleet/vehicles/new">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Truck className="h-6 w-6" />
                <span>Add Vehicle</span>
              </Button>
            </Link>
            <Link href="/fleet/drivers/new">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users className="h-6 w-6" />
                <span>Add Driver</span>
              </Button>
            </Link>
            <Link href="/routes/new">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Route className="h-6 w-6" />
                <span>Add Route</span>
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Trips</h2>
              <Link href="/admin/trips">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            {trips.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Navigation className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p>No trips yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.slice(0, 5).map((trip: any) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {trip.tripNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {trip.route?.name || "Route"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        trip.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : trip.status === "IN_TRANSIT"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {trip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <div className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts & Notifications
            </h2>
            <div className="space-y-3">
              {vehicleStats.maintenance > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                  <Truck className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                      {vehicleStats.maintenance} vehicle(s) under maintenance
                    </p>
                  </div>
                  <Link href="/admin/vehicles">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              )}
              {driverStats.onLeave > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">
                      {driverStats.onLeave} driver(s) on leave
                    </p>
                  </div>
                  <Link href="/admin/drivers">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              )}
              {tripStats.planned > 0 && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-800">
                      {tripStats.planned} trip(s) planned for dispatch
                    </p>
                  </div>
                  <Link href="/admin/trips">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              )}
              {vehicleStats.maintenance === 0 &&
                driverStats.onLeave === 0 &&
                tripStats.planned === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-400 mb-2" />
                    <p>All systems operational</p>
                  </div>
                )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
