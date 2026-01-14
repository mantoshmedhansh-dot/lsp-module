"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Package,
  RefreshCw,
  User,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface OrderItem {
  id: string;
  skuId: string;
  sku: {
    id: string;
    code: string;
    name: string;
    mrp: number;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
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
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPincode: string | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  remarks: string | null;
  items: OrderItem[];
  location: {
    id: string;
    name: string;
  };
}

interface SKU {
  id: string;
  code: string;
  name: string;
  mrp: number;
}

export default function OrderEditPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [skus, setSkus] = useState<SKU[]>([]);

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    shippingCountry: "India",
    billingAddress: "",
    billingCity: "",
    billingState: "",
    billingPincode: "",
    paymentMode: "PREPAID",
    discountAmount: 0,
    shippingAmount: 0,
    remarks: "",
    items: [] as {
      id?: string;
      skuId: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[],
  });

  const fetchOrder = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Order not found");
          router.push("/orders");
          return;
        }
        throw new Error("Failed to fetch order");
      }
      const data = await response.json();
      setOrder(data);

      // Populate form data
      setFormData({
        customerName: data.customerName || "",
        customerEmail: data.customerEmail || "",
        customerPhone: data.customerPhone || "",
        shippingAddress: data.shippingAddress || "",
        shippingCity: data.shippingCity || "",
        shippingState: data.shippingState || "",
        shippingPincode: data.shippingPincode || "",
        shippingCountry: data.shippingCountry || "India",
        billingAddress: data.billingAddress || "",
        billingCity: data.billingCity || "",
        billingState: data.billingState || "",
        billingPincode: data.billingPincode || "",
        paymentMode: data.paymentMode || "PREPAID",
        discountAmount: Number(data.discountAmount) || 0,
        shippingAmount: Number(data.shippingAmount) || 0,
        remarks: data.remarks || "",
        items: data.items.map((item: OrderItem) => ({
          id: item.id,
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
        })),
      });
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, router]);

  const fetchSKUs = useCallback(async () => {
    try {
      const response = await fetch("/api/skus?limit=100");
      if (!response.ok) throw new Error("Failed to fetch SKUs");
      const data = await response.json();
      setSkus(data.skus || []);
    } catch (error) {
      console.error("Error fetching SKUs:", error);
    }
  }, []);

  useEffect(() => {
    fetchOrder();
    fetchSKUs();
  }, [fetchOrder, fetchSKUs]);

  function updateItem(index: number, field: string, value: string | number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    if (skus.length === 0) {
      toast.error("No SKUs available");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          skuId: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function calculateTotals() {
    const subtotal = formData.items.reduce((sum, item) => {
      const sku = skus.find((s) => s.id === item.skuId);
      const price = item.unitPrice || sku?.mrp || 0;
      return sum + price * item.quantity - item.discount;
    }, 0);

    const total = subtotal - formData.discountAmount + formData.shippingAmount;

    return { subtotal, total };
  }

  async function handleSave() {
    if (!formData.customerName || !formData.customerPhone) {
      toast.error("Customer name and phone are required");
      return;
    }

    if (formData.items.length === 0) {
      toast.error("At least one item is required");
      return;
    }

    if (formData.items.some((item) => !item.skuId)) {
      toast.error("Please select SKU for all items");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail || null,
          customerPhone: formData.customerPhone,
          shippingAddress: formData.shippingAddress,
          shippingCity: formData.shippingCity,
          shippingState: formData.shippingState,
          shippingPincode: formData.shippingPincode,
          shippingCountry: formData.shippingCountry,
          billingAddress: formData.billingAddress || null,
          billingCity: formData.billingCity || null,
          billingState: formData.billingState || null,
          billingPincode: formData.billingPincode || null,
          paymentMode: formData.paymentMode,
          discountAmount: formData.discountAmount,
          shippingAmount: formData.shippingAmount,
          remarks: formData.remarks || null,
          items: formData.items.map((item) => ({
            id: item.id,
            skuId: item.skuId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update order");
      }

      toast.success("Order updated successfully");
      router.push(`/orders/${orderId}`);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Order not found</p>
        <Button variant="link" onClick={() => router.push("/orders")}>
          Back to Orders
        </Button>
      </div>
    );
  }

  // Check if order can be edited
  const editableStatuses = ["CREATED", "CONFIRMED"];
  const canEdit = editableStatuses.includes(order.status);

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/orders/${orderId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Order</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Order cannot be edited</p>
            <p className="text-muted-foreground mb-4">
              Orders in {order.status} status cannot be modified
            </p>
            <Button onClick={() => router.push(`/orders/${orderId}`)}>
              View Order Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subtotal, total } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/orders/${orderId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Order</h1>
            <p className="text-muted-foreground">{order.orderNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/orders/${orderId}`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Customer Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))
                  }
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.customerEmail}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))
                }
                placeholder="Enter email address"
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Order Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={formData.paymentMode}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, paymentMode: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREPAID">Prepaid</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Order notes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address *</Label>
            <Textarea
              value={formData.shippingAddress}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, shippingAddress: e.target.value }))
              }
              placeholder="Enter shipping address"
              rows={2}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                value={formData.shippingCity}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, shippingCity: e.target.value }))
                }
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label>State *</Label>
              <Input
                value={formData.shippingState}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, shippingState: e.target.value }))
                }
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label>Pincode *</Label>
              <Input
                value={formData.shippingPincode}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, shippingPincode: e.target.value }))
                }
                placeholder="Pincode"
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={formData.shippingCountry}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, shippingCountry: e.target.value }))
                }
                placeholder="Country"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>Modify items in this order</CardDescription>
          </div>
          <Button onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.items.map((item, index) => {
                const sku = skus.find((s) => s.id === item.skuId);
                const itemTotal = (item.unitPrice || sku?.mrp || 0) * item.quantity - item.discount;

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={item.skuId}
                        onValueChange={(v) => {
                          const selectedSku = skus.find((s) => s.id === v);
                          updateItem(index, "skuId", v);
                          if (selectedSku && !item.unitPrice) {
                            updateItem(index, "unitPrice", selectedSku.mrp);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select SKU" />
                        </SelectTrigger>
                        <SelectContent>
                          {skus.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={item.discount}
                        onChange={(e) =>
                          updateItem(index, "discount", parseFloat(e.target.value) || 0)
                        }
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        ₹{itemTotal.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Discount</span>
                <Input
                  type="number"
                  min={0}
                  value={formData.discountAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      discountAmount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-24 h-7 text-right"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <Input
                  type="number"
                  min={0}
                  value={formData.shippingAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shippingAmount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-24 h-7 text-right"
                />
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
