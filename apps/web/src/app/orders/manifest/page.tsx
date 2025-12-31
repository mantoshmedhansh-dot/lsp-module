"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  RefreshCw,
  FileText,
  Truck,
  CheckCircle,
} from "lucide-react";
import { Card, Button, StatusBadge, Badge } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryCity: string;
  deliveryPincode: string;
  originPincode: string;
  status: string;
  paymentMode: string;
  codAmount: number;
  weightKg: number;
  awbNumber: string | null;
  createdAt: string;
  partner?: {
    code: string;
    displayName: string;
  };
}

async function fetchPendingManifest() {
  const res = await fetch("/api/orders?stage=manifestation");
  return res.json();
}

export default function ManifestPage() {
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders", "manifestation"],
    queryFn: fetchPendingManifest,
  });

  const manifestMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/manifest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const orders = data?.data?.items || [];
  const pendingOrders = orders.filter((o: Order) => o.status === "CREATED");
  const manifestedOrders = orders.filter((o: Order) => o.status !== "CREATED");

  const handleManifestAll = async () => {
    for (const orderId of selectedOrders) {
      await manifestMutation.mutateAsync(orderId);
    }
    setSelectedOrders([]);
  };

  const toggleSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const selectAll = () => {
    if (selectedOrders.length === pendingOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(pendingOrders.map((o: Order) => o.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manifestation</h1>
          <p className="text-gray-600">
            Assign partners and generate AWB for pending orders
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/orders/manifest/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-lg">
            <Package className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Manifest</p>
            <p className="text-2xl font-bold">{pendingOrders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">AWB Generated</p>
            <p className="text-2xl font-bold">{manifestedOrders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Truck className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ready for Pickup</p>
            <p className="text-2xl font-bold">{manifestedOrders.length}</p>
          </div>
        </Card>
      </div>

      {/* Pending Orders Section */}
      <Card>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pending Manifestation</h2>
          {selectedOrders.length > 0 && (
            <Button
              onClick={handleManifestAll}
              isLoading={manifestMutation.isPending}
            >
              <Truck className="h-4 w-4 mr-2" />
              Manifest Selected ({selectedOrders.length})
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading orders...</p>
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-400" />
            <p className="mt-2 text-gray-500">All orders have been manifested!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === pendingOrders.length}
                      onChange={selectAll}
                      className="h-4 w-4 rounded text-primary-600"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingOrders.map((order: Order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleSelection(order.id)}
                        className="h-4 w-4 rounded text-primary-600"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {order.customerName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {order.originPincode} → {order.deliveryPincode}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.deliveryCity}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span>{order.weightKg} kg</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={order.paymentMode === "COD" ? "warning" : "info"}
                        size="sm"
                      >
                        {order.paymentMode}
                      </Badge>
                      {order.paymentMode === "COD" && (
                        <div className="text-sm text-gray-500">
                          ₹{order.codAmount}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        onClick={() => manifestMutation.mutate(order.id)}
                        isLoading={manifestMutation.isPending}
                      >
                        Manifest
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Manifested Orders */}
      {manifestedOrders.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Recently Manifested</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    AWB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {manifestedOrders.map((order: Order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {order.customerName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {order.awbNumber}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      {order.partner?.displayName || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
