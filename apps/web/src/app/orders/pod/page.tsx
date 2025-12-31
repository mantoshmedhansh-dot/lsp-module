"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  RefreshCw,
  FileCheck,
  Camera,
  PenTool,
  Key,
  Download,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  deliveryCity: string;
  awbNumber: string;
  status: string;
  deliveredAt: string | null;
  podSignature: string | null;
  podPhoto: string | null;
  podOtp: string | null;
  podReceiverName: string | null;
  partner?: {
    displayName: string;
  };
}

async function fetchDeliveredOrders() {
  const res = await fetch("/api/orders?stage=pod");
  return res.json();
}

export default function PODPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders", "pod"],
    queryFn: fetchDeliveredOrders,
  });

  const orders = data?.data?.items || [];

  const getPODMethods = (order: Order) => {
    const methods = [];
    if (order.podSignature) methods.push("signature");
    if (order.podPhoto) methods.push("photo");
    if (order.podOtp) methods.push("otp");
    return methods;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proof of Delivery</h1>
          <p className="text-gray-600">View and download delivery proofs</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Delivered</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <PenTool className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">With Signature</p>
            <p className="text-2xl font-bold">
              {orders.filter((o: Order) => o.podSignature).length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Camera className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">With Photo</p>
            <p className="text-2xl font-bold">
              {orders.filter((o: Order) => o.podPhoto).length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Key className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">OTP Verified</p>
            <p className="text-2xl font-bold">
              {orders.filter((o: Order) => o.podOtp).length}
            </p>
          </div>
        </Card>
      </div>

      {/* Delivered Orders */}
      <Card>
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold">Delivered Orders</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No delivered orders yet
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
                    Delivered To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Delivered At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    POD Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order: Order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{order.orderNumber}</div>
                      <div className="text-sm text-gray-500">
                        {order.awbNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{order.podReceiverName || order.customerName}</div>
                      <div className="text-sm text-gray-500">
                        {order.deliveryCity}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.deliveredAt ? (
                        <>
                          <div>
                            {new Date(order.deliveredAt).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(order.deliveredAt).toLocaleTimeString()}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {getPODMethods(order).length > 0 ? (
                          getPODMethods(order).map((method) => (
                            <Badge
                              key={method}
                              variant={
                                method === "signature"
                                  ? "info"
                                  : method === "photo"
                                  ? "purple"
                                  : "warning"
                              }
                              size="sm"
                            >
                              {method === "signature" && (
                                <PenTool className="h-3 w-3 mr-1" />
                              )}
                              {method === "photo" && (
                                <Camera className="h-3 w-3 mr-1" />
                              )}
                              {method === "otp" && (
                                <Key className="h-3 w-3 mr-1" />
                              )}
                              {method.charAt(0).toUpperCase() + method.slice(1)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-400">No POD</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{order.partner?.displayName}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        {(order.podSignature || order.podPhoto) && (
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
