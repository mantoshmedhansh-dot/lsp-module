"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  User,
  ChevronLeft,
  Save,
  IdCard,
  MapPin,
  Phone,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
];

interface DriverFormData {
  employeeCode: string;
  name: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  licenseState?: string;
  aadharNumber?: string;
  panNumber?: string;
  joiningDate: string;
  yearsExperience?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export default function NewDriverPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<DriverFormData>({
    employeeCode: "",
    name: "",
    phone: "",
    licenseNumber: "",
    licenseType: "HMV",
    licenseExpiry: "",
    joiningDate: new Date().toISOString().split("T")[0],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create driver");
      }
      return result;
    },
    onSuccess: () => {
      router.push(`/fleet/drivers`);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.employeeCode) newErrors.employeeCode = "Employee code is required";
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = "Valid 10-digit phone number is required";
    }
    if (!formData.licenseNumber) newErrors.licenseNumber = "License number is required";
    if (!formData.licenseExpiry) newErrors.licenseExpiry = "License expiry date is required";
    if (!formData.joiningDate) newErrors.joiningDate = "Joining date is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createDriverMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/fleet/drivers">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Driver</h1>
          <p className="text-gray-500">Register a new driver to your fleet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Code *
                </label>
                <input
                  type="text"
                  name="employeeCode"
                  value={formData.employeeCode}
                  onChange={handleChange}
                  placeholder="DRV001"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.employeeCode ? "border-red-500" : ""
                  }`}
                />
                {errors.employeeCode && (
                  <p className="text-red-500 text-sm mt-1">{errors.employeeCode}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Driver full name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.name ? "border-red-500" : ""
                  }`}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.phone ? "border-red-500" : ""
                  }`}
                />
                {errors.phone && (
                  <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  name="altPhone"
                  value={formData.altPhone || ""}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleChange}
                  placeholder="driver@email.com"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Address */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address || ""}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Full address"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ""}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <select
                  name="state"
                  value={formData.state || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode || ""}
                  onChange={handleChange}
                  placeholder="400001"
                  maxLength={6}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* License & Identity */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <IdCard className="h-5 w-5" />
              License & Identity Documents
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Number *
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  placeholder="MH1234567890123"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.licenseNumber ? "border-red-500" : ""
                  }`}
                />
                {errors.licenseNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.licenseNumber}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Type *
                </label>
                <select
                  name="licenseType"
                  value={formData.licenseType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="LMV">LMV (Light Motor Vehicle)</option>
                  <option value="HMV">HMV (Heavy Motor Vehicle)</option>
                  <option value="TRANS">Transport</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Expiry *
                </label>
                <input
                  type="date"
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.licenseExpiry ? "border-red-500" : ""
                  }`}
                />
                {errors.licenseExpiry && (
                  <p className="text-red-500 text-sm mt-1">{errors.licenseExpiry}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Issuing State
                </label>
                <select
                  name="licenseState"
                  value={formData.licenseState || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aadhar Number
                </label>
                <input
                  type="text"
                  name="aadharNumber"
                  value={formData.aadharNumber || ""}
                  onChange={handleChange}
                  placeholder="123456789012"
                  maxLength={12}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PAN Number
                </label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber || ""}
                  onChange={handleChange}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Employment & Emergency */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Employment & Emergency Contact
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Joining Date *
                </label>
                <input
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.joiningDate ? "border-red-500" : ""
                  }`}
                />
                {errors.joiningDate && (
                  <p className="text-red-500 text-sm mt-1">{errors.joiningDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  name="yearsExperience"
                  value={formData.yearsExperience || ""}
                  onChange={handleChange}
                  min={0}
                  max={50}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName || ""}
                  onChange={handleChange}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone || ""}
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
          <Link href="/fleet/drivers">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createDriverMutation.isPending}>
            {createDriverMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Add Driver
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
