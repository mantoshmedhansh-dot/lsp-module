"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Building2,
  Pencil,
  Save,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Package,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  code: string;
  name: string;
  type: "RETAIL" | "WHOLESALE" | "DISTRIBUTOR" | "DEALER" | "CORPORATE";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  email?: string;
  phone?: string;
  gst?: string;
  pan?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: "AVAILABLE" | "EXCEEDED" | "BLOCKED" | "ON_HOLD";
  paymentTermType: string;
  priceListId?: string;
  priceList?: {
    id: string;
    name: string;
  };
  customerGroup?: {
    id: string;
    name: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    orders: number;
    quotations: number;
    creditTransactions: number;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface CreditTransaction {
  id: string;
  type: "CREDIT" | "DEBIT" | "ADJUSTMENT";
  amount: number;
  balance: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

const CUSTOMER_TYPES = [
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "DEALER", label: "Dealer" },
  { value: "CORPORATE", label: "Corporate" },
];

const CUSTOMER_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "BLOCKED", label: "Blocked" },
];

const PAYMENT_TERMS = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "NET_7", label: "Net 7 Days" },
  { value: "NET_15", label: "Net 15 Days" },
  { value: "NET_30", label: "Net 30 Days" },
  { value: "NET_45", label: "Net 45 Days" },
  { value: "NET_60", label: "Net 60 Days" },
  { value: "NET_90", label: "Net 90 Days" },
];

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [formData, setFormData] = useState({
    name: "",
    type: "RETAIL" as Customer["type"],
    status: "ACTIVE" as Customer["status"],
    email: "",
    phone: "",
    gst: "",
    pan: "",
    creditLimit: 0,
    paymentTermType: "IMMEDIATE",
    notes: "",
  });

  const [addressForm, setAddressForm] = useState({
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingPincode: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
    sameAsBilling: false,
  });

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/customers/${customerId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Customer not found");
          router.push("/b2b/customers");
          return;
        }
        throw new Error("Failed to fetch customer");
      }
      const data = await response.json();
      setCustomer(data);
      setFormData({
        name: data.name,
        type: data.type,
        status: data.status,
        email: data.email || "",
        phone: data.phone || "",
        gst: data.gst || "",
        pan: data.pan || "",
        creditLimit: data.creditLimit,
        paymentTermType: data.paymentTermType,
        notes: data.notes || "",
      });
      if (data.billingAddress) {
        setAddressForm((prev) => ({
          ...prev,
          billingLine1: data.billingAddress.line1,
          billingLine2: data.billingAddress.line2 || "",
          billingCity: data.billingAddress.city,
          billingState: data.billingAddress.state,
          billingPincode: data.billingAddress.pincode,
        }));
      }
      if (data.shippingAddress) {
        setAddressForm((prev) => ({
          ...prev,
          shippingLine1: data.shippingAddress.line1,
          shippingLine2: data.shippingAddress.line2 || "",
          shippingCity: data.shippingAddress.city,
          shippingState: data.shippingAddress.state,
          shippingPincode: data.shippingAddress.pincode,
        }));
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [customerId, router]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/customers/${customerId}/orders?limit=10`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, [customerId]);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/customers/${customerId}/credit-transactions?limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders();
    } else if (activeTab === "credit") {
      fetchTransactions();
    }
  }, [activeTab, fetchOrders, fetchTransactions]);

  const handleSaveCustomer = async () => {
    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/v1/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          billingAddress: addressForm.billingLine1
            ? {
                line1: addressForm.billingLine1,
                line2: addressForm.billingLine2,
                city: addressForm.billingCity,
                state: addressForm.billingState,
                pincode: addressForm.billingPincode,
                country: "India",
              }
            : null,
          shippingAddress: addressForm.shippingLine1
            ? {
                line1: addressForm.sameAsBilling
                  ? addressForm.billingLine1
                  : addressForm.shippingLine1,
                line2: addressForm.sameAsBilling
                  ? addressForm.billingLine2
                  : addressForm.shippingLine2,
                city: addressForm.sameAsBilling
                  ? addressForm.billingCity
                  : addressForm.shippingCity,
                state: addressForm.sameAsBilling
                  ? addressForm.billingState
                  : addressForm.shippingState,
                pincode: addressForm.sameAsBilling
                  ? addressForm.billingPincode
                  : addressForm.shippingPincode,
                country: "India",
              }
            : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update customer");

      const updated = await response.json();
      setCustomer(updated);
      setIsEditing(false);
      toast.success("Customer updated successfully");
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: Customer["status"]) => {
    const colors: Record<Customer["status"], string> = {
      ACTIVE: "bg-green-100 text-green-800",
      INACTIVE: "bg-gray-100 text-gray-800",
      SUSPENDED: "bg-yellow-100 text-yellow-800",
      BLOCKED: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  const getCreditStatusBadge = (status: Customer["creditStatus"]) => {
    const colors: Record<Customer["creditStatus"], string> = {
      AVAILABLE: "bg-green-100 text-green-800",
      EXCEEDED: "bg-red-100 text-red-800",
      BLOCKED: "bg-gray-100 text-gray-800",
      ON_HOLD: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={colors[status]}>{status.replace("_", " ")}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Customer not found</p>
        <Button onClick={() => router.push("/b2b/customers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {customer.name}
            </h1>
            <p className="text-muted-foreground">
              {customer.code} - {customer.type}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/b2b/quotations/new?customerId=${customerId}`)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Quotation
          </Button>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCustomer} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Customer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>{getStatusBadge(customer.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit Available</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(customer.creditAvailable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit Used</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(customer.creditUsed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customer._count?.orders || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="credit">Credit & Payments</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Customer Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>Customer Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              type: value as Customer["type"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMER_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              status: value as Customer["status"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOMER_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer Code</Label>
                      <p className="font-medium">{customer.code}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Customer Type</Label>
                      <p>{customer.type}</p>
                    </div>
                    {customer.customerGroup && (
                      <div>
                        <Label className="text-muted-foreground">Customer Group</Label>
                        <p>{customer.customerGroup.name}</p>
                      </div>
                    )}
                    {customer.priceList && (
                      <div>
                        <Label className="text-muted-foreground">Price List</Label>
                        <p>{customer.priceList.name}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="customer@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p>{customer.email || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p>{customer.phone || "-"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>GSTIN</Label>
                      <Input
                        value={formData.gst}
                        onChange={(e) =>
                          setFormData({ ...formData, gst: e.target.value })
                        }
                        placeholder="22AAAAA0000A1Z5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PAN</Label>
                      <Input
                        value={formData.pan}
                        onChange={(e) =>
                          setFormData({ ...formData, pan: e.target.value })
                        }
                        placeholder="AAAAA0000A"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4">
                    <div>
                      <Label className="text-muted-foreground">GSTIN</Label>
                      <p className="font-mono">{customer.gst || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PAN</Label>
                      <p className="font-mono">{customer.pan || "-"}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Add notes about this customer"
                    rows={4}
                  />
                ) : (
                  <p className="text-sm">{customer.notes || "No notes"}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Address Line 1</Label>
                      <Input
                        value={addressForm.billingLine1}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            billingLine1: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={addressForm.billingLine2}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            billingLine2: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={addressForm.billingCity}
                          onChange={(e) =>
                            setAddressForm({
                              ...addressForm,
                              billingCity: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          value={addressForm.billingState}
                          onChange={(e) =>
                            setAddressForm({
                              ...addressForm,
                              billingState: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input
                        value={addressForm.billingPincode}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            billingPincode: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : customer.billingAddress ? (
                  <div className="text-sm">
                    <p>{customer.billingAddress.line1}</p>
                    {customer.billingAddress.line2 && (
                      <p>{customer.billingAddress.line2}</p>
                    )}
                    <p>
                      {customer.billingAddress.city}, {customer.billingAddress.state}{" "}
                      - {customer.billingAddress.pincode}
                    </p>
                    <p>{customer.billingAddress.country}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No billing address</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing && (
                  <div className="flex items-center gap-2 mb-4">
                    <Switch
                      checked={addressForm.sameAsBilling}
                      onCheckedChange={(checked) =>
                        setAddressForm({ ...addressForm, sameAsBilling: checked })
                      }
                    />
                    <Label>Same as billing address</Label>
                  </div>
                )}
                {isEditing && !addressForm.sameAsBilling ? (
                  <>
                    <div className="space-y-2">
                      <Label>Address Line 1</Label>
                      <Input
                        value={addressForm.shippingLine1}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            shippingLine1: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={addressForm.shippingLine2}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            shippingLine2: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={addressForm.shippingCity}
                          onChange={(e) =>
                            setAddressForm({
                              ...addressForm,
                              shippingCity: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          value={addressForm.shippingState}
                          onChange={(e) =>
                            setAddressForm({
                              ...addressForm,
                              shippingState: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input
                        value={addressForm.shippingPincode}
                        onChange={(e) =>
                          setAddressForm({
                            ...addressForm,
                            shippingPincode: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : customer.shippingAddress ? (
                  <div className="text-sm">
                    <p>{customer.shippingAddress.line1}</p>
                    {customer.shippingAddress.line2 && (
                      <p>{customer.shippingAddress.line2}</p>
                    )}
                    <p>
                      {customer.shippingAddress.city},{" "}
                      {customer.shippingAddress.state} -{" "}
                      {customer.shippingAddress.pincode}
                    </p>
                    <p>{customer.shippingAddress.country}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No shipping address</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credit" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Credit Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credit Status</span>
                  {getCreditStatusBadge(customer.creditStatus)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="font-medium">
                    {formatCurrency(customer.creditLimit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credit Used</span>
                  <span className="font-medium">
                    {formatCurrency(customer.creditUsed)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Available Credit</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(customer.creditAvailable)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Credit Limit</Label>
                      <Input
                        type="number"
                        value={formData.creditLimit}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            creditLimit: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms</Label>
                      <Select
                        value={formData.paymentTermType}
                        onValueChange={(value) =>
                          setFormData({ ...formData, paymentTermType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.map((term) => (
                            <SelectItem key={term.value} value={term.value}>
                              {term.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Payment Terms</Label>
                      <p className="font-medium">
                        {PAYMENT_TERMS.find((t) => t.value === customer.paymentTermType)
                          ?.label || customer.paymentTermType}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Credit
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View Statement
                </Button>
                {customer.creditStatus !== "BLOCKED" && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600"
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Block Credit
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 10 credit transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.type === "CREDIT"
                                ? "default"
                                : tx.type === "DEBIT"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{tx.reference || "-"}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            tx.type === "CREDIT"
                              ? "text-green-600"
                              : tx.type === "DEBIT"
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          {tx.type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(tx.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>
                  Last 10 orders from this customer
                </CardDescription>
              </div>
              <Button onClick={() => router.push(`/orders?customerId=${customerId}`)}>
                View All Orders
              </Button>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No orders found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/orders/${order.id}`)}
                      >
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
