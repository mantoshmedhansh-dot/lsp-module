"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  RefreshCw,
  CheckCircle,
  Scale,
  Ruler,
  ScanLine,
} from "lucide-react";
import { Card, Button, StatusBadge, Input } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  awbNumber: string;
  status: string;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

interface PackFormData {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
}

async function fetchPackOrders() {
  const res = await fetch("/api/orders?stage=pack");
  return res.json();
}

export default function PackPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<PackFormData>({
    weightKg: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders", "pack"],
    queryFn: fetchPackOrders,
  });

  const packMutation = useMutation({
    mutationFn: async ({
      orderId,
      data,
    }: {
      orderId: string;
      data: PackFormData;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packedById: "demo-staff-id", // TODO: Get from session
          weightKg: parseFloat(data.weightKg),
          lengthCm: data.lengthCm ? parseFloat(data.lengthCm) : undefined,
          widthCm: data.widthCm ? parseFloat(data.widthCm) : undefined,
          heightCm: data.heightCm ? parseFloat(data.heightCm) : undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedOrder(null);
      setFormData({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "" });
    },
  });

  const orders = data?.data?.items || [];
  const pendingPack = orders.filter((o: Order) => o.status === "PICKED");
  const packedOrders = orders.filter((o: Order) => o.status === "PACKED");

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setFormData({
      weightKg: order.weightKg?.toString() || "",
      lengthCm: order.lengthCm?.toString() || "",
      widthCm: order.widthCm?.toString() || "",
      heightCm: order.heightCm?.toString() || "",
    });
  };

  const handlePack = () => {
    if (selectedOrder) {
      packMutation.mutate({ orderId: selectedOrder.id, data: formData });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pack</h1>
          <p className="text-gray-600">
            Verify weight, dimensions and pack orders for dispatch
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <Package className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Pack</p>
            <p className="text-2xl font-bold">{pendingPack.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Packed Today</p>
            <p className="text-2xl font-bold">{packedOrders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Scale className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg Weight</p>
            <p className="text-2xl font-bold">
              {packedOrders.length > 0
                ? (
                    packedOrders.reduce(
                      (sum: number, o: Order) => sum + (o.weightKg || 0),
                      0
                    ) / packedOrders.length
                  ).toFixed(2)
                : "0"}{" "}
              kg
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <Card>
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Orders to Pack</h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : pendingPack.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-400" />
              <p className="mt-2 text-gray-500">All orders have been packed!</p>
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {pendingPack.map((order: Order) => (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 ${
                    selectedOrder?.id === order.id ? "bg-primary-50" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      {order.awbNumber} | {order.customerName}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {order.weightKg} kg
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Pack Form */}
        <Card>
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Pack Details</h2>
          </div>

          {selectedOrder ? (
            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium">{selectedOrder.orderNumber}</div>
                <div className="text-sm text-gray-500">
                  AWB: {selectedOrder.awbNumber}
                </div>
                <div className="text-sm text-gray-500">
                  {selectedOrder.customerName}
                </div>
              </div>

              {/* Weight & Dimensions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Scale className="h-5 w-5" />
                  <span className="font-medium">Weight</span>
                </div>
                <Input
                  label="Actual Weight (kg)"
                  type="number"
                  step="0.01"
                  value={formData.weightKg}
                  onChange={(e) =>
                    setFormData({ ...formData, weightKg: e.target.value })
                  }
                />

                <div className="flex items-center gap-2 text-gray-700 mt-6">
                  <Ruler className="h-5 w-5" />
                  <span className="font-medium">Dimensions (optional)</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Length (cm)"
                    type="number"
                    step="0.1"
                    value={formData.lengthCm}
                    onChange={(e) =>
                      setFormData({ ...formData, lengthCm: e.target.value })
                    }
                  />
                  <Input
                    label="Width (cm)"
                    type="number"
                    step="0.1"
                    value={formData.widthCm}
                    onChange={(e) =>
                      setFormData({ ...formData, widthCm: e.target.value })
                    }
                  />
                  <Input
                    label="Height (cm)"
                    type="number"
                    step="0.1"
                    value={formData.heightCm}
                    onChange={(e) =>
                      setFormData({ ...formData, heightCm: e.target.value })
                    }
                  />
                </div>

                {formData.lengthCm &&
                  formData.widthCm &&
                  formData.heightCm && (
                    <div className="text-sm text-gray-500">
                      Volumetric Weight:{" "}
                      {(
                        (parseFloat(formData.lengthCm) *
                          parseFloat(formData.widthCm) *
                          parseFloat(formData.heightCm)) /
                        5000
                      ).toFixed(2)}{" "}
                      kg
                    </div>
                  )}
              </div>

              <Button
                className="w-full"
                onClick={handlePack}
                isLoading={packMutation.isPending}
                disabled={!formData.weightKg}
              >
                <Package className="h-4 w-4 mr-2" />
                Mark as Packed
              </Button>
            </div>
          ) : (
            <div className="p-12 text-center">
              <ScanLine className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-2 text-gray-500">
                Select an order from the list to pack
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
