"use client";

import { useEffect, useState } from "react";
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Edit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  gst: string;
  customerType: string;
  status: string;
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  paymentTerms: string;
  creditLimit: number;
  priceList?: string;
}

export default function B2BAccountPage() {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    try {
      const response = await fetch("/api/v1/b2b/account");
      if (response.ok) {
        const result = await response.json();
        setAccount(result.account);
      }
    } catch (error) {
      console.error("Failed to fetch account:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const mockAccount: CustomerAccount = account || {
    id: "cust-001",
    name: "Rajesh Kumar",
    email: "rajesh@retailmart.com",
    phone: "+91 98765 43210",
    companyName: "Retail Mart Pvt Ltd",
    gst: "27AADCR1234H1ZK",
    customerType: "DISTRIBUTOR",
    status: "ACTIVE",
    billingAddress: {
      line1: "123 MG Road",
      line2: "Near City Mall",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    shippingAddress: {
      line1: "456 Industrial Area",
      line2: "Warehouse B",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400070",
    },
    paymentTerms: "NET_30",
    creditLimit: 1000000,
    priceList: "Distributor Pricing",
  };

  const formatPaymentTerms = (terms: string) => {
    const termMap: Record<string, string> = {
      IMMEDIATE: "Immediate Payment",
      NET_7: "Net 7 Days",
      NET_15: "Net 15 Days",
      NET_30: "Net 30 Days",
      NET_45: "Net 45 Days",
      NET_60: "Net 60 Days",
    };
    return termMap[terms] || terms;
  };

  const getCustomerTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      RETAIL: "bg-blue-100 text-blue-800",
      WHOLESALE: "bg-purple-100 text-purple-800",
      DISTRIBUTOR: "bg-green-100 text-green-800",
      DEALER: "bg-orange-100 text-orange-800",
      CORPORATE: "bg-indigo-100 text-indigo-800",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-800"}>
        {type}
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-gray-500">Manage your account information</p>
        </div>
        <Button variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Company Name</span>
              <span className="font-medium">{mockAccount.companyName}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500">GST Number</span>
              <span className="font-mono">{mockAccount.gst}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Customer Type</span>
              {getCustomerTypeBadge(mockAccount.customerType)}
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Status</span>
              <Badge
                className={
                  mockAccount.status === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {mockAccount.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Person
              </span>
              <span className="font-medium">{mockAccount.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </span>
              <span>{mockAccount.email}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </span>
              <span>{mockAccount.phone}</span>
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Billing Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p>{mockAccount.billingAddress.line1}</p>
                {mockAccount.billingAddress.line2 && (
                  <p>{mockAccount.billingAddress.line2}</p>
                )}
                <p>
                  {mockAccount.billingAddress.city}, {mockAccount.billingAddress.state}
                </p>
                <p className="font-mono">{mockAccount.billingAddress.pincode}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shipping Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p>{mockAccount.shippingAddress.line1}</p>
                {mockAccount.shippingAddress.line2 && (
                  <p>{mockAccount.shippingAddress.line2}</p>
                )}
                <p>
                  {mockAccount.shippingAddress.city}, {mockAccount.shippingAddress.state}
                </p>
                <p className="font-mono">{mockAccount.shippingAddress.pincode}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Terms */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Terms
            </CardTitle>
            <CardDescription>Your pricing and payment terms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Payment Terms</p>
                <p className="text-lg font-medium mt-1">
                  {formatPaymentTerms(mockAccount.paymentTerms)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Credit Limit</p>
                <p className="text-lg font-medium mt-1">
                  {mockAccount.creditLimit.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Price List</p>
                <p className="text-lg font-medium mt-1">
                  {mockAccount.priceList || "Standard Pricing"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
