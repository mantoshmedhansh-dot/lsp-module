"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface SKU {
  id: string;
  code: string;
  name: string;
  sellingPrice: number | null;
  mrp: number | null;
}

interface OrderItem {
  skuId: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

const channels = [
  { value: "MANUAL", label: "Manual Order" },
  { value: "WEBSITE", label: "Website" },
  { value: "AMAZON", label: "Amazon" },
  { value: "FLIPKART", label: "Flipkart" },
  { value: "MYNTRA", label: "Myntra" },
  { value: "AJIO", label: "Ajio" },
  { value: "MEESHO", label: "Meesho" },
  { value: "SHOPIFY", label: "Shopify" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");
  const [skuResults, setSkuResults] = useState<SKU[]>([]);
  const [isSkuPopoverOpen, setIsSkuPopoverOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    channel: "MANUAL",
    orderType: "B2C",
    paymentMode: "PREPAID",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    shippingAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    locationId: "",
    shipByDate: "",
    remarks: "",
  });

  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations");
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
        if (data.length > 0 && !formData.locationId) {
          setFormData((prev) => ({ ...prev, locationId: data[0].id }));
        }
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }

  async function searchSKUs(query: string) {
    if (query.length < 2) {
      setSkuResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/v1/skus?search=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns array directly, not { skus: [...] }
        setSkuResults(Array.isArray(data) ? data : data.skus || []);
      }
    } catch (error) {
      console.error("Error searching SKUs:", error);
    }
  }

  function addItem(sku: SKU) {
    // Check if SKU already added
    if (items.some((item) => item.skuId === sku.id)) {
      toast.error("This SKU is already added");
      return;
    }

    const newItem: OrderItem = {
      skuId: sku.id,
      skuCode: sku.code,
      skuName: sku.name,
      quantity: 1,
      unitPrice: Number(sku.sellingPrice) || 0,
      discount: 0,
    };

    setItems((prev) => [...prev, newItem]);
    setIsSkuPopoverOpen(false);
    setSkuSearch("");
    setSkuResults([]);
  }

  function updateItem(index: number, field: keyof OrderItem, value: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function calculateTotals() {
    let subtotal = 0;
    let discount = 0;

    items.forEach((item) => {
      subtotal += item.unitPrice * item.quantity;
      discount += item.discount;
    });

    const taxAmount = (subtotal - discount) * 0.18; // 18% GST
    const totalAmount = subtotal - discount + taxAmount;

    return { subtotal, discount, taxAmount, totalAmount };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    if (!formData.customerName || !formData.customerPhone) {
      toast.error("Customer name and phone are required");
      return;
    }

    if (!formData.shippingAddress.line1 || !formData.shippingAddress.city || !formData.shippingAddress.pincode) {
      toast.error("Shipping address is incomplete");
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate order number
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNo = `ORD-${timestamp}-${random}`;

      const payload = {
        orderNo,
        channel: formData.channel,
        orderType: formData.orderType,
        paymentMode: formData.paymentMode,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || null,
        shippingAddress: formData.shippingAddress,
        locationId: formData.locationId,
        shipByDate: formData.shipByDate ? new Date(formData.shipByDate).toISOString() : null,
        remarks: formData.remarks || null,
        subtotal: totals.subtotal.toFixed(2),
        taxAmount: totals.taxAmount.toFixed(2),
        totalAmount: totals.totalAmount.toFixed(2),
        discount: totals.discount.toFixed(2),
        shippingCharges: "0.00",
        codCharges: "0.00",
        orderDate: new Date().toISOString(),
      };

      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || "Failed to create order");
      }

      const order = await response.json();

      // Create order items
      for (const item of items) {
        const itemTax = (item.unitPrice * item.quantity - item.discount) * 0.18;
        const itemTotal = item.unitPrice * item.quantity - item.discount + itemTax;

        const itemPayload = {
          orderId: order.id,
          skuId: item.skuId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          taxAmount: itemTax.toFixed(2),
          discount: item.discount.toFixed(2),
          totalPrice: itemTotal.toFixed(2),
        };

        const itemResponse = await fetch(`/api/v1/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemPayload),
        });

        if (!itemResponse.ok) {
          console.error("Failed to create order item:", await itemResponse.text());
        }
      }

      toast.success("Order created successfully");
      router.push(`/orders/${order.id}`);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Order</h1>
          <p className="text-muted-foreground">Add a new manual order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>Add products to this order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* SKU Search */}
                <Popover open={isSkuPopoverOpen} onOpenChange={setIsSkuPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-start"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Search and add products...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search by SKU code or name..."
                        value={skuSearch}
                        onValueChange={(value) => {
                          setSkuSearch(value);
                          searchSKUs(value);
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {skuSearch.length < 2
                            ? "Type at least 2 characters to search"
                            : "No products found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {skuResults.map((sku) => (
                            <CommandItem
                              key={sku.id}
                              value={sku.code}
                              onSelect={() => addItem(sku)}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              <div className="flex-1">
                                <p className="font-medium">{sku.code}</p>
                                <p className="text-sm text-muted-foreground">
                                  {sku.name}
                                </p>
                              </div>
                              <span className="text-sm font-medium">
                                ₹{Number(sku.sellingPrice || 0).toLocaleString()}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Items Table */}
                {items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">Unit Price</TableHead>
                        <TableHead className="w-28">Discount</TableHead>
                        <TableHead className="w-32 text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        const itemTotal =
                          item.unitPrice * item.quantity - item.discount;
                        return (
                          <TableRow key={item.skuId}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.skuCode}</p>
                                <p className="text-sm text-muted-foreground">
                                  {item.skuName}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "quantity",
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "discount",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{itemTotal.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No items added yet</p>
                    <p className="text-sm text-muted-foreground">
                      Search for products above to add them to this order
                    </p>
                  </div>
                )}

                {/* Totals */}
                {items.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>₹{totals.subtotal.toLocaleString()}</span>
                        </div>
                        {totals.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount</span>
                            <span>-₹{totals.discount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax (18%)</span>
                          <span>₹{totals.taxAmount.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>₹{totals.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) =>
                        setFormData({ ...formData, customerName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Phone *</Label>
                    <Input
                      id="customerPhone"
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, customerPhone: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, customerEmail: e.target.value })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="line1">Address Line 1 *</Label>
                  <Input
                    id="line1"
                    value={formData.shippingAddress.line1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shippingAddress: {
                          ...formData.shippingAddress,
                          line1: e.target.value,
                        },
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line2">Address Line 2</Label>
                  <Input
                    id="line2"
                    value={formData.shippingAddress.line2}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shippingAddress: {
                          ...formData.shippingAddress,
                          line2: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.shippingAddress.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: {
                            ...formData.shippingAddress,
                            city: e.target.value,
                          },
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.shippingAddress.state}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: {
                            ...formData.shippingAddress,
                            state: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      value={formData.shippingAddress.pincode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: {
                            ...formData.shippingAddress,
                            pincode: e.target.value,
                          },
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.shippingAddress.country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          shippingAddress: {
                            ...formData.shippingAddress,
                            country: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Order Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <Select
                    value={formData.channel}
                    onValueChange={(value) =>
                      setFormData({ ...formData, channel: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.value} value={channel.value}>
                          {channel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderType">Order Type</Label>
                  <Select
                    value={formData.orderType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, orderType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2C">B2C (Business to Consumer)</SelectItem>
                      <SelectItem value="B2B">B2B (Business to Business)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMode">Payment Mode</Label>
                  <Select
                    value={formData.paymentMode}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMode: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREPAID">Prepaid</SelectItem>
                      <SelectItem value="COD">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationId">Fulfillment Location</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, locationId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipByDate">Ship By Date</Label>
                  <Input
                    id="shipByDate"
                    type="date"
                    value={formData.shipByDate}
                    onChange={(e) =>
                      setFormData({ ...formData, shipByDate: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    placeholder="Any special instructions..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || items.length === 0}
                  >
                    {isSubmitting ? "Creating..." : "Create Order"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
