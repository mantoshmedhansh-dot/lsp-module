"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  User,
  MapPin,
  Truck,
  Package,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";

interface Consignee {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

interface CargoItem {
  description: string;
  packages: number;
  weight: number;
  rate: number;
}

export default function CreateLRPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdLR, setCreatedLR] = useState("");

  const [formData, setFormData] = useState({
    consigneeId: "",
    origin: "",
    originAddress: "",
    vehicleNumber: "",
    vehicleType: "TRUCK",
    driverName: "",
    driverPhone: "",
    paymentMode: "TO_PAY",
    remarks: "",
  });

  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { description: "", packages: 1, weight: 0, rate: 0 },
  ]);

  useEffect(() => {
    fetchConsignees();
  }, []);

  const fetchConsignees = async () => {
    try {
      const response = await fetch("/api/v1/b2b-logistics/consignees");
      if (response.ok) {
        const data = await response.json();
        setConsignees(Array.isArray(data) ? data : data.items || []);
      } else {
        // Demo data
        setConsignees([
          { id: "1", name: "ABC Distributors Pvt Ltd", address: "Plot 45, MIDC", city: "Mumbai", state: "Maharashtra", pincode: "400001", phone: "9876543210" },
          { id: "2", name: "XYZ Retailers", address: "Shop 12, Market Yard", city: "Pune", state: "Maharashtra", pincode: "411001", phone: "9876543211" },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch consignees:", error);
    }
  };

  const addCargoItem = () => {
    setCargoItems([...cargoItems, { description: "", packages: 1, weight: 0, rate: 0 }]);
  };

  const removeCargoItem = (index: number) => {
    if (cargoItems.length > 1) {
      setCargoItems(cargoItems.filter((_, i) => i !== index));
    }
  };

  const updateCargoItem = (index: number, field: keyof CargoItem, value: string | number) => {
    const updated = [...cargoItems];
    updated[index] = { ...updated[index], [field]: value };
    setCargoItems(updated);
  };

  const calculateTotals = () => {
    return cargoItems.reduce(
      (acc, item) => ({
        packages: acc.packages + (item.packages || 0),
        weight: acc.weight + (item.weight || 0),
        amount: acc.amount + (item.weight || 0) * (item.rate || 0),
      }),
      { packages: 0, weight: 0, amount: 0 }
    );
  };

  const handleSubmit = async () => {
    if (!formData.consigneeId || !formData.origin || cargoItems.some(c => !c.description)) {
      setError("Please fill all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const totals = calculateTotals();
      const consignee = consignees.find(c => c.id === formData.consigneeId);

      const payload = {
        consigneeId: formData.consigneeId,
        consigneeName: consignee?.name,
        consigneeAddress: consignee?.address,
        destination: consignee?.city,
        origin: formData.origin,
        originAddress: formData.originAddress,
        vehicleNumber: formData.vehicleNumber,
        vehicleType: formData.vehicleType,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        paymentMode: formData.paymentMode,
        remarks: formData.remarks,
        cargoItems,
        totalPackages: totals.packages,
        totalWeight: totals.weight,
        freightAmount: totals.amount,
      };

      const response = await fetch("/api/v1/b2b-logistics/lr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedLR(data.lrNumber || `LR-${Date.now()}`);
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create LR");
      }
    } catch (error) {
      console.error("Failed to create LR:", error);
      setError("Failed to create LR. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">LR Created!</h2>
          <p className="text-gray-500 mb-4">Your Lorry Receipt has been generated</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">LR Number</p>
            <p className="text-2xl font-mono font-bold text-blue-600">{createdLR}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.open(`/api/print/lr/${createdLR}`, "_blank")}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Print LR
            </button>
            <button
              onClick={() => router.push("/client/b2b-logistics/lr")}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              View All LRs
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
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Lorry Receipt</h1>
          <p className="text-gray-500">Generate a new LR for your freight shipment</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Consignee Selection */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          Consignee Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Consignee *</label>
            <select
              value={formData.consigneeId}
              onChange={(e) => setFormData({ ...formData, consigneeId: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select consignee</option>
              {consignees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.city}
                </option>
              ))}
            </select>
          </div>
          {formData.consigneeId && consignees.find(c => c.id === formData.consigneeId) && (
            <div className="md:col-span-2 bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium">{consignees.find(c => c.id === formData.consigneeId)?.name}</p>
              <p className="text-sm text-gray-600">{consignees.find(c => c.id === formData.consigneeId)?.address}</p>
              <p className="text-sm text-gray-600">
                {consignees.find(c => c.id === formData.consigneeId)?.city}, {consignees.find(c => c.id === formData.consigneeId)?.state} - {consignees.find(c => c.id === formData.consigneeId)?.pincode}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => router.push("/client/b2b-logistics/consignees")}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          + Add new consignee
        </button>
      </div>

      {/* Origin Details */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-green-600" />
          Origin Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City *</label>
            <input
              type="text"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Delhi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
            <input
              type="text"
              value={formData.originAddress}
              onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Warehouse address"
            />
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-purple-600" />
          Vehicle & Driver Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
            <input
              type="text"
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="MH-12-AB-1234"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <select
              value={formData.vehicleType}
              onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TRUCK">Truck</option>
              <option value="CONTAINER">Container</option>
              <option value="TRAILER">Trailer</option>
              <option value="TEMPO">Tempo</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
            <input
              type="text"
              value={formData.driverName}
              onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Driver name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label>
            <input
              type="tel"
              value={formData.driverPhone}
              onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10-digit mobile"
            />
          </div>
        </div>
      </div>

      {/* Cargo Details */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-600" />
            Cargo Details
          </h3>
          <button
            onClick={addCargoItem}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        </div>
        <div className="space-y-4">
          {cargoItems.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-4">
                <label className="block text-xs text-gray-500 mb-1">Description *</label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateCargoItem(index, "description", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Item description"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Packages</label>
                <input
                  type="number"
                  value={item.packages}
                  onChange={(e) => updateCargoItem(index, "packages", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={item.weight}
                  onChange={(e) => updateCargoItem(index, "weight", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Rate/kg (₹)</label>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateCargoItem(index, "rate", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-sm font-medium">₹{((item.weight || 0) * (item.rate || 0)).toLocaleString()}</span>
                {cargoItems.length > 1 && (
                  <button
                    onClick={() => removeCargoItem(index)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Total Packages</p>
              <p className="text-xl font-bold">{totals.packages}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Weight</p>
              <p className="text-xl font-bold">{totals.weight} kg</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Freight Amount</p>
              <p className="text-xl font-bold text-green-600">₹{totals.amount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Remarks */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-green-600" />
          Payment & Remarks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select
              value={formData.paymentMode}
              onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TO_PAY">To Pay</option>
              <option value="PAID">Paid</option>
              <option value="TO_BE_BILLED">To Be Billed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any special instructions"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create LR"}
        </button>
      </div>
    </div>
  );
}
