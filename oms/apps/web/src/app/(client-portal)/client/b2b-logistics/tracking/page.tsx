"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Truck,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  Phone,
  Navigation,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface VehicleTracking {
  id: string;
  lrNumber: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  origin: string;
  destination: string;
  currentLocation: string;
  status: string;
  eta: string;
  lastUpdated: string;
  progress: number;
  milestones: { location: string; time: string; status: string }[];
}

export default function VehicleTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleTracking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("lr") || "");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTracking | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/b2b-logistics/tracking");
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : data.items || []);
      } else {
        // Demo data
        setVehicles([
          {
            id: "1",
            lrNumber: "LR-2026-0001",
            vehicleNumber: "MH-12-AB-1234",
            driverName: "Ramesh Kumar",
            driverPhone: "9876543210",
            origin: "Delhi",
            destination: "Mumbai",
            currentLocation: "Near Jaipur, Rajasthan",
            status: "IN_TRANSIT",
            eta: "2026-01-20T14:00:00",
            lastUpdated: new Date().toISOString(),
            progress: 45,
            milestones: [
              { location: "Delhi (Origin)", time: "2026-01-18 09:00", status: "COMPLETED" },
              { location: "Jaipur", time: "2026-01-18 18:00", status: "COMPLETED" },
              { location: "Ahmedabad", time: "2026-01-19 12:00", status: "PENDING" },
              { location: "Mumbai (Destination)", time: "2026-01-20 14:00", status: "PENDING" },
            ],
          },
          {
            id: "2",
            lrNumber: "LR-2026-0002",
            vehicleNumber: "MH-14-CD-5678",
            driverName: "Suresh Singh",
            driverPhone: "9876543211",
            origin: "Delhi",
            destination: "Pune",
            currentLocation: "Pune City",
            status: "OUT_FOR_DELIVERY",
            eta: "2026-01-19T16:00:00",
            lastUpdated: new Date().toISOString(),
            progress: 95,
            milestones: [
              { location: "Delhi (Origin)", time: "2026-01-17 08:00", status: "COMPLETED" },
              { location: "Indore", time: "2026-01-17 22:00", status: "COMPLETED" },
              { location: "Pune City", time: "2026-01-19 10:00", status: "COMPLETED" },
              { location: "Delivery Point", time: "2026-01-19 16:00", status: "PENDING" },
            ],
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      IN_TRANSIT: "bg-blue-100 text-blue-700",
      OUT_FOR_DELIVERY: "bg-amber-100 text-amber-700",
      DELIVERED: "bg-green-100 text-green-700",
      DELAYED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const filteredVehicles = vehicles.filter((v) =>
    !searchQuery ||
    v.lrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicle Tracking</h1>
          <p className="text-gray-500">Track your shipments in real-time</p>
        </div>
        <button
          onClick={fetchVehicles}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by LR Number or Vehicle Number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-lg border p-8 flex justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="bg-white rounded-lg border p-8 text-center">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No vehicles in transit</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => setSelectedVehicle(vehicle)}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                  selectedVehicle?.id === vehicle.id ? "ring-2 ring-blue-500" : "hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-blue-600">{vehicle.lrNumber}</p>
                    <p className="text-sm text-gray-500">{vehicle.vehicleNumber}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{vehicle.origin}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{vehicle.destination}</span>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{vehicle.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className={`h-2 rounded-full ${
                        vehicle.progress >= 90 ? "bg-green-500" : vehicle.progress >= 50 ? "bg-blue-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${vehicle.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Navigation className="h-3 w-3" />
                    <span>{vehicle.currentLocation}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>ETA: {new Date(vehicle.eta).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vehicle Details */}
        <div className="bg-white rounded-lg border">
          {selectedVehicle ? (
            <div>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{selectedVehicle.lrNumber}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedVehicle.status)}`}>
                    {selectedVehicle.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Driver Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Driver Information</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedVehicle.driverName}</p>
                      <p className="text-sm text-gray-500">{selectedVehicle.vehicleNumber}</p>
                    </div>
                    <a
                      href={`tel:${selectedVehicle.driverPhone}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </a>
                  </div>
                </div>

                {/* Current Location */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 uppercase mb-2">Current Location</p>
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    <p className="font-medium text-blue-800">{selectedVehicle.currentLocation}</p>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Last updated: {new Date(selectedVehicle.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>

                {/* Route Milestones */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Route Progress</p>
                  <div className="space-y-3">
                    {selectedVehicle.milestones.map((milestone, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          milestone.status === "COMPLETED" ? "bg-green-100" : "bg-gray-100"
                        }`}>
                          {milestone.status === "COMPLETED" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            milestone.status === "COMPLETED" ? "text-gray-800" : "text-gray-500"
                          }`}>
                            {milestone.location}
                          </p>
                          <p className="text-xs text-gray-500">{milestone.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map Placeholder */}
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MapPin className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Live map view coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a vehicle to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
