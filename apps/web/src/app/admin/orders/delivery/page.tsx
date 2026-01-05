"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  RefreshCw,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, Button, StatusBadge, Badge } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryCity: string;
  deliveryPincode: string;
  awbNumber: string;
  status: string;
  expectedDeliveryDate: string | null;
  partner?: {
    code: string;
    displayName: string;
  };
}

async function fetchDeliveryOrders() {
  const res = await fetch("/api/orders?stage=delivery");
  return res.json();
}

export default function AdminDeliveryPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", "delivery"],
    queryFn: fetchDeliveryOrders,
  });

  const orders = data?.data?.items || [];
  const inTransit = orders.filter((o: Order) => o.status === "IN_TRANSIT");
  const outForDelivery = orders.filter(
    (o: Order) => o.status === "OUT_FOR_DELIVERY"
  );

  const isDelayed = (order: Order) => {
    if (!order.expectedDeliveryDate) return false;
    return new Date(order.expectedDeliveryDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
          <p className="text-gray-600">Monitor orders in transit and out for delivery</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">In Transit</p>
            <p className="text-2xl font-bold">{inTransit.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-teal-100 rounded-lg">
            <MapPin className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Out for Delivery</p>
            <p className="text-2xl font-bold">{outForDelivery.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Delayed</p>
            <p className="text-2xl font-bold">
              {orders.filter((o: Order) => isDelayed(o)).length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">On Track</p>
            <p className="text-2xl font-bold">
              {orders.filter((o: Order) => !isDelayed(o)).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Out for Delivery - Priority */}
      <Card>
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <MapPin className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-semibold">Out for Delivery</h2>
          <Badge variant="info" size="sm">
            {outForDelivery.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : outForDelivery.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders out for delivery
          </div>
        ) : (
          <div className="divide-y">
            {outForDelivery.map((order: Order) => (
              <div
                key={order.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      isDelayed(order) ? "bg-amber-100" : "bg-teal-100"
                    }`}
                  >
                    {isDelayed(order) ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <MapPin className="h-5 w-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      {order.customerName} | {order.customerPhone}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.deliveryCity} - {order.deliveryPincode}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {order.partner?.displayName}
                    </div>
                    <div className="text-xs text-gray-500">{order.awbNumber}</div>
                  </div>
                  {isDelayed(order) && (
                    <Badge variant="warning" size="sm">
                      Delayed
                    </Badge>
                  )}
                  <Link href={`/admin/orders/${order.id}`}>
                    <Button variant="outline" size="sm">
                      Track
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* In Transit */}
      <Card>
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">In Transit</h2>
          <Badge variant="primary" size="sm">
            {inTransit.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : inTransit.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No orders in transit
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Destination
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expected
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
                {inTransit.map((order: Order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {order.awbNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{order.deliveryCity}</div>
                      <div className="text-sm text-gray-500">
                        {order.deliveryPincode}
                      </div>
                    </td>
                    <td className="px-6 py-4">{order.partner?.displayName}</td>
                    <td className="px-6 py-4">
                      {order.expectedDeliveryDate ? (
                        <div
                          className={
                            isDelayed(order) ? "text-amber-600" : "text-gray-900"
                          }
                        >
                          {new Date(
                            order.expectedDeliveryDate
                          ).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          Track
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
