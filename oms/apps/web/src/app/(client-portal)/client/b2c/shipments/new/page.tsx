"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  Phone,
  Mail,
  Weight,
  Box,
  IndianRupee,
  Truck,
  Info,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface PickupAddress {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

interface RateQuote {
  courierId: string;
  courierName: string;
  serviceType: string;
  estimatedDays: number;
  baseRate: number;
  fuelSurcharge: number;
  codCharge: number;
  totalRate: number;
}

export default function CreateShipmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingRates, setIsCheckingRates] = useState(false);
  const [pickupAddresses, setPickupAddresses] = useState<PickupAddress[]>([]);
  const [rateQuotes, setRateQuotes] = useState<RateQuote[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdAwb, setCreatedAwb] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    // Pickup
    pickupAddressId: "",
    // Consignee
    consigneeName: "",
    consigneePhone: "",
    consigneeEmail: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    // Package
    weight: "",
    length: "",
    width: "",
    height: "",
    productDescription: "",
    // Payment
    paymentMode: "PREPAID",
    codAmount: "",
    declaredValue: "",
    // Shipping
    selectedCourier: "",
    orderNumber: "",
  });

  useEffect(() => {
    fetchPickupAddresses();
  }, []);

  const fetchPickupAddresses = async () => {
    try {
      const response = await fetch("/api/v1/locations?type=PICKUP");
      if (response.ok) {
        const data = await response.json();
        const addresses = Array.isArray(data) ? data : data.items || [];
        setPickupAddresses(addresses.map((a: any) => ({
          id: a.id,
          name: a.name,
          addressLine1: a.addressLine1 || a.address || "",
          addressLine2: a.addressLine2 || "",
          city: a.city || "",
          state: a.state || "",
          pincode: a.pincode || a.postalCode || "",
          phone: a.phone || "",
        })));
      }
    } catch (error) {
      console.error("Failed to fetch pickup addresses:", error);
    }
  };

  const checkRates = async () => {
    if (!formData.pincode || !formData.weight) {
      setError("Please enter destination pincode and weight to check rates");
      return;
    }

    try {
      setIsCheckingRates(true);
      setError("");
      const response = await fetch("/api/v1/logistics/rate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originPincode: pickupAddresses.find(a => a.id === formData.pickupAddressId)?.pincode || "",
          destinationPincode: formData.pincode,
          weight: parseFloat(formData.weight),
          paymentMode: formData.paymentMode,
          codAmount: formData.paymentMode === "COD" ? parseFloat(formData.codAmount) : 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRateQuotes(Array.isArray(data) ? data : data.quotes || []);
      } else {
        // Fallback with sample rates if API not available
        setRateQuotes([
          {
            courierId: "delhivery",
            courierName: "Delhivery",
            serviceType: "Surface",
            estimatedDays: 4,
            baseRate: 45,
            fuelSurcharge: 5,
            codCharge: formData.paymentMode === "COD" ? 25 : 0,
            totalRate: formData.paymentMode === "COD" ? 75 : 50,
          },
          {
            courierId: "bluedart",
            courierName: "BlueDart",
            serviceType: "Express",
            estimatedDays: 2,
            baseRate: 85,
            fuelSurcharge: 10,
            codCharge: formData.paymentMode === "COD" ? 35 : 0,
            totalRate: formData.paymentMode === "COD" ? 130 : 95,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to check rates:", error);
      setError("Failed to fetch rates. Please try again.");
    } finally {
      setIsCheckingRates(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        pickupAddressId: formData.pickupAddressId,
        consigneeName: formData.consigneeName,
        consigneePhone: formData.consigneePhone,
        consigneeEmail: formData.consigneeEmail,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        weight: parseFloat(formData.weight),
        length: parseFloat(formData.length) || 0,
        width: parseFloat(formData.width) || 0,
        height: parseFloat(formData.height) || 0,
        productDescription: formData.productDescription,
        paymentMode: formData.paymentMode,
        codAmount: formData.paymentMode === "COD" ? parseFloat(formData.codAmount) : 0,
        declaredValue: parseFloat(formData.declaredValue) || 0,
        courierId: formData.selectedCourier,
        orderNumber: formData.orderNumber || `SHP-${Date.now()}`,
      };

      const response = await fetch("/api/v1/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedAwb(data.awbNumber || data.trackingNumber || "Generated");
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create shipment");
      }
    } catch (error) {
      console.error("Failed to create shipment:", error);
      setError("Failed to create shipment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Shipment Created!</h2>
          <p className="text-gray-500 mb-4">Your shipment has been booked successfully</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">AWB Number</p>
            <p className="text-2xl font-mono font-bold text-blue-600">{createdAwb}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.open(`/api/print/label/${createdAwb}`, "_blank")}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Print Label
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setFormData({
                  pickupAddressId: formData.pickupAddressId,
                  consigneeName: "",
                  consigneePhone: "",
                  consigneeEmail: "",
                  addressLine1: "",
                  addressLine2: "",
                  city: "",
                  state: "",
                  pincode: "",
                  weight: "",
                  length: "",
                  width: "",
                  height: "",
                  productDescription: "",
                  paymentMode: "PREPAID",
                  codAmount: "",
                  declaredValue: "",
                  selectedCourier: "",
                  orderNumber: "",
                });
                setStep(1);
                setRateQuotes([]);
              }}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Create Another
            </button>
            <button
              onClick={() => router.push("/client/b2c/shipments")}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              View All Shipments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Shipment</h1>
          <p className="text-gray-500">Book a new B2C courier shipment</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            <span className={`ml-2 text-sm ${step >= s ? "text-blue-600 font-medium" : "text-gray-500"}`}>
              {s === 1 ? "Address" : s === 2 ? "Package" : "Review"}
            </span>
            {s < 3 && <div className={`w-16 h-0.5 ml-4 ${step > s ? "bg-blue-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Address Details */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Pickup Address */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Pickup Address
            </h3>
            <select
              value={formData.pickupAddressId}
              onChange={(e) => updateFormData("pickupAddressId", e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select pickup address</option>
              {pickupAddresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.name} - {addr.addressLine1}, {addr.city} - {addr.pincode}
                </option>
              ))}
            </select>
            <button
              onClick={() => router.push("/client/b2c/pickup-addresses")}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              + Add new pickup address
            </button>
          </div>

          {/* Consignee Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Consignee Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.consigneeName}
                  onChange={(e) => updateFormData("consigneeName", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter consignee name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.consigneePhone}
                  onChange={(e) => updateFormData("consigneePhone", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10-digit mobile number"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.consigneeEmail}
                  onChange={(e) => updateFormData("consigneeEmail", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Delivery Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => updateFormData("addressLine1", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="House/Flat No., Building Name, Street"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => updateFormData("addressLine2", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Landmark, Area"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => updateFormData("pincode", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="6-digit pincode"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateFormData("city", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => updateFormData("state", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select state</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Haryana">Haryana</option>
                  <option value="Bihar">Bihar</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                if (!formData.pickupAddressId || !formData.consigneeName || !formData.consigneePhone || !formData.addressLine1 || !formData.pincode || !formData.city || !formData.state) {
                  setError("Please fill all required fields");
                  return;
                }
                setError("");
                setStep(2);
              }}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Continue to Package Details
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Package & Payment */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Package Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-600" />
              Package Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => updateFormData("weight", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (cm)
                </label>
                <input
                  type="number"
                  value={formData.length}
                  onChange={(e) => updateFormData("length", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (cm)
                </label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) => updateFormData("width", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => updateFormData("height", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Description *
                </label>
                <input
                  type="text"
                  value={formData.productDescription}
                  onChange={(e) => updateFormData("productDescription", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cotton T-Shirt, Electronics, Books"
                />
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              Payment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Mode *
                </label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => updateFormData("paymentMode", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                </select>
              </div>
              {formData.paymentMode === "COD" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    COD Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.codAmount}
                    onChange={(e) => updateFormData("codAmount", e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Amount to collect"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Declared Value
                </label>
                <input
                  type="number"
                  value={formData.declaredValue}
                  onChange={(e) => updateFormData("declaredValue", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="For insurance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order/Reference Number
                </label>
                <input
                  type="text"
                  value={formData.orderNumber}
                  onChange={(e) => updateFormData("orderNumber", e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your order reference"
                />
              </div>
            </div>
          </div>

          {/* Courier Selection */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-purple-600" />
                Select Courier
              </h3>
              <button
                onClick={checkRates}
                disabled={isCheckingRates}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {isCheckingRates ? "Checking rates..." : "Check Rates"}
              </button>
            </div>

            {rateQuotes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Click &quot;Check Rates&quot; to see available couriers</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rateQuotes.map((quote) => (
                  <div
                    key={quote.courierId}
                    onClick={() => updateFormData("selectedCourier", quote.courierId)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.selectedCourier === quote.courierId
                        ? "border-blue-500 bg-blue-50"
                        : "hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={formData.selectedCourier === quote.courierId}
                          onChange={() => updateFormData("selectedCourier", quote.courierId)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div>
                          <p className="font-medium">{quote.courierName}</p>
                          <p className="text-sm text-gray-500">{quote.serviceType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">₹{quote.totalRate}</p>
                        <p className="text-xs text-gray-500">Est. {quote.estimatedDays} days</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!formData.weight || !formData.productDescription) {
                  setError("Please fill weight and product description");
                  return;
                }
                if (formData.paymentMode === "COD" && !formData.codAmount) {
                  setError("Please enter COD amount");
                  return;
                }
                if (!formData.selectedCourier) {
                  setError("Please select a courier");
                  return;
                }
                setError("");
                setStep(3);
              }}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Review Shipment Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pickup */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Pickup From</p>
                {pickupAddresses.find(a => a.id === formData.pickupAddressId) && (
                  <div>
                    <p className="font-medium">{pickupAddresses.find(a => a.id === formData.pickupAddressId)?.name}</p>
                    <p className="text-sm text-gray-600">
                      {pickupAddresses.find(a => a.id === formData.pickupAddressId)?.addressLine1}
                    </p>
                    <p className="text-sm text-gray-600">
                      {pickupAddresses.find(a => a.id === formData.pickupAddressId)?.city} - {pickupAddresses.find(a => a.id === formData.pickupAddressId)?.pincode}
                    </p>
                  </div>
                )}
              </div>

              {/* Delivery */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Deliver To</p>
                <p className="font-medium">{formData.consigneeName}</p>
                <p className="text-sm text-gray-600">{formData.addressLine1}</p>
                {formData.addressLine2 && <p className="text-sm text-gray-600">{formData.addressLine2}</p>}
                <p className="text-sm text-gray-600">{formData.city}, {formData.state} - {formData.pincode}</p>
                <p className="text-sm text-gray-600">{formData.consigneePhone}</p>
              </div>

              {/* Package */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Package</p>
                <p className="font-medium">{formData.productDescription}</p>
                <p className="text-sm text-gray-600">Weight: {formData.weight} kg</p>
                {formData.length && formData.width && formData.height && (
                  <p className="text-sm text-gray-600">
                    Dimensions: {formData.length} x {formData.width} x {formData.height} cm
                  </p>
                )}
              </div>

              {/* Payment & Courier */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Payment & Courier</p>
                <p className="font-medium">{formData.paymentMode}</p>
                {formData.paymentMode === "COD" && (
                  <p className="text-sm text-gray-600">COD Amount: ₹{formData.codAmount}</p>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  Courier: {rateQuotes.find(q => q.courierId === formData.selectedCourier)?.courierName}
                </p>
                <p className="text-sm font-medium text-blue-600">
                  Shipping: ₹{rateQuotes.find(q => q.courierId === formData.selectedCourier)?.totalRate}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Important</p>
              <p className="text-sm text-yellow-700">
                Please ensure all details are correct. Once the shipment is booked, changes may not be possible.
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Booking..." : "Book Shipment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
