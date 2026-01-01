"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, Button } from "@cjdquick/ui";
import { ROUTE_TYPES, ROUTE_FREQUENCIES, VEHICLE_TYPES } from "@/lib/validations";

interface FormData {
  code: string;
  name: string;
  type: string;
  originHubId: string;
  destinationHubId: string;
  distanceKm: string;
  estimatedDurationMin: string;
  departureTime: string;
  arrivalTime: string;
  frequency: string;
  baseCostPerTrip: string;
  fuelCostPerKm: string;
  tollCost: string;
  recommendedVehicle: string;
}

async function fetchHubs() {
  const res = await fetch("/api/hubs?pageSize=100&isActive=true");
  return res.json();
}

async function createRoute(data: FormData) {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      originHubId: data.originHubId || undefined,
      destinationHubId: data.destinationHubId || undefined,
      distanceKm: parseFloat(data.distanceKm),
      estimatedDurationMin: parseInt(data.estimatedDurationMin),
      departureTime: data.departureTime || undefined,
      arrivalTime: data.arrivalTime || undefined,
      baseCostPerTrip: data.baseCostPerTrip ? parseFloat(data.baseCostPerTrip) : undefined,
      fuelCostPerKm: data.fuelCostPerKm ? parseFloat(data.fuelCostPerKm) : undefined,
      tollCost: data.tollCost ? parseFloat(data.tollCost) : undefined,
      recommendedVehicle: data.recommendedVehicle || undefined,
    }),
  });
  const result = await res.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to create route");
  }
  return result;
}

export default function NewRoutePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    code: "",
    name: "",
    type: "LINE_HAUL",
    originHubId: "",
    destinationHubId: "",
    distanceKm: "",
    estimatedDurationMin: "",
    departureTime: "",
    arrivalTime: "",
    frequency: "DAILY",
    baseCostPerTrip: "",
    fuelCostPerKm: "",
    tollCost: "",
    recommendedVehicle: "",
  });
  const [error, setError] = useState("");

  const { data: hubsData } = useQuery({
    queryKey: ["hubs-list"],
    queryFn: fetchHubs,
  });

  const hubs = hubsData?.data?.items || [];

  const mutation = useMutation({
    mutationFn: createRoute,
    onSuccess: () => {
      router.push("/routes");
    },
    onError: (err: any) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    mutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-generate name when origin/destination changes
  const autoGenerateName = () => {
    const origin = hubs.find((h: any) => h.id === formData.originHubId);
    const dest = hubs.find((h: any) => h.id === formData.destinationHubId);
    if (origin && dest) {
      setFormData((prev) => ({
        ...prev,
        name: `${origin.city} to ${dest.city}`,
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/routes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Route</h1>
          <p className="text-gray-600">Add a new transport route</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Route Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Code *
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., MUM-PUN"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route Type *
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      {ROUTE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Mumbai to Pune Line Haul"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Route Endpoints */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Route Endpoints</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origin Hub
                    </label>
                    <select
                      name="originHubId"
                      value={formData.originHubId}
                      onChange={(e) => {
                        handleChange(e);
                        setTimeout(autoGenerateName, 0);
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select origin hub</option>
                      {hubs.map((hub: any) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.code} - {hub.name} ({hub.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="h-6 w-6 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-red-600" />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination Hub
                    </label>
                    <select
                      name="destinationHubId"
                      value={formData.destinationHubId}
                      onChange={(e) => {
                        handleChange(e);
                        setTimeout(autoGenerateName, 0);
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select destination hub</option>
                      {hubs.map((hub: any) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.code} - {hub.name} ({hub.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Distance & Duration */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Distance & Duration</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distance (km) *
                    </label>
                    <input
                      type="number"
                      name="distanceKm"
                      value={formData.distanceKm}
                      onChange={handleChange}
                      placeholder="e.g., 150"
                      min="1"
                      step="0.1"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      name="estimatedDurationMin"
                      value={formData.estimatedDurationMin}
                      onChange={handleChange}
                      placeholder="e.g., 180"
                      min="10"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recommended Vehicle
                  </label>
                  <select
                    name="recommendedVehicle"
                    value={formData.recommendedVehicle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select vehicle type</option>
                    {VEHICLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Schedule */}
          <Card>
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency
                  </label>
                  <select
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {ROUTE_FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq === "MON_WED_FRI"
                          ? "Mon, Wed, Fri"
                          : freq === "TUE_THU_SAT"
                          ? "Tue, Thu, Sat"
                          : freq.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departure Time
                    </label>
                    <input
                      type="time"
                      name="departureTime"
                      value={formData.departureTime}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arrival Time
                    </label>
                    <input
                      type="time"
                      name="arrivalTime"
                      value={formData.arrivalTime}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Cost */}
          <Card className="lg:col-span-2">
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Cost Estimation</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Cost per Trip (Rs.)
                  </label>
                  <input
                    type="number"
                    name="baseCostPerTrip"
                    value={formData.baseCostPerTrip}
                    onChange={handleChange}
                    placeholder="e.g., 5000"
                    min="0"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuel Cost per km (Rs.)
                  </label>
                  <input
                    type="number"
                    name="fuelCostPerKm"
                    value={formData.fuelCostPerKm}
                    onChange={handleChange}
                    placeholder="e.g., 12"
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toll Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    name="tollCost"
                    value={formData.tollCost}
                    onChange={handleChange}
                    placeholder="e.g., 500"
                    min="0"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/routes">
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
              "Create Route"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
