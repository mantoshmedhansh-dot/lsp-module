"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";

async function fetchFleetStats() {
  const [vehiclesRes, driversRes] = await Promise.all([
    fetch("/api/vehicles?pageSize=100"),
    fetch("/api/drivers?pageSize=100"),
  ]);

  const vehicles = await vehiclesRes.json();
  const drivers = await driversRes.json();

  return { vehicles: vehicles.data, drivers: drivers.data };
}

function getStatusColor(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "bg-green-100 text-green-800";
    case "IN_TRANSIT":
    case "ON_TRIP":
      return "bg-blue-100 text-blue-800";
    case "MAINTENANCE":
    case "ON_LEAVE":
      return "bg-yellow-100 text-yellow-800";
    case "BREAKDOWN":
    case "INACTIVE":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function FleetDashboardPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["fleet-stats"],
    queryFn: fetchFleetStats,
  });

  const vehicles = data?.vehicles?.items || [];
  const drivers = data?.drivers?.items || [];

  // Calculate stats
  const vehicleStats = {
    total: vehicles.length,
    available: vehicles.filter((v: any) => v.status === "AVAILABLE").length,
    inTransit: vehicles.filter((v: any) => v.status === "IN_TRANSIT").length,
    maintenance: vehicles.filter((v: any) => v.status === "MAINTENANCE").length,
    breakdown: vehicles.filter((v: any) => v.status === "BREAKDOWN").length,
  };

  const driverStats = {
    total: drivers.length,
    available: drivers.filter((d: any) => d.status === "AVAILABLE").length,
    onTrip: drivers.filter((d: any) => d.status === "ON_TRIP").length,
    onLeave: drivers.filter((d: any) => d.status === "ON_LEAVE").length,
  };

  // Get expiring documents (within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringDocs = vehicles.filter((v: any) => {
    const dates = [
      v.insuranceExpiry,
      v.fitnessExpiry,
      v.permitExpiry,
      v.pollutionExpiry,
    ].filter(Boolean);
    return dates.some((d) => new Date(d) <= thirtyDaysFromNow);
  });

  const expiringLicenses = drivers.filter((d: any) => {
    return d.licenseExpiry && new Date(d.licenseExpiry) <= thirtyDaysFromNow;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <p className="ml-2 text-gray-500">Loading fleet data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
          <p className="text-gray-600">
            Manage vehicles and drivers for PTL operations
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/fleet/vehicles/new">
            <Button variant="outline">
              <Truck className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </Link>
          <Link href="/fleet/drivers/new">
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Vehicles</p>
                <p className="text-3xl font-bold text-gray-900">
                  {vehicleStats.total}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-sm">
              <span className="text-green-600">
                {vehicleStats.available} available
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-600">
                {vehicleStats.inTransit} in transit
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Drivers</p>
                <p className="text-3xl font-bold text-gray-900">
                  {driverStats.total}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-sm">
              <span className="text-green-600">
                {driverStats.available} available
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-600">{driverStats.onTrip} on trip</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Under Maintenance</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {vehicleStats.maintenance}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Wrench className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-3 text-sm text-red-600">
              {vehicleStats.breakdown} breakdown
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Expiring Documents</p>
                <p className="text-3xl font-bold text-orange-600">
                  {expiringDocs.length + expiringLicenses.length}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              Within next 30 days
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicles Section */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicles
              </h2>
              <Link href="/fleet/vehicles">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {vehicles.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No vehicles registered</p>
                <Link href="/fleet/vehicles/new" className="mt-4 inline-block">
                  <Button size="sm">Add Vehicle</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.slice(0, 5).map((vehicle: any) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {vehicle.registrationNo}
                      </p>
                      <p className="text-sm text-gray-500">
                        {vehicle.type.replace("_", " ")} •{" "}
                        {vehicle.capacityTonnage}T
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                        vehicle.status
                      )}`}
                    >
                      {vehicle.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Drivers Section */}
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Drivers
              </h2>
              <Link href="/fleet/drivers">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {drivers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">No drivers registered</p>
                <Link href="/fleet/drivers/new" className="mt-4 inline-block">
                  <Button size="sm">Add Driver</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {drivers.slice(0, 5).map((driver: any) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{driver.name}</p>
                      <p className="text-sm text-gray-500">
                        {driver.employeeCode} • {driver.licenseType}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                        driver.status
                      )}`}
                    >
                      {driver.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Alerts Section */}
      {(expiringDocs.length > 0 || expiringLicenses.length > 0) && (
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Expiring Documents (Next 30 Days)
            </h2>
            <div className="space-y-2">
              {expiringDocs.map((vehicle: any) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {vehicle.registrationNo}
                    </p>
                    <p className="text-sm text-orange-600">
                      Document expiring soon
                    </p>
                  </div>
                  <Link href={`/fleet/vehicles/${vehicle.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
              {expiringLicenses.map((driver: any) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
                >
                  <div>
                    <p className="font-medium text-gray-900">{driver.name}</p>
                    <p className="text-sm text-orange-600">
                      License expiring:{" "}
                      {new Date(driver.licenseExpiry).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/fleet/drivers/${driver.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
