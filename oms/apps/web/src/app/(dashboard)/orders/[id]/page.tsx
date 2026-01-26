"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Printer,
  FileText,
  ClipboardList,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  allocatedQty: number;
  pickedQty: number;
  packedQty: number;
  shippedQty: number;
  unitPrice: number;
  taxAmount: number;
  discount: number;
  totalPrice: number;
  status: string;
  sku: {
    id: string;
    code: string;
    name: string;
    barcodes: string[];
  };
}

interface Delivery {
  id: string;
  deliveryNo: string;
  status: string;
  awbNo: string | null;
  trackingUrl: string | null;
  weight: number | null;
  boxes: number;
  transporter: {
    id: string;
    code: string;
    name: string;
  } | null;
  manifest: {
    id: string;
    manifestNo: string;
  } | null;
}

interface Picklist {
  id: string;
  picklistNo: string;
  status: string;
  assignedToId: string | null;
  assignedToName?: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    requiredQty: number;
    pickedQty: number;
    skuId: string;
    skuCode?: string;
    skuName?: string;
    binId: string;
    binCode?: string;
  }>;
}

interface Order {
  id: string;
  orderNo: string;
  externalOrderNo: string | null;
  channel: string;
  orderType: string;
  paymentMode: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: Address;
  billingAddress: Address | null;
  subtotal: number;
  taxAmount: number;
  shippingCharges: number;
  discount: number;
  codCharges: number;
  totalAmount: number;
  orderDate: string;
  shipByDate: string | null;
  promisedDate: string | null;
  priority: number;
  tags: string[];
  remarks: string | null;
  location: {
    id: string;
    code: string;
    name: string;
  };
  items: OrderItem[];
  deliveries: Delivery[];
  picklists: Picklist[];
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; color: string }> = {
  CREATED: { label: "Created", variant: "outline", icon: Clock, color: "text-gray-500" },
  CONFIRMED: { label: "Confirmed", variant: "secondary", icon: CheckCircle, color: "text-blue-500" },
  ALLOCATED: { label: "Allocated", variant: "secondary", icon: Package, color: "text-blue-500" },
  PARTIALLY_ALLOCATED: { label: "Partially Allocated", variant: "outline", icon: AlertCircle, color: "text-yellow-500" },
  PICKLIST_GENERATED: { label: "Picklist Generated", variant: "secondary", icon: Package, color: "text-blue-500" },
  PICKING: { label: "Picking", variant: "secondary", icon: Package, color: "text-blue-500" },
  PICKED: { label: "Picked", variant: "secondary", icon: CheckCircle, color: "text-blue-500" },
  PACKING: { label: "Packing", variant: "secondary", icon: Package, color: "text-blue-500" },
  PACKED: { label: "Packed", variant: "default", icon: Package, color: "text-green-500" },
  MANIFESTED: { label: "Manifested", variant: "default", icon: Truck, color: "text-green-500" },
  SHIPPED: { label: "Shipped", variant: "default", icon: Truck, color: "text-green-500" },
  IN_TRANSIT: { label: "In Transit", variant: "default", icon: Truck, color: "text-green-500" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", variant: "default", icon: Truck, color: "text-green-500" },
  DELIVERED: { label: "Delivered", variant: "default", icon: CheckCircle, color: "text-green-600" },
  RTO_INITIATED: { label: "RTO Initiated", variant: "destructive", icon: RefreshCw, color: "text-red-500" },
  RTO_IN_TRANSIT: { label: "RTO In Transit", variant: "destructive", icon: RefreshCw, color: "text-red-500" },
  RTO_DELIVERED: { label: "RTO Delivered", variant: "destructive", icon: RefreshCw, color: "text-red-500" },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle, color: "text-red-500" },
  ON_HOLD: { label: "On Hold", variant: "outline", icon: AlertCircle, color: "text-yellow-500" },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "text-gray-500" },
  ALLOCATED: { label: "Allocated", color: "text-blue-500" },
  PICKED: { label: "Picked", color: "text-blue-500" },
  PACKED: { label: "Packed", color: "text-green-500" },
  SHIPPED: { label: "Shipped", color: "text-green-500" },
  DELIVERED: { label: "Delivered", color: "text-green-600" },
  CANCELLED: { label: "Cancelled", color: "text-red-500" },
  RETURNED: { label: "Returned", color: "text-orange-500" },
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  async function fetchOrder() {
    try {
      setIsLoading(true);

      // Fetch order, items, deliveries, and picklists in parallel
      const [orderRes, itemsRes, deliveriesRes, picklistsRes] = await Promise.all([
        fetch(`/api/v1/orders/${id}`),
        fetch(`/api/v1/orders/${id}/items`),
        fetch(`/api/v1/orders/${id}/deliveries`).catch(() => ({ ok: false })),
        fetch(`/api/v1/waves/picklists?order_id=${id}`).catch(() => ({ ok: false })),
      ]);

      if (!orderRes.ok) throw new Error("Failed to fetch order");

      const orderData = await orderRes.json();
      const itemsData = itemsRes.ok ? await itemsRes.json() : [];
      const deliveriesData = deliveriesRes.ok ? await (deliveriesRes as Response).json() : [];
      const picklistsData = picklistsRes.ok ? await (picklistsRes as Response).json() : [];

      // Fetch location if we have locationId
      let locationData = null;
      if (orderData.locationId) {
        try {
          const locationRes = await fetch(`/api/v1/locations/${orderData.locationId}`);
          if (locationRes.ok) {
            locationData = await locationRes.json();
          }
        } catch {
          // Location fetch failed, use placeholder
        }
      }

      // Fetch SKU details for each item
      const itemsWithSku = await Promise.all(
        (Array.isArray(itemsData) ? itemsData : []).map(async (item: { skuId?: string; sku?: object }) => {
          if (item.sku) return item; // Already has SKU data
          if (!item.skuId) return { ...item, sku: { id: '', code: 'N/A', name: 'Unknown', barcodes: [] } };

          try {
            const skuRes = await fetch(`/api/v1/skus/${item.skuId}`);
            if (skuRes.ok) {
              const skuData = await skuRes.json();
              return { ...item, sku: skuData };
            }
          } catch {
            // SKU fetch failed
          }
          return { ...item, sku: { id: item.skuId, code: 'N/A', name: 'Unknown', barcodes: [] } };
        })
      );

      // Fetch picklist items for each picklist
      const picklistsWithItems = await Promise.all(
        (Array.isArray(picklistsData) ? picklistsData : []).map(async (picklist: { id: string }) => {
          try {
            const itemsRes = await fetch(`/api/v1/waves/picklists/${picklist.id}/items`);
            if (itemsRes.ok) {
              const items = await itemsRes.json();
              return { ...picklist, items: Array.isArray(items) ? items : [] };
            }
          } catch {
            // Items fetch failed
          }
          return { ...picklist, items: [] };
        })
      );

      // Merge data into order object
      setOrder({
        ...orderData,
        items: itemsWithSku,
        deliveries: Array.isArray(deliveriesData) ? deliveriesData : [],
        picklists: picklistsWithItems,
        location: locationData || { id: orderData.locationId, code: '', name: 'Unknown' },
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAllocate() {
    try {
      const response = await fetch(`/api/v1/orders/${id}/allocate`, {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(
          result.fullyAllocated
            ? "Order fully allocated"
            : "Order partially allocated"
        );
        fetchOrder();
      } else {
        toast.error(result.error || "Failed to allocate");
      }
    } catch (error) {
      console.error("Error allocating order:", error);
      toast.error("Failed to allocate order");
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const response = await fetch(`/api/v1/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Order status updated to ${newStatus}`);
        fetchOrder();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  }

  function formatAddress(address: Address | null) {
    if (!address) return "N/A";
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
      address.country,
    ].filter(Boolean);
    return parts.join(", ");
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="link" onClick={() => router.push("/orders")}>
          Back to Orders
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || {
    label: order.status,
    variant: "outline" as const,
    icon: Clock,
    color: "text-gray-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.orderNo}</h1>
              <Badge variant={statusInfo.variant}>
                <statusInfo.icon className="mr-1 h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            {order.externalOrderNo && (
              <p className="text-sm text-muted-foreground">
                External: {order.externalOrderNo}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`/api/print/invoice/${id}`, '_blank');
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Invoice
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`/api/print/label/${id}`, '_blank');
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Print Label
          </Button>
          {["CREATED", "CONFIRMED", "PARTIALLY_ALLOCATED"].includes(order.status) && (
            <Button size="sm" onClick={handleAllocate}>
              <Package className="mr-2 h-4 w-4" />
              Allocate Inventory
            </Button>
          )}
          {order.status === "CREATED" && (
            <Button size="sm" onClick={() => handleStatusChange("CONFIRMED")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Order Summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              {order.items?.length || 0} items in this order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-center">Allocated</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(order.items || []).map((item) => {
                  const itemStatus = itemStatusConfig[item.status] || {
                    label: item.status,
                    color: "text-gray-500",
                  };

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {item.sku?.code || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.sku?.name || 'Unknown Product'}</div>
                        {item.sku?.barcodes?.[0] && (
                          <p className="text-xs text-muted-foreground">
                            {item.sku.barcodes[0]}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={
                            item.allocatedQty >= item.quantity
                              ? "text-green-600"
                              : item.allocatedQty > 0
                                ? "text-yellow-600"
                                : "text-red-600"
                          }
                        >
                          {item.allocatedQty}/{item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{Number(item.unitPrice).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{Number(item.totalPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${itemStatus.color}`}>
                          {itemStatus.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Separator className="my-4" />

            {/* Order Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{Number(order.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>₹{Number(order.taxAmount).toLocaleString()}</span>
                </div>
                {Number(order.shippingCharges) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>₹{Number(order.shippingCharges).toLocaleString()}</span>
                  </div>
                )}
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{Number(order.discount).toLocaleString()}</span>
                  </div>
                )}
                {Number(order.codCharges) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">COD Charges</span>
                    <span>₹{Number(order.codCharges).toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>₹{Number(order.totalAmount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Info Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{order.customerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm">{order.customerPhone}</span>
              </div>
              {order.customerEmail && (
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted p-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm">{order.customerEmail}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{formatAddress(order.shippingAddress)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Channel</span>
                <Badge variant="outline">{order.channel}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <Badge variant={order.paymentMode === "COD" ? "destructive" : "default"}>
                  {order.paymentMode}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span>{order.orderType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span>{order.location.name}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Order Date:</span>
                <span>{format(new Date(order.orderDate), "dd MMM yyyy, HH:mm")}</span>
              </div>
              {order.shipByDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Ship By:</span>
                  <span>{format(new Date(order.shipByDate), "dd MMM yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Picklist Info */}
          {order.picklists && order.picklists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Picklists
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.picklists.map((picklist) => {
                  const totalRequired = picklist.items.reduce(
                    (sum, item) => sum + (item.requiredQty || 0),
                    0
                  );
                  const totalPicked = picklist.items.reduce(
                    (sum, item) => sum + (item.pickedQty || 0),
                    0
                  );
                  const progress =
                    totalRequired > 0
                      ? Math.round((totalPicked / totalRequired) * 100)
                      : 0;

                  return (
                    <div key={picklist.id} className="space-y-2 p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{picklist.picklistNo}</span>
                        <Badge
                          variant="outline"
                          className={
                            picklist.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : picklist.status === "IN_PROGRESS"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {picklist.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{picklist.items.length} item(s)</span>
                        <span>•</span>
                        <span>
                          {totalPicked}/{totalRequired} picked ({progress}%)
                        </span>
                      </div>
                      {picklist.assignedToName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>Assigned to: {picklist.assignedToName}</span>
                        </div>
                      )}
                      {picklist.completedAt && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>
                            Completed:{" "}
                            {format(new Date(picklist.completedAt), "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                      )}
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            progress === 100
                              ? "bg-green-500"
                              : progress > 0
                              ? "bg-yellow-500"
                              : "bg-gray-300"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Delivery Info */}
          {order.deliveries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shipment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.deliveries.map((delivery) => (
                  <div key={delivery.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{delivery.deliveryNo}</span>
                      <Badge variant="outline">{delivery.status}</Badge>
                    </div>
                    {delivery.transporter && (
                      <p className="text-sm text-muted-foreground">
                        {delivery.transporter.name}
                      </p>
                    )}
                    {delivery.awbNo && (
                      <div className="flex items-center gap-2 text-sm">
                        <Truck className="h-4 w-4" />
                        <span>AWB: {delivery.awbNo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Remarks */}
          {order.remarks && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
