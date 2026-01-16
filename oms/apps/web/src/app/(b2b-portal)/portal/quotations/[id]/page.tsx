"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  ShoppingCart,
  Calendar,
  AlertCircle,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface QuotationItem {
  id: string;
  sku: {
    id: string;
    code: string;
    name: string;
    imageUrl?: string;
  };
  quantity: number;
  listPrice: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalPrice: number;
}

interface Quotation {
  id: string;
  quotationNo: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
  validUntil: string;
  validDays: number;
  remarks?: string;
  shippingAddress?: Record<string, string>;
  billingAddress?: Record<string, string>;
  rejectionReason?: string;
  convertedOrder?: {
    id: string;
    orderNo: string;
    status: string;
  };
  items: QuotationItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: FileText },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: Clock },
  CONVERTED: { label: "Converted to Order", color: "bg-blue-100 text-blue-800", icon: ArrowRight },
};

export default function B2BQuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [params.id]);

  const fetchQuotation = async () => {
    try {
      const response = await fetch(`/api/v1/b2b/quotations/${params.id}`);
      if (response.ok) {
        const result = await response.json();
        setQuotation(result);
      }
    } catch (error) {
      console.error("Failed to fetch quotation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToOrder = async () => {
    setConverting(true);
    try {
      const response = await fetch(`/api/v1/b2b/quotations/${params.id}`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/portal/orders/${result.order.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to convert quotation");
      }
    } catch (error) {
      console.error("Failed to convert quotation:", error);
      alert("Failed to convert quotation");
    } finally {
      setConverting(false);
    }
  };

  // Mock data for demonstration
  const mockQuotation: Quotation = quotation || {
    id: params.id as string,
    quotationNo: "QT-2024-0089",
    status: "APPROVED",
    subtotal: 110000,
    taxAmount: 15000,
    discountAmount: 0,
    totalAmount: 125000,
    createdAt: "2024-01-12",
    validUntil: "2024-01-20",
    validDays: 6,
    remarks: "Please expedite shipping if possible.",
    shippingAddress: {
      line1: "456 Industrial Area",
      line2: "Warehouse B",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400070",
    },
    items: [
      {
        id: "1",
        sku: { id: "1", code: "SKU-001", name: "Premium Cotton T-Shirt" },
        quantity: 100,
        listPrice: 500,
        unitPrice: 450,
        discountPercent: 10,
        discountAmount: 5000,
        taxPercent: 18,
        taxAmount: 8100,
        totalPrice: 53100,
      },
      {
        id: "2",
        sku: { id: "2", code: "SKU-002", name: "Denim Jeans Classic" },
        quantity: 50,
        listPrice: 1200,
        unitPrice: 1140,
        discountPercent: 5,
        discountAmount: 3000,
        taxPercent: 18,
        taxAmount: 10260,
        totalPrice: 67260,
      },
    ],
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.DRAFT;
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
            <h1 className="text-2xl font-bold">{mockQuotation.quotationNo}</h1>
            <p className="text-gray-500">Created on {mockQuotation.createdAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(mockQuotation.status)}
          {mockQuotation.status === "APPROVED" && !mockQuotation.convertedOrder && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={converting}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {converting ? "Converting..." : "Convert to Order"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Convert to Order</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to convert this quotation to an order? This action cannot be undone.
                    The quotation will be marked as converted and a new order will be created.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConvertToOrder}>
                    Yes, Convert to Order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Expiry Warning */}
      {mockQuotation.status === "APPROVED" && mockQuotation.validDays <= 3 && mockQuotation.validDays > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Quotation Expires Soon</p>
            <p className="text-sm text-amber-600">
              This quotation expires in {mockQuotation.validDays} days. Convert to order before {mockQuotation.validUntil}.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Notice */}
      {mockQuotation.status === "REJECTED" && mockQuotation.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Quotation Rejected</p>
            <p className="text-sm text-red-600">{mockQuotation.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Converted Order Notice */}
      {mockQuotation.convertedOrder && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">Converted to Order</p>
              <p className="text-sm text-blue-600">
                Order {mockQuotation.convertedOrder.orderNo} - {mockQuotation.convertedOrder.status}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/portal/orders/${mockQuotation.convertedOrder.id}`}>
              View Order
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quotation Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quotation Items</CardTitle>
            <CardDescription>{mockQuotation.items.length} items in this quotation</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockQuotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.sku.name}</p>
                        <p className="text-xs text-gray-500">{item.sku.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p>{item.unitPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
                        {item.listPrice > item.unitPrice && (
                          <p className="text-xs text-gray-400 line-through">
                            {item.listPrice.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.discountPercent > 0 && (
                        <span className="text-green-600">-{item.discountPercent}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {item.taxPercent}%
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
                <span>{mockQuotation.subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              {mockQuotation.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{mockQuotation.discountAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (GST)</span>
                <span>{mockQuotation.taxAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{mockQuotation.totalAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side Cards */}
        <div className="space-y-6">
          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Validity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Valid Until</p>
                <p className="font-medium">{mockQuotation.validUntil}</p>
              </div>
              {mockQuotation.validDays > 0 && mockQuotation.status === "APPROVED" && (
                <div>
                  <p className="text-sm text-gray-500">Days Remaining</p>
                  <p className={`font-medium ${mockQuotation.validDays <= 3 ? "text-amber-600" : "text-green-600"}`}>
                    {mockQuotation.validDays} days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {mockQuotation.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>{mockQuotation.shippingAddress.line1}</p>
                  {mockQuotation.shippingAddress.line2 && <p>{mockQuotation.shippingAddress.line2}</p>}
                  <p>{mockQuotation.shippingAddress.city}, {mockQuotation.shippingAddress.state}</p>
                  <p className="font-mono">{mockQuotation.shippingAddress.pincode}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remarks */}
          {mockQuotation.remarks && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{mockQuotation.remarks}</p>
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
                Download PDF
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/portal/quotations/new">
                  Request New Quote
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
