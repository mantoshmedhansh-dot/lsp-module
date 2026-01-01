"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Route as RouteIcon,
  Truck,
  User,
  Calendar,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Card, Button } from "@cjdquick/ui";

interface FormData {
  routeId: string;
  vehicleId: string;
  driverId: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  estimatedCost: string;
  notes: string;
  sealNumber: string;
}

async function fetchRoutes() {
  const res = await fetch("/api/routes?pageSize=100&isActive=true");
  return res.json();
}

async function fetchVehicles() {
  const res = await fetch("/api/vehicles?pageSize=100&status=AVAILABLE");
  return res.json();
}

async function fetchDrivers() {
  const res = await fetch("/api/drivers?pageSize=100&status=AVAILABLE");
  return res.json();
}

async function createTrip(data: FormData) {
  const res = await fetch("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      scheduledDeparture: new Date(data.scheduledDeparture),
      scheduledArrival: new Date(data.scheduledArrival),
      estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : undefined,
    }),
  });
  const result = await res.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to create trip");
  }
  return result;
}

export default function NewTripPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    routeId: "",
    vehicleId: "",
    driverId: "",
    scheduledDeparture: "",
    scheduledArrival: "",
    estimatedCost: "",
    notes: "",
    sealNumber: "",
  });
  const [error, setError] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  const { data: routesData } = useQuery({
    queryKey: ["routes-list"],
    queryFn: fetchRoutes,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ["vehicles-available"],
    queryFn: fetchVehicles,
  });

  const { data: driversData } = useQuery({
    queryKey: ["drivers-available"],
    queryFn: fetchDrivers,
  });

  const routes = routesData?.data?.items || [];
  const vehicles = vehiclesData?.data?.items || [];
  const drivers = driversData?.data?.items || [];

  // Update selected route when routeId changes
  useEffect(() => {
    if (formData.routeId) {
      const route = routes.find((r: any) => r.id === formData.routeId);
      setSelectedRoute(route);
      if (route?.baseCostPerTrip) {
        setFormData((prev) => ({
          ...prev,
          estimatedCost: route.baseCostPerTrip.toString(),
        }));
      }
    }
  }, [formData.routeId, routes]);

  // Auto-calculate arrival time based on departure and route duration
  useEffect(() => {
    if (formData.scheduledDeparture && selectedRoute?.estimatedDurationMin) {
      const departure = new Date(formData.scheduledDeparture);
      departure.setMinutes(departure.getMinutes() + selectedRoute.estimatedDurationMin);
      const arrivalStr = departure.toISOString().slice(0, 16);
      setFormData((prev) => ({
        ...prev,
        scheduledArrival: arrivalStr,
      }));
    }
  }, [formData.scheduledDeparture, selectedRoute]);

  const mutation = useMutation({
    mutationFn: createTrip,
    onSuccess: (data) => {
      router.push(`/trips/${data.data.id}`);
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.routeId) {
      setError("Please select a route");
      return;
    }
    if (!formData.vehicleId) {
      setError("Please select a vehicle");
      return;
    }
    if (!formData.driverId) {
      setError("Please select a driver");
      return;
    }
    if (!formData.scheduledDeparture) {
      setError("Please set departure time");
      return;
    }
    if (!formData.scheduledArrival) {
      setError("Please set arrival time");
      return;
    }

    mutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Set default departure to next hour
  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const defaultDeparture = now.toISOString().slice(0, 16);
    setFormData((prev) => ({
      ...prev,
      scheduledDeparture: defaultDeparture,
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trips">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan New Trip</h1>
          <p className="text-gray-600">Schedule a transport trip</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Route Selection */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <RouteIcon className="h-5 w-5" />
                Select Route
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route *
                  </label>
                  <select
                    name="routeId"
                    value={formData.routeId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a route</option>
                    {routes.map((route: any) => (
                      <option key={route.id} value={route.id}>
                        {route.code} - {route.name} ({route.distanceKm} km)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRoute && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">Type:</span>{" "}
                        <span className="font-medium">
                          {selectedRoute.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Distance:</span>{" "}
                        <span className="font-medium">{selectedRoute.distanceKm} km</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>{" "}
                        <span className="font-medium">
                          {Math.floor(selectedRoute.estimatedDurationMin / 60)}h{" "}
                          {selectedRoute.estimatedDurationMin % 60}m
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Est. Cost:</span>{" "}
                        <span className="font-medium">
                          Rs. {selectedRoute.baseCostPerTrip?.toLocaleString() || "N/A"}
                        </span>
                      </div>
                      {selectedRoute.originHub && (
                        <div className="col-span-2">
                          <span className="text-gray-500">From:</span>{" "}
                          <span className="font-medium">
                            {selectedRoute.originHub.name}
                          </span>
                        </div>
                      )}
                      {selectedRoute.destinationHub && (
                        <div className="col-span-2">
                          <span className="text-gray-500">To:</span>{" "}
                          <span className="font-medium">
                            {selectedRoute.destinationHub.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Schedule */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5" />
                Schedule
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departure Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduledDeparture"
                    value={formData.scheduledDeparture}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Arrival *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduledArrival"
                    value={formData.scheduledArrival}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  {selectedRoute && (
                    <p className="text-xs text-gray-500 mt-1">
                      Auto-calculated based on route duration
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Vehicle Selection */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Truck className="h-5 w-5" />
                Select Vehicle
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle *
                  </label>
                  <select
                    name="vehicleId"
                    value={formData.vehicleId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.map((vehicle: any) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNo} - {vehicle.type.replace(/_/g, " ")} (
                        {vehicle.capacityTonnage}T)
                      </option>
                    ))}
                  </select>
                </div>

                {vehicles.length === 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    No available vehicles. Please ensure vehicles are in AVAILABLE status.
                  </div>
                )}

                {selectedRoute?.recommendedVehicle && (
                  <p className="text-sm text-gray-500">
                    Recommended: {selectedRoute.recommendedVehicle.replace(/_/g, " ")}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Driver Selection */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <User className="h-5 w-5" />
                Select Driver
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver *
                  </label>
                  <select
                    name="driverId"
                    value={formData.driverId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a driver</option>
                    {drivers.map((driver: any) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} ({driver.employeeCode}) - {driver.licenseType}
                      </option>
                    ))}
                  </select>
                </div>

                {drivers.length === 0 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    No available drivers. Please ensure drivers are in AVAILABLE status.
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Additional Details */}
          <Card className="lg:col-span-2">
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Additional Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    name="estimatedCost"
                    value={formData.estimatedCost}
                    onChange={handleChange}
                    placeholder="Auto-filled from route"
                    min="0"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seal Number
                  </label>
                  <input
                    type="text"
                    name="sealNumber"
                    value={formData.sealNumber}
                    onChange={handleChange}
                    placeholder="Vehicle seal number"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any special instructions"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/trips">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Plan Trip"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
