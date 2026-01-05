"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Package, User, MapPin, Scale, CreditCard } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@cjdquick/ui";

interface OrderFormData {
  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  deliveryPincode: string;
  deliveryCity: string;
  deliveryState: string;
  // Origin
  originPincode: string;
  // Package
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  // Item
  itemDescription: string;
  itemValue: string;
  itemQuantity: string;
  itemSku: string;
  // Payment
  paymentMode: "PREPAID" | "COD";
  codAmount: string;
  // Meta
  clientOrderId: string;
  notes: string;
}

// Pre-filled demo data for testing
const initialFormData: OrderFormData = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  deliveryAddress: "",
  deliveryPincode: "",
  deliveryCity: "",
  deliveryState: "",
  originPincode: "400093", // Default to Mumbai warehouse
  weightKg: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  itemDescription: "",
  itemValue: "",
  itemQuantity: "1",
  itemSku: "",
  paymentMode: "PREPAID",
  codAmount: "",
  clientOrderId: "",
  notes: "",
};

export default function NewOrderPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof OrderFormData, string>>>({});

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          weightKg: parseFloat(data.weightKg) || 0,
          lengthCm: data.lengthCm ? parseFloat(data.lengthCm) : undefined,
          widthCm: data.widthCm ? parseFloat(data.widthCm) : undefined,
          heightCm: data.heightCm ? parseFloat(data.heightCm) : undefined,
          itemValue: parseFloat(data.itemValue) || 0,
          itemQuantity: parseInt(data.itemQuantity) || 1,
          codAmount: data.paymentMode === "COD" ? parseFloat(data.codAmount) || 0 : 0,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create order");
      }
      return result.data;
    },
    onSuccess: (data) => {
      router.push(`/admin/orders/${data.id}`);
    },
    onError: (error: Error) => {
      setErrors({ notes: error.message });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof OrderFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
          <p className="text-gray-600">Enter shipment details to create a new order</p>
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
              error={errors.customerName}
              required
            />
            <Input
              label="Phone Number *"
              name="customerPhone"
              value={formData.customerPhone}
              onChange={handleChange}
              error={errors.customerPhone}
              placeholder="10 digit mobile number"
              required
            />
            <Input
              label="Email"
              type="email"
              name="customerEmail"
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
                Complete Address *
              </label>
              <textarea
                name="deliveryAddress"
                value={formData.deliveryAddress}
                onChange={handleChange}
                rows={3}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <Input
              label="Pincode *"
              name="deliveryPincode"
              value={formData.deliveryPincode}
              onChange={handleChange}
              error={errors.deliveryPincode}
              placeholder="6 digit pincode"
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
            <Input
              label="Origin Pincode *"
              name="originPincode"
              value={formData.originPincode}
              onChange={handleChange}
              error={errors.originPincode}
              placeholder="Pickup/warehouse pincode"
              required
            />
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary-600" />
              Package Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input
              label="Weight (kg) *"
              name="weightKg"
              type="number"
              step="0.01"
              value={formData.weightKg}
              onChange={handleChange}
              error={errors.weightKg}
              required
            />
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
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary-600" />
              Item Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Item Description *"
              name="itemDescription"
              value={formData.itemDescription}
              onChange={handleChange}
              error={errors.itemDescription}
              className="md:col-span-2"
              required
            />
            <Input
              label="Item Value (₹) *"
              name="itemValue"
              type="number"
              value={formData.itemValue}
              onChange={handleChange}
              required
            />
            <Input
              label="Quantity"
              name="itemQuantity"
              type="number"
              min="1"
              value={formData.itemQuantity}
              onChange={handleChange}
            />
            <Input
              label="SKU"
              name="itemSku"
              value={formData.itemSku}
              onChange={handleChange}
              placeholder="Optional"
            />
            <Input
              label="Client Order ID"
              name="clientOrderId"
              value={formData.clientOrderId}
              onChange={handleChange}
              placeholder="Your reference ID"
            />
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary-600" />
              Payment Mode
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
                  className="h-4 w-4 text-primary-600"
                />
                <span className="font-medium">Prepaid</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMode"
                  value="COD"
                  checked={formData.paymentMode === "COD"}
                  onChange={handleChange}
                  className="h-4 w-4 text-primary-600"
                />
                <span className="font-medium">Cash on Delivery (COD)</span>
              </label>
            </div>

            {formData.paymentMode === "COD" && (
              <Input
                label="COD Amount (₹) *"
                name="codAmount"
                type="number"
                value={formData.codAmount}
                onChange={handleChange}
                error={errors.codAmount}
                required
              />
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions / Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Any special handling instructions..."
            />
          </CardContent>
        </Card>

        {/* Error Display */}
        {errors.notes && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {errors.notes}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/admin/orders">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" isLoading={createOrderMutation.isPending}>
            Create Order
          </Button>
        </div>
      </form>
    </div>
  );
}
