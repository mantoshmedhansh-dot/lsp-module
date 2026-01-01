"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  MapPin,
  Truck,
  Clock,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Shield,
  Loader2,
} from "lucide-react";

interface TatResult {
  origin: {
    pincode: string;
    city: string;
    state: string;
    zone: string;
    tier: number;
  };
  destination: {
    pincode: string;
    city: string;
    state: string;
    zone: string;
    tier: number;
  };
  routeType: string;
  serviceType: string;
  tat: {
    days: number;
    minDays: number;
    maxDays: number;
    expectedDeliveryDate: string;
    slaPercentage: number;
  };
  pricing: {
    ratePerKg: number;
    chargeableWeight: number;
    estimatedCost: number;
    minChargeableKg: number;
  };
  isServiceable: boolean;
}

interface ConsignmentDetails {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  packageDescription: string;
  weightKg: number;
  declaredValue: number;
  isCod: boolean;
  codAmount: number;
}

export default function BookConsignmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [originPincode, setOriginPincode] = useState("");
  const [destinationPincode, setDestinationPincode] = useState("");
  const [weightKg, setWeightKg] = useState(10);
  const [serviceType, setServiceType] = useState("");
  const [tatOptions, setTatOptions] = useState<TatResult[]>([]);
  const [selectedOption, setSelectedOption] = useState<TatResult | null>(null);
  const [loadingTat, setLoadingTat] = useState(false);
  const [tatError, setTatError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [details, setDetails] = useState<ConsignmentDetails>({
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
    packageDescription: "",
    weightKg: 10,
    declaredValue: 0,
    isCod: false,
    codAmount: 0,
  });

  const checkTat = async () => {
    if (!originPincode || !destinationPincode || originPincode.length !== 6 || destinationPincode.length !== 6) {
      setTatError("Please enter valid 6-digit pincodes");
      return;
    }

    setLoadingTat(true);
    setTatError("");

    try {
      const res = await fetch(
        `/api/customer/tat?origin=${originPincode}&destination=${destinationPincode}&weight=${weightKg}`
      );
      const data = await res.json();

      if (data.success && data.data.length > 0) {
        setTatOptions(data.data);
        setSelectedOption(null);
        setServiceType("");
      } else {
        setTatError("Route not serviceable or no options available");
        setTatOptions([]);
      }
    } catch {
      setTatError("Failed to fetch TAT. Please try again.");
      setTatOptions([]);
    } finally {
      setLoadingTat(false);
    }
  };

  const selectService = (option: TatResult) => {
    setSelectedOption(option);
    setServiceType(option.serviceType);
  };

  const handleSubmit = async () => {
    if (!selectedOption) return;

    setSubmitting(true);
    const token = localStorage.getItem("customer_token");

    try {
      const res = await fetch("/api/customer/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          originPincode,
          destinationPincode,
          serviceType: selectedOption.serviceType,
          weightKg: details.weightKg,
          ...details,
          expectedDeliveryDate: selectedOption.tat.expectedDeliveryDate,
          estimatedCost: selectedOption.pricing.estimatedCost,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/customer/tracking?awb=${data.data.awbNumber}`);
      } else {
        alert(data.error || "Failed to book consignment");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const routeTypeLabels: Record<string, { label: string; color: string }> = {
    LOCAL: { label: "Local (Same State)", color: "text-green-600 bg-green-50" },
    ZONAL: { label: "Zonal (Same Zone)", color: "text-blue-600 bg-blue-50" },
    NATIONAL: { label: "National (Cross Zone)", color: "text-purple-600 bg-purple-50" },
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Book Consignment</h1>
        <p className="text-gray-500 mt-1">
          Get instant TAT and pricing based on your route
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[
          { num: 1, label: "Route & Service" },
          { num: 2, label: "Details" },
          { num: 3, label: "Confirm" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s.num
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step > s.num ? <CheckCircle className="h-5 w-5" /> : s.num}
            </div>
            <span
              className={`text-sm ${
                step >= s.num ? "text-gray-900 font-medium" : "text-gray-500"
              }`}
            >
              {s.label}
            </span>
            {i < 2 && (
              <ArrowRight className="h-4 w-4 text-gray-300 ml-2" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Route & Service Selection */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Pincode Input */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Enter Route Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origin Pincode
                </label>
                <input
                  type="text"
                  value={originPincode}
                  onChange={(e) => setOriginPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="e.g., 110001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination Pincode
                </label>
                <input
                  type="text"
                  value={destinationPincode}
                  onChange={(e) => setDestinationPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="e.g., 400001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (Kg)
                </label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={checkTat}
              disabled={loadingTat || !originPincode || !destinationPincode}
              className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingTat ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5" />
                  Check TAT & Pricing
                </>
              )}
            </button>

            {tatError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{tatError}</span>
              </div>
            )}
          </div>

          {/* Route Info */}
          {tatOptions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Route Information</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <span>{tatOptions[0].origin.city}, {tatOptions[0].origin.state}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>{tatOptions[0].destination.city}, {tatOptions[0].destination.state}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  routeTypeLabels[tatOptions[0].routeType]?.color || "bg-gray-100 text-gray-600"
                }`}>
                  {routeTypeLabels[tatOptions[0].routeType]?.label || tatOptions[0].routeType}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Origin Zone</p>
                  <p className="font-medium text-gray-900">{tatOptions[0].origin.zone}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Destination Zone</p>
                  <p className="font-medium text-gray-900">{tatOptions[0].destination.zone}</p>
                </div>
              </div>
            </div>
          )}

          {/* Service Options */}
          {tatOptions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Select Service
              </h3>

              <div className="space-y-4">
                {tatOptions.map((option) => (
                  <div
                    key={option.serviceType}
                    onClick={() => selectService(option)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedOption?.serviceType === option.serviceType
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-900 text-lg">
                            {option.serviceType}
                          </h4>
                          {option.serviceType === "EXPRESS" && (
                            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                              <Zap className="h-3 w-3" /> Fastest
                            </span>
                          )}
                          {option.serviceType === "ECONOMY" && (
                            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              <IndianRupee className="h-3 w-3" /> Best Value
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">TAT</p>
                            <p className="font-semibold text-gray-900">
                              {option.tat.days} Days
                            </p>
                            <p className="text-xs text-gray-400">
                              ({option.tat.minDays}-{option.tat.maxDays} days)
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Expected Delivery</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(option.tat.expectedDeliveryDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">SLA Commitment</p>
                            <p className="font-semibold text-green-600 flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {option.tat.slaPercentage}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Rate</p>
                            <p className="font-semibold text-gray-900">
                              ₹{option.pricing.ratePerKg}/kg
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">Estimated Cost</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ₹{option.pricing.estimatedCost.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          for {option.pricing.chargeableWeight}kg
                        </p>
                      </div>
                    </div>

                    {selectedOption?.serviceType === option.serviceType && (
                      <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-2 text-blue-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Selected</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!selectedOption}
                className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue to Details
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Consignment Details */}
      {step === 2 && selectedOption && (
        <div className="space-y-6">
          {/* Selected Service Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Selected Service</p>
              <p className="font-semibold text-blue-900">
                {selectedOption.serviceType} - {selectedOption.tat.days} Days TAT
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Estimated Cost</p>
              <p className="font-semibold text-blue-900">
                ₹{selectedOption.pricing.estimatedCost.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Change
            </button>
          </div>

          {/* Sender Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sender Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={details.senderName}
                  onChange={(e) => setDetails({ ...details, senderName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={details.senderPhone}
                  onChange={(e) => setDetails({ ...details, senderPhone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <textarea
                  value={details.senderAddress}
                  onChange={(e) => setDetails({ ...details, senderAddress: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Receiver Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Receiver Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={details.receiverName}
                  onChange={(e) => setDetails({ ...details, receiverName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={details.receiverPhone}
                  onChange={(e) => setDetails({ ...details, receiverPhone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <textarea
                  value={details.receiverAddress}
                  onChange={(e) => setDetails({ ...details, receiverAddress: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Package Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Package Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={details.packageDescription}
                  onChange={(e) => setDetails({ ...details, packageDescription: e.target.value })}
                  placeholder="e.g., Electronics, Documents, Apparels"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (Kg) *
                </label>
                <input
                  type="number"
                  value={details.weightKg}
                  onChange={(e) => setDetails({ ...details, weightKg: Math.max(1, parseInt(e.target.value) || 1) })}
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Declared Value (₹)
                </label>
                <input
                  type="number"
                  value={details.declaredValue}
                  onChange={(e) => setDetails({ ...details, declaredValue: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* COD */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={details.isCod}
                  onChange={(e) => setDetails({ ...details, isCod: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">Cash on Delivery (COD)</span>
              </label>

              {details.isCod && (
                <div className="mt-3 ml-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    COD Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={details.codAmount}
                    onChange={(e) => setDetails({ ...details, codAmount: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!details.senderName || !details.receiverName}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Review Booking
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && selectedOption && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Booking Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Route */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Route
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <p className="text-gray-500">From</p>
                      <p className="font-medium">{selectedOption.origin.city}</p>
                      <p className="text-gray-500">{originPincode}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-gray-500">To</p>
                      <p className="font-medium">{selectedOption.destination.city}</p>
                      <p className="text-gray-500">{destinationPincode}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Service
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-semibold text-gray-900">{selectedOption.serviceType}</p>
                  <p className="text-sm text-gray-500">
                    {selectedOption.tat.days} Days TAT • {selectedOption.tat.slaPercentage}% SLA
                  </p>
                  <p className="text-sm text-gray-500">
                    Expected: {new Date(selectedOption.tat.expectedDeliveryDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>

              {/* Sender */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700">Sender</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <p className="font-medium">{details.senderName}</p>
                  <p className="text-gray-500">{details.senderPhone}</p>
                  <p className="text-gray-500">{details.senderAddress}</p>
                </div>
              </div>

              {/* Receiver */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-700">Receiver</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <p className="font-medium">{details.receiverName}</p>
                  <p className="text-gray-500">{details.receiverPhone}</p>
                  <p className="text-gray-500">{details.receiverAddress}</p>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Weight</span>
                <span>{details.weightKg} kg</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Chargeable Weight (min 10kg)</span>
                <span>{selectedOption.pricing.chargeableWeight} kg</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Rate</span>
                <span>₹{selectedOption.pricing.ratePerKg}/kg</span>
              </div>
              {details.isCod && (
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">COD Amount</span>
                  <span>₹{details.codAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-lg font-semibold mt-4 pt-4 border-t border-gray-200">
                <span className="text-gray-900">Total</span>
                <span className="text-blue-600">
                  ₹{selectedOption.pricing.estimatedCost.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
