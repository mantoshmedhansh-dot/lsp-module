"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ShoppingCart,
  Loader2,
  Package,
  PackageCheck,
  ExternalLink,
  Clock,
  Truck,
  CheckCircle2,
  Building2,
  Calendar,
  FileText,
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ExternalPO {
  id: string;
  externalPoNumber: string;
  externalVendorCode: string;
  externalVendorName: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: string;
  totalLines: number;
  totalExpectedQty: number;
  totalReceivedQty: number;
  totalAmount?: number;
  locationId: string;
  vendorId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: ExternalPOItem[];
  goodsReceipts?: GoodsReceiptRef[];
}

interface ExternalPOItem {
  id: string;
  lineNumber: number;
  externalSkuCode: string;
  externalSkuName: string;
  skuId?: string;
  skuCode?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface GoodsReceiptRef {
  id: string;
  grNo: string;
  status: string;
  totalQty: number;
  postedAt?: string;
  createdAt: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  OPEN: { label: "Open", color: "bg-blue-500", icon: Clock },
  PARTIALLY_RECEIVED: { label: "Partially Received", color: "bg-orange-500", icon: Truck },
  FULLY_RECEIVED: { label: "Fully Received", color: "bg-green-500", icon: CheckCircle2 },
  CLOSED: { label: "Closed", color: "bg-gray-500", icon: FileText },
  CANCELLED: { label: "Cancelled", color: "bg-red-500", icon: FileText },
};

export default function ExternalPODetailPage() {
  const router = useRouter();
  const params = useParams();
  const poId = params.id as string;
  const { data: session } = useSession();

  const [po, setPO] = useState<ExternalPO | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    fetchPODetails();
  }, [poId]);

  async function fetchPODetails() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/external-pos/${poId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("External PO not found");
          router.push("/inbound/external-pos");
          return;
        }
        throw new Error("Failed to fetch External PO");
      }
      const data = await response.json();
      setPO(data);

      // Fetch location
      if (data.locationId) {
        const locResponse = await fetch(`/api/v1/locations/${data.locationId}`);
        if (locResponse.ok) {
          setLocation(await locResponse.json());
        }
      }
    } catch (error) {
      console.error("Error fetching External PO:", error);
      toast.error("Failed to load External PO details");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">External PO not found</p>
        <Button
          variant="link"
          onClick={() => router.push("/inbound/external-pos")}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[po.status] || statusConfig.OPEN;
  const StatusIcon = statusInfo.icon;
  const receivedPercentage = po.totalExpectedQty > 0
    ? Math.round((po.totalReceivedQty / po.totalExpectedQty) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/inbound/external-pos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{po.externalPoNumber}</h1>
              <Badge className={`${statusInfo.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created {formatDistanceToNow(new Date(po.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po.status === "OPEN" && canManage && (
            <Button
              onClick={() => router.push(`/inbound/goods-receipt/new?source=external-po&poId=${po.id}`)}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Create GRN
            </Button>
          )}
          {po.status === "PARTIALLY_RECEIVED" && canManage && (
            <Button
              variant="outline"
              onClick={() => router.push(`/inbound/goods-receipt/new?source=external-po&poId=${po.id}`)}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Create Another GRN
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Lines</p>
                <p className="text-2xl font-bold">{po.totalLines}</p>
              </div>
              <Package className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expected Qty</p>
                <p className="text-2xl font-bold">{po.totalExpectedQty.toLocaleString()}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Received Qty</p>
                <p className="text-2xl font-bold text-green-600">
                  {(po.totalReceivedQty || 0).toLocaleString()}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Received</p>
                <p className="text-2xl font-bold">{receivedPercentage}%</p>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-green-500 flex items-center justify-center">
                <span className="text-xs font-bold">{receivedPercentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* PO Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Purchase Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">PO Number</Label>
                <p className="font-medium">{po.externalPoNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">PO Date</Label>
                <p className="font-medium">
                  {format(new Date(po.poDate), "dd MMM yyyy")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Expected Delivery</Label>
                <p className="font-medium">
                  {po.expectedDeliveryDate
                    ? format(new Date(po.expectedDeliveryDate), "dd MMM yyyy")
                    : "-"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">
                  {location?.name || "Unknown"} ({location?.code || "-"})
                </p>
              </div>
            </div>
            {po.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{po.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Vendor Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Vendor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Vendor Name</Label>
              <p className="font-medium">{po.externalVendorName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Vendor Code</Label>
              <p className="font-medium">{po.externalVendorCode}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            {po.items?.length || 0} items in this purchase order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!po.items || po.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No line items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => {
                  const remaining = item.orderedQty - (item.receivedQty || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.lineNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.skuCode || item.externalSkuCode}</p>
                          {item.skuCode && item.skuCode !== item.externalSkuCode && (
                            <p className="text-xs text-muted-foreground">
                              Ext: {item.externalSkuCode}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.externalSkuName}
                      </TableCell>
                      <TableCell className="text-right">{item.orderedQty}</TableCell>
                      <TableCell className="text-right">
                        <span className={item.receivedQty >= item.orderedQty ? "text-green-600" : ""}>
                          {item.receivedQty || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {remaining > 0 ? (
                          <span className="text-orange-600">{remaining}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.unitPrice
                          ? new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                            }).format(item.unitPrice)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.totalPrice
                          ? new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                            }).format(item.totalPrice)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Related GRNs */}
      {po.goodsReceipts && po.goodsReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-600" />
              <CardTitle>Goods Receipts</CardTitle>
            </div>
            <CardDescription>
              GRNs created against this purchase order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.goodsReceipts.map((gr) => (
                  <TableRow key={gr.id}>
                    <TableCell className="font-medium">{gr.grNo}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          gr.status === "POSTED"
                            ? "bg-green-500 text-white"
                            : gr.status === "RECEIVING"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-500 text-white"
                        }
                      >
                        {gr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{gr.totalQty}</TableCell>
                    <TableCell>
                      {format(new Date(gr.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {gr.postedAt
                        ? format(new Date(gr.postedAt), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/inbound/goods-receipt/${gr.id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Action for Open POs */}
      {po.status === "OPEN" && canManage && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-100">
                  <PackageCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Ready to Receive</h3>
                  <p className="text-sm text-muted-foreground">
                    This PO is open and ready to create a Goods Receipt
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push(`/inbound/goods-receipt/new?source=external-po&poId=${po.id}`)}
              >
                <PackageCheck className="mr-2 h-4 w-4" />
                Create GRN
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
