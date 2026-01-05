"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  CreditCard,
  Save,
  Calculator,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
} from "@cjdquick/ui";

interface OrderFormData {
  // Customer Details
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  // Delivery Address
  deliveryAddress: string;
  deliveryPincode: string;
  deliveryCity: string;
  deliveryState: string;
  // Package Details
  itemDescription: string;
  itemValue: string;
  itemQuantity: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  // Payment
  paymentMode: "PREPAID" | "COD";
  codAmount: string;
  // Origin
  warehouseId: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    deliveryPincode: "",
    deliveryCity: "",
    deliveryState: "",
    itemDescription: "",
    itemValue: "",
    itemQuantity: "1",
    weightKg: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    paymentMode: "PREPAID",
    codAmount: "",
    warehouseId: "",
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const res = await fetch("/api/client/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          itemValue: parseFloat(data.itemValue),
          itemQuantity: parseInt(data.itemQuantity),
          weightKg: parseFloat(data.weightKg),
          lengthCm: data.lengthCm ? parseFloat(data.lengthCm) : undefined,
          widthCm: data.widthCm ? parseFloat(data.widthCm) : undefined,
          heightCm: data.heightCm ? parseFloat(data.heightCm) : undefined,
          codAmount: data.paymentMode === "COD" ? parseFloat(data.codAmount) : 0,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        router.push(`/client/orders/${data.data.id}`);
      }
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate(formData);
  };

  // Calculate volumetric weight
  const volumetricWeight =
    formData.lengthCm && formData.widthCm && formData.heightCm
      ? (parseFloat(formData.lengthCm) *
          parseFloat(formData.widthCm) *
          parseFloat(formData.heightCm)) /
        5000
      : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/client/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
          <p className="text-gray-600">Fill in the shipment details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Customer Name *"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              required
            />
            <Input
              label="Phone Number *"
              name="customerPhone"
              type="tel"
              value={formData.customerPhone}
              onChange={handleChange}
              required
            />
            <Input
              label="Email"
              name="customerEmail"
              type="email"
              value={formData.customerEmail}
              onChange={handleChange}
              className="md:col-span-2"
            />
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary-600" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <textarea
                name="deliveryAddress"
                value={formData.deliveryAddress}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <Input
              label="Pincode *"
              name="deliveryPincode"
              value={formData.deliveryPincode}
              onChange={handleChange}
              maxLength={6}
              required
            />
            <Input
              label="City *"
              name="deliveryCity"
              value={formData.deliveryCity}
              onChange={handleChange}
              required
            />
            <Input
              label="State *"
              name="deliveryState"
              value={formData.deliveryState}
              onChange={handleChange}
              required
            />
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              Package Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Item Description *"
                  name="itemDescription"
                  value={formData.itemDescription}
                  onChange={handleChange}
                  required
                />
              </div>
              <Input
                label="Quantity *"
                name="itemQuantity"
                type="number"
                min="1"
                value={formData.itemQuantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Declared Value (₹) *"
                name="itemValue"
                type="number"
                step="0.01"
                value={formData.itemValue}
                onChange={handleChange}
                required
              />
              <Input
                label="Weight (kg) *"
                name="weightKg"
                type="number"
                step="0.01"
                value={formData.weightKg}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Length (cm)"
                name="lengthCm"
                type="number"
                step="0.1"
                value={formData.lengthCm}
                onChange={handleChange}
              />
              <Input
                label="Width (cm)"
                name="widthCm"
                type="number"
                step="0.1"
                value={formData.widthCm}
                onChange={handleChange}
              />
              <Input
                label="Height (cm)"
                name="heightCm"
                type="number"
                step="0.1"
                value={formData.heightCm}
                onChange={handleChange}
              />
            </div>

            {volumetricWeight > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">
                  Volumetric Weight: {volumetricWeight.toFixed(2)} kg | Chargeable
                  Weight:{" "}
                  {Math.max(
                    parseFloat(formData.weightKg) || 0,
                    volumetricWeight
                  ).toFixed(2)}{" "}
                  kg
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-600" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMode"
                  value="PREPAID"
                  checked={formData.paymentMode === "PREPAID"}
                  onChange={handleChange}
                  className="text-primary-600"
                />
                <span>Prepaid</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMode"
                  value="COD"
                  checked={formData.paymentMode === "COD"}
                  onChange={handleChange}
                  className="text-primary-600"
                />
                <span>Cash on Delivery (COD)</span>
              </label>
            </div>

            {formData.paymentMode === "COD" && (
              <Input
                label="COD Amount (₹) *"
                name="codAmount"
                type="number"
                step="0.01"
                value={formData.codAmount}
                onChange={handleChange}
                required={formData.paymentMode === "COD"}
              />
            )}
          </CardContent>
        </Card>

        {/* Origin Warehouse */}
        <Card>
          <CardHeader>
            <CardTitle>Pickup Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Warehouse *
              </label>
              <select
                name="warehouseId"
                value={formData.warehouseId}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select a warehouse</option>
                {/* Will be populated from API */}
              </select>
              <p className="mt-2 text-sm text-gray-500">
                <Link
                  href="/client/facilities/new"
                  className="text-primary-600 hover:underline"
                >
                  + Add new pickup location
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/client/orders">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            type="submit"
            isLoading={createOrderMutation.isPending}
            disabled={createOrderMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </div>
      </form>
    </div>
  );
}
