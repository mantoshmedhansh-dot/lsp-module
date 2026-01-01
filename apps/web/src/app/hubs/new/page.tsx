"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  ChevronLeft,
  Save,
  MapPin,
  Clock,
  Package,
  User,
} from "lucide-react";
import { Card, Button, Input } from "@cjdquick/ui";

interface HubFormData {
  code: string;
  name: string;
  type: "GATEWAY" | "TRANSSHIPMENT" | "SPOKE";
  address: string;
  pincode: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  totalBays: number;
  loadingBays: number;
  unloadingBays: number;
  sortingCapacity: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
];

export default function NewHubPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<HubFormData>({
    code: "",
    name: "",
    type: "TRANSSHIPMENT",
    address: "",
    pincode: "",
    city: "",
    state: "",
    totalBays: 10,
    loadingBays: 5,
    unloadingBays: 5,
    sortingCapacity: 1000,
    operatingHoursStart: "06:00",
    operatingHoursEnd: "22:00",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createHubMutation = useMutation({
    mutationFn: async (data: HubFormData) => {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create hub");
      }
      return result;
    },
    onSuccess: (data) => {
      router.push(`/hubs/${data.data.id}`);
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
      [name]:
        type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!formData.code) newErrors.code = "Hub code is required";
    if (!formData.name) newErrors.name = "Hub name is required";
    if (!formData.address) newErrors.address = "Address is required";
    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = "Valid 6-digit pincode is required";
    }
    if (!formData.city) newErrors.city = "City is required";
    if (!formData.state) newErrors.state = "State is required";
    if (!formData.contactName) newErrors.contactName = "Contact name is required";
    if (!formData.contactPhone || !/^[6-9]\d{9}$/.test(formData.contactPhone)) {
      newErrors.contactPhone = "Valid 10-digit phone number is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createHubMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hubs">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Hub</h1>
          <p className="text-gray-500">
            Create a new hub in your PTL network
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hub Code *
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="e.g., MUM-HUB-01"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase ${
                    errors.code ? "border-red-500" : ""
                  }`}
                />
                {errors.code && (
                  <p className="text-red-500 text-sm mt-1">{errors.code}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hub Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Mumbai Central Hub"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.name ? "border-red-500" : ""
                  }`}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hub Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="GATEWAY">
                    Gateway (Major hub connecting regions)
                  </option>
                  <option value="TRANSSHIPMENT">
                    Transshipment (Cross-docking hub)
                  </option>
                  <option value="SPOKE">Spoke (Local delivery hub)</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Full street address"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.address ? "border-red-500" : ""
                  }`}
                />
                {errors.address && (
                  <p className="text-red-500 text-sm mt-1">{errors.address}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="400001"
                  maxLength={6}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.pincode ? "border-red-500" : ""
                  }`}
                />
                {errors.pincode && (
                  <p className="text-red-500 text-sm mt-1">{errors.pincode}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Mumbai"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.city ? "border-red-500" : ""
                  }`}
                />
                {errors.city && (
                  <p className="text-red-500 text-sm mt-1">{errors.city}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.state ? "border-red-500" : ""
                  }`}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="text-red-500 text-sm mt-1">{errors.state}</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Capacity */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Capacity & Operations
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Bays
                </label>
                <input
                  type="number"
                  name="totalBays"
                  value={formData.totalBays}
                  onChange={handleChange}
                  min={1}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loading Bays
                </label>
                <input
                  type="number"
                  name="loadingBays"
                  value={formData.loadingBays}
                  onChange={handleChange}
                  min={1}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unloading Bays
                </label>
                <input
                  type="number"
                  name="unloadingBays"
                  value={formData.unloadingBays}
                  onChange={handleChange}
                  min={1}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorting (pkg/hr)
                </label>
                <input
                  type="number"
                  name="sortingCapacity"
                  value={formData.sortingCapacity}
                  onChange={handleChange}
                  min={100}
                  step={100}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Operating Hours Start
                </label>
                <input
                  type="time"
                  name="operatingHoursStart"
                  value={formData.operatingHoursStart}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operating Hours End
                </label>
                <input
                  type="time"
                  name="operatingHoursEnd"
                  value={formData.operatingHoursEnd}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Hub Manager Name"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.contactName ? "border-red-500" : ""
                  }`}
                />
                {errors.contactName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.contactName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.contactPhone ? "border-red-500" : ""
                  }`}
                />
                {errors.contactPhone && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.contactPhone}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="hub.manager@company.com"
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
          <Link href="/hubs">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            type="submit"
            disabled={createHubMutation.isPending}
          >
            {createHubMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">...</span>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Hub
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
