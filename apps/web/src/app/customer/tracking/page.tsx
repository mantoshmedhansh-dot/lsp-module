"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Truck,
  ArrowRight,
  RefreshCw,
  Phone,
  User,
  Calendar,
  Weight,
  IndianRupee,
} from "lucide-react";

interface TrackingData {
  awbNumber: string;
  status: string;
  origin: {
    city: string;
    state: string;
    pincode: string;
    address: string;
    name: string;
    phone: string;
  };
  destination: {
    city: string;
    state: string;
    pincode: string;
    address: string;
    name: string;
    phone: string;
  };
  package: {
    weight: number;
    description: string;
    pieces: number;
    isCod: boolean;
    codAmount: number;
  };
  dates: {
    booked: string;
    expectedDelivery: string | null;
    actualDelivery: string | null;
  };
  sla: {
    status: "on_track" | "at_risk" | "delayed" | "delivered";
    daysRemaining: number | null;
    expectedDate: string | null;
  };
  currentLocation: string;
  timeline: Array<{
    type: string;
    time: string;
    location: string;
    remarks: string | null;
  }>;
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const awbParam = searchParams.get("awb");

  const [awb, setAwb] = useState(awbParam || "");
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const fetchTracking = async (awbNumber: string) => {
    if (!awbNumber) return;

    setLoading(true);
    setError("");
    setSearched(true);

    const token = localStorage.getItem("customer_token");

    try {
      const res = await fetch(`/api/customer/shipments/${awbNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setTracking(data.data);
      } else {
        setError(data.error || "Shipment not found");
        setTracking(null);
      }
    } catch {
      setError("Failed to fetch tracking data");
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (awbParam) {
      setAwb(awbParam);
      fetchTracking(awbParam);
    }
  }, [awbParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(awb);
  };

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    BOOKED: { icon: Package, color: "text-gray-600 bg-gray-100", label: "Booked" },
    PICKED_UP: { icon: Package, color: "text-blue-600 bg-blue-100", label: "Picked Up" },
    IN_HUB: { icon: MapPin, color: "text-blue-600 bg-blue-100", label: "At Hub" },
    IN_TRANSIT: { icon: Truck, color: "text-amber-600 bg-amber-100", label: "In Transit" },
    OUT_FOR_DELIVERY: { icon: Truck, color: "text-purple-600 bg-purple-100", label: "Out for Delivery" },
    DELIVERED: { icon: CheckCircle, color: "text-green-600 bg-green-100", label: "Delivered" },
    WITH_PARTNER: { icon: Truck, color: "text-cyan-600 bg-cyan-100", label: "With Partner" },
    FAILED: { icon: XCircle, color: "text-red-600 bg-red-100", label: "Delivery Failed" },
  };

  const slaConfig = {
    on_track: { color: "text-green-600 bg-green-50 border-green-200", label: "On Track" },
    at_risk: { color: "text-amber-600 bg-amber-50 border-amber-200", label: "At Risk" },
    delayed: { color: "text-red-600 bg-red-50 border-red-200", label: "Delayed" },
    delivered: { color: "text-green-600 bg-green-50 border-green-200", label: "Delivered" },
  };

  const scanTypeLabels: Record<string, string> = {
    BOOKED: "Shipment Booked",
    PICKUP_SCHEDULED: "Pickup Scheduled",
    PICKED_UP: "Picked Up",
    INSCAN: "Received at Hub",
    OUTSCAN: "Dispatched from Hub",
    IN_TRANSIT: "In Transit",
    LOAD: "Loaded on Vehicle",
    UNLOAD: "Unloaded at Hub",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    POD_CAPTURED: "Proof of Delivery Captured",
    FAILED: "Delivery Attempt Failed",
    RETURNED: "Returned to Origin",
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Track Shipment</h1>
        <p className="text-gray-500 mt-1">
          Enter your AWB number to track your shipment
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={awb}
              onChange={(e) => setAwb(e.target.value.toUpperCase())}
              placeholder="Enter AWB Number (e.g., CJD12345ABC)"
              className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !awb}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            Track
          </button>
        </div>
      </form>

      {/* Error State */}
      {error && searched && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800">{error}</h3>
          <p className="text-red-600 mt-2">
            Please check the AWB number and try again
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <RefreshCw className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Fetching tracking information...</p>
        </div>
      )}

      {/* Tracking Result */}
      {tracking && !loading && (
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">AWB Number</p>
                <p className="text-2xl font-bold text-gray-900">{tracking.awbNumber}</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  statusConfig[tracking.status]?.color || "bg-gray-100 text-gray-600"
                }`}>
                  {statusConfig[tracking.status]?.icon && (
                    <statusConfig[tracking.status].icon className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {statusConfig[tracking.status]?.label || tracking.status}
                  </span>
                </div>

                {/* SLA Badge */}
                <div className={`px-4 py-2 rounded-full border ${
                  slaConfig[tracking.sla.status]?.color
                }`}>
                  <span className="font-medium">
                    {slaConfig[tracking.sla.status]?.label}
                    {tracking.sla.daysRemaining !== null && tracking.sla.status !== "delivered" && (
                      <span className="ml-1">
                        ({tracking.sla.daysRemaining > 0
                          ? `${tracking.sla.daysRemaining}d left`
                          : `${Math.abs(tracking.sla.daysRemaining)}d late`})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Location */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
              <MapPin className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Current Location</p>
                <p className="font-semibold text-blue-900">{tracking.currentLocation}</p>
              </div>
            </div>
          </div>

          {/* Route & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Route */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Route</h3>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Origin
                  </div>
                  <p className="font-semibold mt-1">{tracking.origin.city}</p>
                  <p className="text-sm text-gray-500">{tracking.origin.pincode}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 mt-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    Destination
                  </div>
                  <p className="font-semibold mt-1">{tracking.destination.city}</p>
                  <p className="text-sm text-gray-500">{tracking.destination.pincode}</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Important Dates</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Booked
                  </span>
                  <span className="font-medium">
                    {new Date(tracking.dates.booked).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Expected Delivery
                  </span>
                  <span className={`font-medium ${
                    tracking.sla.status === "delayed" ? "text-red-600" : "text-gray-900"
                  }`}>
                    {tracking.dates.expectedDelivery
                      ? new Date(tracking.dates.expectedDelivery).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </div>
                {tracking.dates.actualDelivery && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Delivered On
                    </span>
                    <span className="font-medium text-green-600">
                      {new Date(tracking.dates.actualDelivery).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Package & Consignee Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Package */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Weight className="h-4 w-4" /> Weight
                  </span>
                  <span className="font-medium">{tracking.package.weight} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Pieces
                  </span>
                  <span className="font-medium">{tracking.package.pieces}</span>
                </div>
                {tracking.package.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Contents</span>
                    <span className="font-medium">{tracking.package.description}</span>
                  </div>
                )}
                {tracking.package.isCod && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-amber-600 flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" /> COD Amount
                    </span>
                    <span className="font-semibold text-amber-600">
                      ₹{tracking.package.codAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Consignee */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Consignee</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{tracking.destination.name}</p>
                    <p className="text-gray-500">{tracking.destination.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{tracking.destination.phone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Shipment Timeline</h3>

            <div className="relative">
              {tracking.timeline.map((event, index) => {
                const isLatest = index === 0;
                const config = statusConfig[event.type] || {
                  icon: MapPin,
                  color: "text-gray-600 bg-gray-100",
                };
                const Icon = config.icon;

                return (
                  <div key={index} className="flex gap-4 pb-6 last:pb-0">
                    {/* Timeline line */}
                    <div className="relative flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isLatest ? config.color : "bg-gray-100 text-gray-500"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {index < tracking.timeline.length - 1 && (
                        <div className="flex-1 w-0.5 bg-gray-200 mt-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`font-medium ${isLatest ? "text-gray-900" : "text-gray-600"}`}>
                            {scanTypeLabels[event.type] || event.type}
                          </p>
                          <p className="text-sm text-gray-500">{event.location}</p>
                          {event.remarks && (
                            <p className="text-sm text-gray-400 mt-1">{event.remarks}</p>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(event.time).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {", "}
                          {new Date(event.time).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {tracking.timeline.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No tracking updates yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!tracking && !loading && !error && !searched && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Track Your Shipment</h3>
          <p className="text-gray-500 mt-2">
            Enter your AWB number above to see real-time tracking updates
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    }>
      <TrackingContent />
    </Suspense>
  );
}
