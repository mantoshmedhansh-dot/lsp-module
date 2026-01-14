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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Save,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  Printer,
  Download,
  Copy,
  Mail,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface QuotationItem {
  id: string;
  sku: {
    id: string;
    code: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: "PERCENTAGE" | "FIXED";
  taxRate: number;
  total: number;
  notes?: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  customer: {
    id: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
  };
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONVERTED";
  validUntil: string;
  items: QuotationItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  termsAndConditions?: string;
  createdBy?: {
    id: string;
    name: string;
  };
  approvedBy?: {
    id: string;
    name: string;
  };
  convertedOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quotationId = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const fetchQuotation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quotations/${quotationId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Quotation not found");
          router.push("/b2b/quotations");
          return;
        }
        throw new Error("Failed to fetch quotation");
      }
      const data = await response.json();
      setQuotation(data);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      toast.error("Failed to load quotation");
    } finally {
      setLoading(false);
    }
  }, [quotationId, router]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  const handleSubmitForApproval = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/quotations/${quotationId}/submit`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to submit quotation");

      await fetchQuotation();
      toast.success("Quotation submitted for approval");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to submit quotation");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/quotations/${quotationId}/approve`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to approve quotation");

      await fetchQuotation();
      toast.success("Quotation approved");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to approve quotation");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/quotations/${quotationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) throw new Error("Failed to reject quotation");

      await fetchQuotation();
      setShowRejectDialog(false);
      setRejectReason("");
      toast.success("Quotation rejected");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to reject quotation");
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToOrder = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/quotations/${quotationId}/convert`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to convert quotation");

      const data = await response.json();
      toast.success("Quotation converted to order");
      router.push(`/orders/${data.orderId}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to convert quotation");
    } finally {
      setSaving(false);
      setShowConvertDialog(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to duplicate quotation");

      const data = await response.json();
      toast.success("Quotation duplicated");
      router.push(`/b2b/quotations/${data.id}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to duplicate quotation");
    }
  };

  const handleSendEmail = async () => {
    try {
      const response = await fetch(`/api/quotations/${quotationId}/send`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to send quotation");

      toast.success("Quotation sent to customer");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to send quotation");
    }
  };

  const getStatusBadge = (status: Quotation["status"]) => {
    const configs: Record<
      Quotation["status"],
      { color: string; icon: React.ReactNode }
    > = {
      DRAFT: {
        color: "bg-gray-100 text-gray-800",
        icon: <Pencil className="h-3 w-3" />,
      },
      PENDING_APPROVAL: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="h-3 w-3" />,
      },
      APPROVED: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="h-3 w-3" />,
      },
      REJECTED: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="h-3 w-3" />,
      },
      EXPIRED: {
        color: "bg-orange-100 text-orange-800",
        icon: <Clock className="h-3 w-3" />,
      },
      CONVERTED: {
        color: "bg-blue-100 text-blue-800",
        icon: <ShoppingCart className="h-3 w-3" />,
      },
    };
    const config = configs[status];
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const isExpired = quotation
    ? new Date(quotation.validUntil) < new Date()
    : false;

  const canEdit = quotation?.status === "DRAFT";
  const canSubmit = quotation?.status === "DRAFT" && !isExpired;
  const canApprove = quotation?.status === "PENDING_APPROVAL" && !isExpired;
  const canConvert = quotation?.status === "APPROVED" && !isExpired;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Quotation not found</p>
        <Button onClick={() => router.push("/b2b/quotations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quotations
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
              <FileText className="h-6 w-6" />
              {quotation.quotationNumber}
            </h1>
            <p className="text-muted-foreground">
              Created {new Date(quotation.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {quotation.status === "APPROVED" && (
            <Button variant="outline" onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => router.push(`/b2b/quotations/${quotationId}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canSubmit && (
            <Button onClick={handleSubmitForApproval} disabled={saving}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={saving}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={saving}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}
          {canConvert && (
            <Button onClick={() => setShowConvertDialog(true)} disabled={saving}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Convert to Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(quotation.status)}
              {isExpired && quotation.status !== "CONVERTED" && (
                <Badge variant="destructive">Expired</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valid Until</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`text-lg font-semibold ${
                isExpired ? "text-red-600" : ""
              }`}
            >
              {new Date(quotation.validUntil).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Items</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{quotation.items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Amount</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(quotation.total)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Customer Name</Label>
                <p
                  className="font-medium cursor-pointer hover:underline"
                  onClick={() =>
                    router.push(`/b2b/customers/${quotation.customer.id}`)
                  }
                >
                  {quotation.customer.name}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Customer Code</Label>
                <p>{quotation.customer.code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p>{quotation.customer.email || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p>{quotation.customer.phone || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quotation.createdBy && (
              <div>
                <Label className="text-muted-foreground">Created By</Label>
                <p className="text-sm">{quotation.createdBy.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(quotation.createdAt).toLocaleString()}
                </p>
              </div>
            )}
            {quotation.approvedBy && (
              <div>
                <Label className="text-muted-foreground">Approved By</Label>
                <p className="text-sm">{quotation.approvedBy.name}</p>
              </div>
            )}
            {quotation.convertedOrderId && (
              <div>
                <Label className="text-muted-foreground">Converted Order</Label>
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() =>
                    router.push(`/orders/${quotation.convertedOrderId}`)
                  }
                >
                  View Order
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotation Items</CardTitle>
          <CardDescription>
            Products and services included in this quotation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.sku.code}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.sku.name}</p>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.discount > 0 ? (
                      <span className="text-green-600">
                        {item.discountType === "PERCENTAGE"
                          ? `${item.discount}%`
                          : formatCurrency(item.discount)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(quotation.subtotal)}</span>
              </div>
              {quotation.discountTotal > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(quotation.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(quotation.taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(quotation.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(quotation.notes || quotation.termsAndConditions) && (
        <div className="grid gap-6 md:grid-cols-2">
          {quotation.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
              </CardContent>
            </Card>
          )}
          {quotation.termsAndConditions && (
            <Card>
              <CardHeader>
                <CardTitle>Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {quotation.termsAndConditions}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Quotation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this quotation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={saving}>
              Reject Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Order</DialogTitle>
            <DialogDescription>
              This will create a new order based on this quotation. The
              quotation will be marked as converted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{quotation.customer.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Items</span>
                <span>{quotation.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatCurrency(quotation.total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertToOrder} disabled={saving}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
