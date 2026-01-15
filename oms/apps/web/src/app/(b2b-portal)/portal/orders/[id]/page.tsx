"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderItem {
  id: string;
  sku: {
    code: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  createdAt: string;
  expectedDelivery?: string;
  deliveredAt?: string;
  awbNumber?: string;
  transporter?: {
    name: string;
    trackingUrl?: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  PROCESSING: { label: "Processing", color: "bg-purple-100 text-purple-800", icon: Package },
  SHIPPED: { label: "Shipped", color: "bg-indigo-100 text-indigo-800", icon: Truck },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: Clock },
};

export default function B2BOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/b2b/orders/${params.id}`);
      if (response.ok) {
        const result = await response.json();
        setOrder(result);
      }
    } catch (error) {
      console.error("Failed to fetch order:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration if API fails
  const mockOrder: Order = order || {
    id: params.id as string,
    orderNo: "B2B-2024-0156",
    status: "SHIPPED",
    totalAmount: 145000,
    subtotal: 140000,
    taxAmount: 5000,
    discountAmount: 0,
    createdAt: "2024-01-14",
    expectedDelivery: "2024-01-18",
    awbNumber: "DTDC12345678",
    transporter: {
      name: "DTDC",
      trackingUrl: "https://www.dtdc.in/tracking.asp",
    },
    shippingAddress: {
      line1: "456 Industrial Area",
      line2: "Warehouse B",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400070",
      phone: "+91 98765 43210",
    },
    items: [
      { id: "1", sku: { code: "SKU-001", name: "Premium Cotton T-Shirt" }, quantity: 50, unitPrice: 450, totalPrice: 22500 },
      { id: "2", sku: { code: "SKU-002", name: "Denim Jeans Classic" }, quantity: 30, unitPrice: 1200, totalPrice: 36000 },
      { id: "3", sku: { code: "SKU-003", name: "Running Shoes Pro" }, quantity: 20, unitPrice: 2500, totalPrice: 50000 },
      { id: "4", sku: { code: "SKU-005", name: "Formal Shirt White" }, quantity: 36, unitPrice: 850, totalPrice: 30600 },
    ],
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1 text-sm px-3 py-1`}>
        <Icon className="h-4 w-4" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{mockOrder.orderNo}</h1>
            <p className="text-gray-500">Order placed on {mockOrder.createdAt}</p>
          </div>
        </div>
        {getStatusBadge(mockOrder.status)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>{mockOrder.items.length} items in this order</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockOrder.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.sku.name}</p>
                        <p className="text-xs text-gray-500">{item.sku.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.totalPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 bg-gray-50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{mockOrder.subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              {mockOrder.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{mockOrder.discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (GST)</span>
                <span>{mockOrder.taxAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{mockOrder.totalAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side Cards */}
        <div className="space-y-6">
          {/* Tracking */}
          {mockOrder.awbNumber && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipment Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Transporter</p>
                  <p className="font-medium">{mockOrder.transporter?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">AWB Number</p>
                  <p className="font-mono font-medium">{mockOrder.awbNumber}</p>
                </div>
                {mockOrder.expectedDelivery && (
                  <div>
                    <p className="text-sm text-gray-500">Expected Delivery</p>
                    <p className="font-medium">{mockOrder.expectedDelivery}</p>
                  </div>
                )}
                {mockOrder.transporter?.trackingUrl && (
                  <Button className="w-full" variant="outline" asChild>
                    <a href={mockOrder.transporter.trackingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Track Shipment
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shipping Address */}
          {mockOrder.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p>{mockOrder.shippingAddress.line1}</p>
                  {mockOrder.shippingAddress.line2 && <p>{mockOrder.shippingAddress.line2}</p>}
                  <p>{mockOrder.shippingAddress.city}, {mockOrder.shippingAddress.state}</p>
                  <p className="font-mono">{mockOrder.shippingAddress.pincode}</p>
                  {mockOrder.shippingAddress.phone && (
                    <p className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                      <Phone className="h-4 w-4" />
                      {mockOrder.shippingAddress.phone}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                Download Invoice
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/portal/catalog">
                  Reorder Items
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
