"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle,
  Package,
  ScanLine,
} from "lucide-react";
import { Card, Button, StatusBadge, Badge } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryCity: string;
  awbNumber: string;
  status: string;
  warehouse?: {
    name: string;
    code: string;
  };
}

async function fetchPickOrders() {
  const res = await fetch("/api/orders?stage=pick");
  return res.json();
}

export default function AdminPickPage() {
  const queryClient = useQueryClient();
  const [scanInput, setScanInput] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", "pick"],
    queryFn: fetchPickOrders,
  });

  const pickMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickedById: "demo-staff-id",
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setScanInput("");
    },
  });

  const orders = data?.data?.items || [];
  const pendingPick = orders.filter(
    (o: Order) => o.status === "AWB_GENERATED" || o.status === "PICKUP_SCHEDULED"
  );
  const pickedOrders = orders.filter((o: Order) => o.status === "PICKED");

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const order = orders.find(
      (o: Order) => o.awbNumber === scanInput || o.orderNumber === scanInput
    );
    if (order) {
      pickMutation.mutate(order.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pick</h1>
          <p className="text-gray-600">
            Scan and pick orders from warehouse inventory
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Scan Input */}
      <Card>
        <form onSubmit={handleScan} className="flex items-center gap-4">
          <ScanLine className="h-6 w-6 text-gray-400" />
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Scan AWB or Order Number..."
            className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none"
            autoFocus
          />
          <Button type="submit" disabled={!scanInput}>
            Mark Picked
          </Button>
        </form>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <ClipboardCheck className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Pick</p>
            <p className="text-2xl font-bold">{pendingPick.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Picked Today</p>
            <p className="text-2xl font-bold">{pickedOrders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ready for Pack</p>
            <p className="text-2xl font-bold">{pickedOrders.length}</p>
          </div>
        </Card>
      </div>

      {/* Pending Pick */}
      <Card>
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Orders to Pick</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : pendingPick.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-400" />
            <p className="mt-2 text-gray-500">All orders have been picked!</p>
          </div>
        ) : (
          <div className="divide-y">
            {pendingPick.map((order: Order) => (
              <div
                key={order.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded">
                    <Package className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      AWB: {order.awbNumber} | {order.customerName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {order.warehouse && (
                    <Badge variant="default" size="sm">
                      {order.warehouse.code}
                    </Badge>
                  )}
                  <StatusBadge status={order.status} size="sm" />
                  <Button
                    size="sm"
                    onClick={() => pickMutation.mutate(order.id)}
                    isLoading={pickMutation.isPending}
                  >
                    Pick
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recently Picked */}
      {pickedOrders.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Recently Picked</h2>
          </div>
          <div className="divide-y">
            {pickedOrders.slice(0, 5).map((order: Order) => (
              <div
                key={order.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">{order.awbNumber}</div>
                  </div>
                </div>
                <Link href={`/admin/orders/${order.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
