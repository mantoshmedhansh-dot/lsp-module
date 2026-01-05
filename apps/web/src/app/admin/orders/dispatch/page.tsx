"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  RefreshCw,
  CheckCircle,
  Truck,
  Package,
  ScanLine,
} from "lucide-react";
import { Card, Button, StatusBadge, Badge } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  awbNumber: string;
  status: string;
  partner?: {
    code: string;
    displayName: string;
  };
}

async function fetchDispatchOrders() {
  const res = await fetch("/api/orders?stage=dispatch");
  return res.json();
}

export default function AdminDispatchPage() {
  const queryClient = useQueryClient();
  const [scanInput, setScanInput] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", "dispatch"],
    queryFn: fetchDispatchOrders,
  });

  const dispatchMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatchedById: "demo-staff-id",
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
  const pendingDispatch = orders.filter(
    (o: Order) => o.status === "PACKED" || o.status === "READY_TO_DISPATCH"
  );
  const dispatchedOrders = orders.filter(
    (o: Order) => o.status === "DISPATCHED" || o.status === "HANDED_OVER"
  );

  // Group by partner
  const ordersByPartner = pendingDispatch.reduce(
    (acc: Record<string, Order[]>, order: Order) => {
      const partnerCode = order.partner?.code || "UNASSIGNED";
      if (!acc[partnerCode]) acc[partnerCode] = [];
      acc[partnerCode].push(order);
      return acc;
    },
    {}
  );

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const order = pendingDispatch.find(
      (o: Order) => o.awbNumber === scanInput || o.orderNumber === scanInput
    );
    if (order) {
      dispatchMutation.mutate(order.id);
    }
  };

  const handleDispatchAll = async (partnerCode: string) => {
    const partnerOrders = ordersByPartner[partnerCode] || [];
    for (const order of partnerOrders) {
      await dispatchMutation.mutateAsync(order.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>
          <p className="text-gray-600">
            Handover packages to logistics partners
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
            placeholder="Scan AWB to dispatch..."
            className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none"
            autoFocus
          />
          <Button type="submit" disabled={!scanInput}>
            Dispatch
          </Button>
        </form>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Package className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Ready to Dispatch</p>
            <p className="text-2xl font-bold">{pendingDispatch.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Send className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Dispatched Today</p>
            <p className="text-2xl font-bold">{dispatchedOrders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Partners</p>
            <p className="text-2xl font-bold">
              {Object.keys(ordersByPartner).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Orders by Partner */}
      {isLoading ? (
        <Card>
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        </Card>
      ) : Object.keys(ordersByPartner).length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-400" />
            <p className="mt-2 text-gray-500">
              All orders have been dispatched!
            </p>
          </div>
        </Card>
      ) : (
        Object.entries(ordersByPartner).map(([partnerCode, partnerOrders]) => (
          <Card key={partnerCode}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold">
                  {(partnerOrders as Order[])[0]?.partner?.displayName ||
                    partnerCode}
                </h2>
                <Badge variant="info" size="sm">
                  {(partnerOrders as Order[]).length} orders
                </Badge>
              </div>
              <Button
                onClick={() => handleDispatchAll(partnerCode)}
                isLoading={dispatchMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Dispatch All
              </Button>
            </div>

            <div className="divide-y">
              {(partnerOrders as Order[]).map((order: Order) => (
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
                        AWB: {order.awbNumber}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={order.status} size="sm" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dispatchMutation.mutate(order.id)}
                      isLoading={dispatchMutation.isPending}
                    >
                      Dispatch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* Recently Dispatched */}
      {dispatchedOrders.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Recently Dispatched</h2>
          </div>
          <div className="divide-y">
            {dispatchedOrders.slice(0, 5).map((order: Order) => (
              <div
                key={order.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      {order.awbNumber} → {order.partner?.displayName}
                    </div>
                  </div>
                </div>
                <Link href={`/admin/orders/${order.id}`}>
                  <Button variant="ghost" size="sm">
                    Track
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
