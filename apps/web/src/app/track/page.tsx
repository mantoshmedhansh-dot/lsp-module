"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Search,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  AlertTriangle,
  Calendar,
  MessageCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Navigation,
  Timer,
  Star,
  Share2,
  Box,
  Building2,
  Home,
  CircleDot,
  ArrowRight,
} from "lucide-react";
import { Button } from "@cjdquick/ui";

// Fetch tracking info
async function fetchTracking(awb: string) {
  const res = await fetch(`/api/public/track?awb=${awb}`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to fetch tracking");
  }
  return res.json();
}

// Fetch complaint types
async function fetchComplaintTypes() {
  const res = await fetch("/api/public/complaint");
  if (!res.ok) throw new Error("Failed to fetch complaint types");
  return res.json();
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

// Calculate time remaining
function getTimeRemaining(targetDate: string) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} left`;
  }
  return `${hours}h ${minutes}m left`;
}

// Journey milestones
const JOURNEY_MILESTONES = [
  { key: "booked", label: "Order Placed", icon: Box },
  { key: "picked", label: "Picked Up", icon: Package },
  { key: "transit", label: "In Transit", icon: Truck },
  { key: "hub", label: "At Hub", icon: Building2 },
  { key: "ofd", label: "Out for Delivery", icon: Navigation },
  { key: "delivered", label: "Delivered", icon: Home },
];

function getMilestoneProgress(status: string): number {
  const statusMap: Record<string, number> = {
    BOOKED: 0,
    PICKUP_SCHEDULED: 0,
    PICKED_UP: 1,
    RECEIVED_AT_ORIGIN_HUB: 2,
    IN_TRANSIT: 2,
    ARRIVED_AT_HUB: 3,
    IN_HUB: 3,
    OUT_FOR_DELIVERY: 4,
    DELIVERED: 5,
    DELIVERY_FAILED: 4,
    NDR: 4,
    RTO_INITIATED: 3,
    RTO_IN_TRANSIT: 3,
  };
  return statusMap[status] ?? 2;
}

function getStatusInfo(status: string) {
  const info: Record<string, { color: string; bg: string; message: string }> = {
    DELIVERED: {
      color: "text-green-600",
      bg: "bg-green-100",
      message: "Your package has been delivered!",
    },
    OUT_FOR_DELIVERY: {
      color: "text-blue-600",
      bg: "bg-blue-100",
      message: "Your package is out for delivery today!",
    },
    IN_TRANSIT: {
      color: "text-indigo-600",
      bg: "bg-indigo-100",
      message: "Your package is on its way",
    },
    NDR: {
      color: "text-orange-600",
      bg: "bg-orange-100",
      message: "Delivery attempted - Action required",
    },
    DELIVERY_FAILED: {
      color: "text-orange-600",
      bg: "bg-orange-100",
      message: "Delivery was attempted but unsuccessful",
    },
    RTO_INITIATED: {
      color: "text-red-600",
      bg: "bg-red-100",
      message: "Package is being returned to sender",
    },
  };
  return (
    info[status] || {
      color: "text-gray-600",
      bg: "bg-gray-100",
      message: "Tracking your package...",
    }
  );
}

function getEventIcon(eventType: string) {
  const icons: Record<string, any> = {
    "Picked up from sender": Package,
    "Received at facility": Building2,
    "Dispatched from facility": Truck,
    "Out for delivery": Navigation,
    "Delivered": CheckCircle,
    "Delivery attempted": AlertTriangle,
  };
  return icons[eventType] || CircleDot;
}

export default function TrackingPage() {
  const [awb, setAwb] = useState("");
  const [searchAwb, setSearchAwb] = useState("");
  const [showTimeline, setShowTimeline] = useState(true);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [complaintData, setComplaintData] = useState({
    complaintType: "",
    description: "",
    phone: "",
    email: "",
  });
  const [rescheduleData, setRescheduleData] = useState({
    preferredDate: "",
    preferredTimeSlot: "",
    phone: "",
    instructions: "",
  });
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const {
    data: trackingData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["tracking", searchAwb],
    queryFn: () => fetchTracking(searchAwb),
    enabled: !!searchAwb,
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const { data: complaintTypesData } = useQuery({
    queryKey: ["complaint-types"],
    queryFn: fetchComplaintTypes,
  });

  const tracking = trackingData?.data;
  const complaintTypes = complaintTypesData?.data?.complaintTypes || [];

  // Update time remaining
  useEffect(() => {
    if (tracking?.expectedDelivery && !tracking?.isDelivered) {
      const updateTime = () => {
        setTimeRemaining(getTimeRemaining(tracking.expectedDelivery));
      };
      updateTime();
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }
  }, [tracking?.expectedDelivery, tracking?.isDelivered]);

  const handleSearch = () => {
    if (awb.trim()) {
      setSearchAwb(awb.trim().toUpperCase());
      setSubmitStatus(null);
    }
  };

  const handleComplaintSubmit = async () => {
    try {
      const res = await fetch("/api/public/complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awbNumber: searchAwb, ...complaintData }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus({
          type: "success",
          message: `Complaint #${data.data.complaintNumber} registered. ${data.data.message}`,
        });
        setShowComplaintForm(false);
        setComplaintData({ complaintType: "", description: "", phone: "", email: "" });
      } else {
        setSubmitStatus({ type: "error", message: data.error });
      }
    } catch (e) {
      setSubmitStatus({ type: "error", message: "Failed to submit complaint" });
    }
  };

  const handleRescheduleSubmit = async () => {
    try {
      const res = await fetch("/api/public/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awbNumber: searchAwb, ...rescheduleData }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus({
          type: "success",
          message: `Delivery rescheduled for ${data.data.scheduledDate}. ${data.data.message}`,
        });
        setShowRescheduleForm(false);
        setRescheduleData({ preferredDate: "", preferredTimeSlot: "", phone: "", instructions: "" });
        refetch();
      } else {
        setSubmitStatus({ type: "error", message: data.error });
      }
    } catch (e) {
      setSubmitStatus({ type: "error", message: "Failed to reschedule" });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/track?awb=${searchAwb}`;
    if (navigator.share) {
      await navigator.share({
        title: `Track Shipment ${searchAwb}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      setSubmitStatus({ type: "success", message: "Tracking link copied to clipboard!" });
    }
  };

  const statusInfo = tracking ? getStatusInfo(tracking.status) : null;
  const milestoneProgress = tracking ? getMilestoneProgress(tracking.status) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-10 pb-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold">Track Your Shipment</h1>
          <p className="mt-2 text-indigo-200">
            Real-time tracking with live updates
          </p>
        </div>
      </div>

      {/* Search Box */}
      <div className="max-w-4xl mx-auto px-4 -mt-10">
        <div className="bg-white rounded-2xl shadow-xl p-6 border">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Enter AWB Number (e.g., CJD2024...)"
                value={awb}
                onChange={(e) => setAwb(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-12 pr-4 py-4 border-2 rounded-xl text-lg focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="px-8 py-4 rounded-xl text-lg"
              disabled={!awb.trim()}
            >
              Track
            </Button>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {submitStatus && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div
            className={`p-4 rounded-xl ${
              submitStatus.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {submitStatus.message}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="max-w-4xl mx-auto px-4 mt-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
          <p className="text-gray-500">Fetching tracking details...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-red-600 font-medium text-lg">
              {(error as Error).message || "Shipment not found"}
            </p>
            <p className="text-gray-500 mt-2">
              Please check the AWB number and try again
            </p>
          </div>
        </div>
      )}

      {/* Tracking Results */}
      {tracking && (
        <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6 pb-12">
          {/* Status Banner */}
          <div className={`rounded-2xl p-6 ${statusInfo?.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-white/50 flex items-center justify-center`}>
                  {tracking.isDelivered ? (
                    <CheckCircle className={`h-6 w-6 ${statusInfo?.color}`} />
                  ) : (
                    <Truck className={`h-6 w-6 ${statusInfo?.color}`} />
                  )}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${statusInfo?.color}`}>
                    {tracking.statusLabel}
                  </h2>
                  <p className="text-gray-600 text-sm">{statusInfo?.message}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>

          {/* ETA Card */}
          {!tracking.isDelivered && tracking.expectedDelivery && (
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <Timer className="h-7 w-7 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expected Delivery</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDateShort(tracking.expectedDelivery)}
                    </p>
                    <p className="text-sm text-gray-500">
                      By {formatTime(tracking.expectedDelivery)}
                    </p>
                  </div>
                </div>
                {timeRemaining && (
                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      <span className="font-semibold text-indigo-600">{timeRemaining}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Journey Progress */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Shipment Journey</h3>

            {/* Progress Bar */}
            <div className="relative mb-8">
              <div className="flex items-center justify-between relative">
                {JOURNEY_MILESTONES.map((milestone, index) => {
                  const Icon = milestone.icon;
                  const isCompleted = index <= milestoneProgress;
                  const isCurrent = index === milestoneProgress;

                  return (
                    <div key={milestone.key} className="flex flex-col items-center z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isCompleted
                            ? isCurrent
                              ? "bg-indigo-600 ring-4 ring-indigo-100"
                              : "bg-green-500"
                            : "bg-gray-200"
                        }`}
                      >
                        {isCompleted && !isCurrent ? (
                          <CheckCircle className="h-5 w-5 text-white" />
                        ) : (
                          <Icon className={`h-5 w-5 ${isCompleted ? "text-white" : "text-gray-400"}`} />
                        )}
                      </div>
                      <p
                        className={`text-xs mt-2 text-center max-w-[70px] ${
                          isCompleted ? "text-gray-900 font-medium" : "text-gray-400"
                        }`}
                      >
                        {milestone.label}
                      </p>
                    </div>
                  );
                })}

                {/* Progress Line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 -z-0">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${(milestoneProgress / (JOURNEY_MILESTONES.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Route Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <p className="text-xs text-gray-400 uppercase">Origin</p>
                <p className="font-semibold text-gray-900">{tracking.origin}</p>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-8 h-0.5 bg-gray-300" />
                <ArrowRight className="h-5 w-5" />
                <div className="w-8 h-0.5 bg-gray-300" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-gray-400 uppercase">Destination</p>
                <p className="font-semibold text-gray-900">{tracking.destination}</p>
                <p className="text-sm text-gray-500">{tracking.consigneeName}</p>
              </div>
            </div>

            {/* Current Location */}
            {tracking.currentLocation && !tracking.isDelivered && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Current Location</p>
                  <p className="font-semibold text-blue-800">{tracking.currentLocation}</p>
                </div>
              </div>
            )}

            {/* Delivered Info */}
            {tracking.isDelivered && (
              <div className="mt-4 p-4 bg-green-50 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Delivered Successfully</p>
                  <p className="font-semibold text-green-800">
                    Received by: {tracking.receivedBy}
                  </p>
                  {tracking.deliveredOn && (
                    <p className="text-sm text-green-600">{formatDate(tracking.deliveredOn)}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Shipment Details */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Shipment Details</h3>
              <span className="font-mono text-sm bg-gray-100 px-3 py-1 rounded-full">
                {tracking.awbNumber}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400">Pieces</p>
                <p className="font-bold text-lg text-gray-900">{tracking.pieces || 1}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400">Weight</p>
                <p className="font-bold text-lg text-gray-900">{tracking.weight || "-"} kg</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400">Payment</p>
                <p className="font-bold text-lg text-gray-900">{tracking.paymentMode}</p>
              </div>
              {tracking.codAmount ? (
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-600">COD Amount</p>
                  <p className="font-bold text-lg text-green-600">₹{tracking.codAmount}</p>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400">Booked On</p>
                  <p className="font-bold text-gray-900">{tracking.bookedOn ? formatDateShort(tracking.bookedOn) : "-"}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {!tracking.isDelivered && (
            <div className="flex gap-3">
              {tracking.canReschedule && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 py-3 rounded-xl"
                  onClick={() => {
                    setShowRescheduleForm(!showRescheduleForm);
                    setShowComplaintForm(false);
                  }}
                >
                  <Calendar className="h-4 w-4" />
                  Reschedule Delivery
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-2 py-3 rounded-xl"
                onClick={() => {
                  setShowComplaintForm(!showComplaintForm);
                  setShowRescheduleForm(false);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Need Help?
              </Button>
            </div>
          )}

          {/* Feedback for Delivered */}
          {tracking.isDelivered && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">How was your delivery?</h3>
                  <p className="text-sm text-gray-500">Your feedback helps us improve</p>
                </div>
                <Button className="gap-2">
                  Rate Now
                </Button>
              </div>
            </div>
          )}

          {/* Reschedule Form */}
          {showRescheduleForm && (
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Schedule Redelivery
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Phone (for verification)
                  </label>
                  <input
                    type="tel"
                    placeholder="Your registered phone number"
                    value={rescheduleData.phone}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      value={rescheduleData.preferredDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setRescheduleData({ ...rescheduleData, preferredDate: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Time Slot</label>
                    <select
                      value={rescheduleData.preferredTimeSlot}
                      onChange={(e) =>
                        setRescheduleData({ ...rescheduleData, preferredTimeSlot: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select slot</option>
                      <option value="MORNING">Morning (9-12)</option>
                      <option value="AFTERNOON">Afternoon (12-4)</option>
                      <option value="EVENING">Evening (4-8)</option>
                      <option value="ANY">Anytime</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Special Instructions (optional)
                  </label>
                  <textarea
                    placeholder="Any specific instructions..."
                    value={rescheduleData.instructions}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, instructions: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    rows={2}
                  />
                </div>
                <Button
                  onClick={handleRescheduleSubmit}
                  disabled={!rescheduleData.phone || !rescheduleData.preferredDate}
                  className="w-full py-3 rounded-xl"
                >
                  Confirm Reschedule
                </Button>
              </div>
            </div>
          )}

          {/* Complaint Form */}
          {showComplaintForm && (
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-indigo-600" />
                How can we help?
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Issue Type</label>
                  <select
                    value={complaintData.complaintType}
                    onChange={(e) =>
                      setComplaintData({ ...complaintData, complaintType: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select issue type</option>
                    {complaintTypes.map((type: any) => (
                      <option key={type.code} value={type.code}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Description</label>
                  <textarea
                    placeholder="Please describe your issue..."
                    value={complaintData.description}
                    onChange={(e) =>
                      setComplaintData({ ...complaintData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="For follow-up"
                      value={complaintData.phone}
                      onChange={(e) =>
                        setComplaintData({ ...complaintData, phone: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email (optional)</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={complaintData.email}
                      onChange={(e) =>
                        setComplaintData({ ...complaintData, email: e.target.value })
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleComplaintSubmit}
                  disabled={
                    !complaintData.complaintType ||
                    !complaintData.description ||
                    !complaintData.phone
                  }
                  className="w-full py-3 rounded-xl"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <button
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowTimeline(!showTimeline)}
            >
              <span className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Tracking History
              </span>
              {showTimeline ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {showTimeline && tracking.events?.length > 0 && (
              <div className="px-5 pb-5">
                <div className="space-y-0">
                  {tracking.events.map((event: any, index: number) => {
                    const EventIcon = getEventIcon(event.event);
                    const isFirst = index === 0;
                    const isLast = index === tracking.events.length - 1;

                    return (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isFirst
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            <EventIcon className="h-4 w-4" />
                          </div>
                          {!isLast && (
                            <div className="w-0.5 h-full min-h-[40px] bg-gray-200" />
                          )}
                        </div>
                        <div className={`pb-6 ${isFirst ? "" : "pt-0"}`}>
                          <p className={`font-medium ${isFirst ? "text-gray-900" : "text-gray-600"}`}>
                            {event.event}
                          </p>
                          <p className="text-sm text-gray-500">{event.location}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(event.timestamp)}
                          </p>
                          {event.remarks && (
                            <p className="text-xs text-gray-500 mt-1 italic">{event.remarks}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showTimeline && (!tracking.events || tracking.events.length === 0) && (
              <div className="p-6 text-center text-gray-500">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                No tracking events available yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-gray-400">
          Powered by CJDarcl Quick Logistics
        </p>
      </div>
    </div>
  );
}
