"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  Truck,
  User,
  Phone,
  Mail,
  CreditCard,
  FileText,
  ExternalLink,
  Download,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusBadge,
  Badge,
  OrderTimeline,
  type TimelineStep,
} from "@cjdquick/ui";
import { ORDER_STAGES } from "@cjdquick/types";

interface OrderEvent {
  id: string;
  status: string;
  statusText: string;
  location: string | null;
  eventTime: string;
  source: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentMode: string;
  codAmount: number;
  awbNumber: string | null;
  labelUrl: string | null;
  trackingUrl: string | null;

  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  deliveryPincode: string;
  deliveryCity: string;
  deliveryState: string;
  originPincode: string;

  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  volumetricWeight: number | null;
  chargeableWeight: number | null;

  itemDescription: string;
  itemValue: number;
  itemQuantity: number;

  partnerRate: number | null;
  clientRate: number | null;
  expectedDeliveryDate: string | null;

  manifestedAt: string | null;
  pickedAt: string | null;
  packedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;

  podReceiverName: string | null;
  podSignature: string | null;
  podPhoto: string | null;

  createdAt: string;

  partner?: {
    code: string;
    displayName: string;
  };
  warehouse?: {
    name: string;
    code: string;
  };
  events: OrderEvent[];
}

async function fetchOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}`);
  return res.json();
}

function getStageStatus(
  order: Order,
  stage: string
): "completed" | "current" | "pending" {
  const stageTimestamps: Record<string, string | null> = {
    manifestation: order.manifestedAt,
    pick: order.pickedAt,
    pack: order.packedAt,
    dispatch: order.dispatchedAt,
    delivery: order.deliveredAt,
    pod: order.deliveredAt,
  };

  const stageIndex = ORDER_STAGES.indexOf(stage as any);
  const currentStageIndex = ORDER_STAGES.findIndex((s) => {
    const timestamp = stageTimestamps[s];
    return !timestamp;
  });

  if (order.status === "DELIVERED") return "completed";
  if (stageTimestamps[stage]) return "completed";
  if (stageIndex === currentStageIndex || currentStageIndex === -1)
    return "current";
  return "pending";
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => fetchOrder(orderId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const order: Order = data?.data;

  if (!order) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-gray-300" />
        <p className="mt-4 text-gray-500">Order not found</p>
        <Link href="/admin/orders">
          <Button variant="outline" className="mt-4">
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const timelineSteps: TimelineStep[] = ORDER_STAGES.map((stage) => ({
    id: stage,
    label: stage.charAt(0).toUpperCase() + stage.slice(1),
    status: getStageStatus(order, stage),
    timestamp:
      stage === "manifestation" && order.manifestedAt
        ? new Date(order.manifestedAt).toLocaleString()
        : stage === "pick" && order.pickedAt
        ? new Date(order.pickedAt).toLocaleString()
        : stage === "pack" && order.packedAt
        ? new Date(order.packedAt).toLocaleString()
        : stage === "dispatch" && order.dispatchedAt
        ? new Date(order.dispatchedAt).toLocaleString()
        : stage === "delivery" && order.deliveredAt
        ? new Date(order.deliveredAt).toLocaleString()
        : undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {order.orderNumber}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            {order.awbNumber && (
              <p className="text-gray-500">AWB: {order.awbNumber}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          {order.labelUrl && (
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Label
            </Button>
          )}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Track
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="py-6">
          <OrderTimeline steps={timelineSteps} orientation="horizontal" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary-600" />
                Customer & Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Customer
                </h4>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-gray-600 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {order.customerPhone}
                </p>
                {order.customerEmail && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {order.customerEmail}
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Delivery Address
                </h4>
                <p className="text-gray-900">{order.deliveryAddress}</p>
                <p className="text-gray-600">
                  {order.deliveryCity}, {order.deliveryState} -{" "}
                  {order.deliveryPincode}
                </p>
              </div>
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
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Item</p>
                <p className="font-medium">{order.itemDescription}</p>
                <p className="text-sm text-gray-500">
                  Qty: {order.itemQuantity}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Weight</p>
                <p className="font-medium">{order.weightKg} kg</p>
                {order.chargeableWeight && (
                  <p className="text-sm text-gray-500">
                    Chargeable: {order.chargeableWeight} kg
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Dimensions</p>
                {order.lengthCm && order.widthCm && order.heightCm ? (
                  <p className="font-medium">
                    {order.lengthCm} x {order.widthCm} x {order.heightCm} cm
                  </p>
                ) : (
                  <p className="text-gray-400">Not specified</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Declared Value</p>
                <p className="font-medium">₹{order.itemValue}</p>
              </div>
            </CardContent>
          </Card>

          {/* Event History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-600" />
                Tracking History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.events.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No tracking events yet
                </p>
              ) : (
                <div className="space-y-4">
                  {order.events.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            index === 0 ? "bg-primary-600" : "bg-gray-300"
                          }`}
                        />
                        {index < order.events.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-gray-900">
                          {event.statusText}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(event.eventTime).toLocaleString()}
                          {event.location && ` • ${event.location}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Partner Info */}
          {order.partner && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary-600" />
                  Logistics Partner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{order.partner.displayName}</p>
                <p className="text-sm text-gray-500">{order.partner.code}</p>
                {order.expectedDeliveryDate && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Expected Delivery</p>
                    <p className="font-medium">
                      {new Date(
                        order.expectedDeliveryDate
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary-600" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Mode</span>
                <Badge
                  variant={order.paymentMode === "COD" ? "warning" : "info"}
                >
                  {order.paymentMode}
                </Badge>
              </div>
              {order.paymentMode === "COD" && (
                <div className="flex justify-between">
                  <span className="text-gray-500">COD Amount</span>
                  <span className="font-medium">₹{order.codAmount}</span>
                </div>
              )}
              {order.clientRate && (
                <div className="flex justify-between border-t pt-3">
                  <span className="text-gray-500">Shipping Charge</span>
                  <span className="font-medium">
                    ₹{order.clientRate.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* POD Info */}
          {order.status === "DELIVERED" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Proof of Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.podReceiverName && (
                  <div>
                    <p className="text-sm text-gray-500">Received By</p>
                    <p className="font-medium">{order.podReceiverName}</p>
                  </div>
                )}
                {order.deliveredAt && (
                  <div>
                    <p className="text-sm text-gray-500">Delivered At</p>
                    <p className="font-medium">
                      {new Date(order.deliveredAt).toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {order.podSignature && (
                    <Badge variant="info" size="sm">
                      Signature
                    </Badge>
                  )}
                  {order.podPhoto && (
                    <Badge variant="purple" size="sm">
                      Photo
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                Order Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Origin</span>
                <span>{order.originPincode}</span>
              </div>
              {order.warehouse && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Warehouse</span>
                  <span>{order.warehouse.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
