"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Truck,
  ChevronLeft,
  Save,
  FileText,
  Settings,
  User,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";
import { VEHICLE_TYPES } from "@/lib/validations";

interface VehicleFormData {
  registrationNo: string;
  type: string;
  capacityTonnage: number;
  capacityVolumeCBM: number;
  lengthFt?: number;
  widthFt?: number;
  heightFt?: number;
  make?: string;
  model?: string;
  year?: number;
  fuelType: string;
  rcExpiryDate?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  permitExpiry?: string;
  pollutionExpiry?: string;
  ownershipType: string;
  ownerName?: string;
  ownerPhone?: string;
  gpsDeviceId?: string;
}

const VEHICLE_PRESETS: Record<string, { tonnage: number; cbm: number; length: number; width: number; height: number }> = {
  TATA_ACE: { tonnage: 0.75, cbm: 4, length: 7, width: 4.5, height: 4.5 },
  EICHER_14FT: { tonnage: 4, cbm: 20, length: 14, width: 6, height: 6 },
  TATA_407: { tonnage: 2.5, cbm: 12, length: 10, width: 5.5, height: 5.5 },
  TATA_709: { tonnage: 5, cbm: 25, length: 14, width: 6, height: 6.5 },
  TATA_1109: { tonnage: 9, cbm: 40, length: 17, width: 7, height: 7 },
  CONTAINER_20FT: { tonnage: 18, cbm: 33, length: 20, width: 8, height: 8 },
  CONTAINER_32FT: { tonnage: 25, cbm: 60, length: 32, width: 8, height: 8 },
};

export default function NewVehiclePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<VehicleFormData>({
    registrationNo: "",
    type: "TATA_407",
    capacityTonnage: 2.5,
    capacityVolumeCBM: 12,
    lengthFt: 10,
    widthFt: 5.5,
    heightFt: 5.5,
    fuelType: "DIESEL",
    ownershipType: "OWNED",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to register vehicle");
      }
      return result;
    },
    onSuccess: (data) => {
      router.push(`/fleet/vehicles`);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? undefined : Number(value)) : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleTypeChange = (type: string) => {
    const preset = VEHICLE_PRESETS[type];
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        type,
        capacityTonnage: preset.tonnage,
        capacityVolumeCBM: preset.cbm,
        lengthFt: preset.length,
        widthFt: preset.width,
        heightFt: preset.height,
      }));
    } else {
      setFormData((prev) => ({ ...prev, type }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.registrationNo) {
      newErrors.registrationNo = "Registration number is required";
    }
    if (!formData.capacityTonnage || formData.capacityTonnage <= 0) {
      newErrors.capacityTonnage = "Valid capacity is required";
    }
    if (!formData.capacityVolumeCBM || formData.capacityVolumeCBM <= 0) {
      newErrors.capacityVolumeCBM = "Valid volume is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createVehicleMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/fleet/vehicles">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Register Vehicle</h1>
          <p className="text-gray-500">Add a new vehicle to your fleet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehicle Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  name="registrationNo"
                  value={formData.registrationNo}
                  onChange={handleChange}
                  placeholder="MH12AB1234"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase ${
                    errors.registrationNo ? "border-red-500" : ""
                  }`}
                />
                {errors.registrationNo && (
                  <p className="text-red-500 text-sm mt-1">{errors.registrationNo}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  name="make"
                  value={formData.make || ""}
                  onChange={handleChange}
                  placeholder="Tata, Eicher, Ashok Leyland"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model || ""}
                  onChange={handleChange}
                  placeholder="Model name"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  name="year"
                  value={formData.year || ""}
                  onChange={handleChange}
                  min={2000}
                  max={new Date().getFullYear() + 1}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuel Type
                </label>
                <select
                  name="fuelType"
                  value={formData.fuelType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="DIESEL">Diesel</option>
                  <option value="PETROL">Petrol</option>
                  <option value="CNG">CNG</option>
                  <option value="EV">Electric</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Capacity */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Capacity & Dimensions
            </h2>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity (Tons) *
                </label>
                <input
                  type="number"
                  name="capacityTonnage"
                  value={formData.capacityTonnage}
                  onChange={handleChange}
                  step={0.1}
                  min={0.1}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.capacityTonnage ? "border-red-500" : ""
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volume (CBM) *
                </label>
                <input
                  type="number"
                  name="capacityVolumeCBM"
                  value={formData.capacityVolumeCBM}
                  onChange={handleChange}
                  step={1}
                  min={1}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.capacityVolumeCBM ? "border-red-500" : ""
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (ft)
                </label>
                <input
                  type="number"
                  name="lengthFt"
                  value={formData.lengthFt || ""}
                  onChange={handleChange}
                  step={0.5}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (ft)
                </label>
                <input
                  type="number"
                  name="widthFt"
                  value={formData.widthFt || ""}
                  onChange={handleChange}
                  step={0.5}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (ft)
                </label>
                <input
                  type="number"
                  name="heightFt"
                  value={formData.heightFt || ""}
                  onChange={handleChange}
                  step={0.5}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Expiry Dates
            </h2>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RC Expiry
                </label>
                <input
                  type="date"
                  name="rcExpiryDate"
                  value={formData.rcExpiryDate || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance
                </label>
                <input
                  type="date"
                  name="insuranceExpiry"
                  value={formData.insuranceExpiry || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fitness
                </label>
                <input
                  type="date"
                  name="fitnessExpiry"
                  value={formData.fitnessExpiry || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permit
                </label>
                <input
                  type="date"
                  name="permitExpiry"
                  value={formData.permitExpiry || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pollution
                </label>
                <input
                  type="date"
                  name="pollutionExpiry"
                  value={formData.pollutionExpiry || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Ownership */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Ownership Details
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ownership Type
                </label>
                <select
                  name="ownershipType"
                  value={formData.ownershipType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="OWNED">Owned</option>
                  <option value="LEASED">Leased</option>
                  <option value="ATTACHED">Attached</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName || ""}
                  onChange={handleChange}
                  placeholder="Vehicle owner name"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Phone
                </label>
                <input
                  type="tel"
                  name="ownerPhone"
                  value={formData.ownerPhone || ""}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Submit */}
        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {errors.submit}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/fleet/vehicles">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createVehicleMutation.isPending}>
            {createVehicleMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Register Vehicle
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
