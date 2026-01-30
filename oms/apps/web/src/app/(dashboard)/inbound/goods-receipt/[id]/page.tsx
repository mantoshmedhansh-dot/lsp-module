"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  FileText,
  PlayCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Loader2,
  Edit,
  Truck,
  ShoppingCart,
  CornerDownLeft,
  ArrowRightLeft,
  PenLine,
  ExternalLink,
  PackageCheck,
  Warehouse,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

interface GoodsReceipt {
  id: string;
  grNo: string;
  inboundId: string | null;
  purchaseOrderId: string | null;
  asnNo: string | null;
  status: string;
  movementType: string;
  totalQty: number;
  totalValue: number;
  locationId: string;
  companyId: string;
  receivedById: string | null;
  postedById: string | null;
  receivedAt: string | null;
  postedAt: string | null;
  notes: string | null;
  itemCount: number;
  createdAt: string;
  items: GoodsReceiptItem[];
  // Source information
  sourceType?: string;
  externalPoId?: string | null;
  externalPoNumber?: string | null;
  asnId?: string | null;
  returnId?: string | null;
  stoId?: string | null;
  vendorId?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  gateEntryNo?: string | null;
}

interface GoodsReceiptItem {
  id: string;
  skuId: string;
  skuCode?: string;
  skuName?: string;
  expectedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  batchNo: string | null;
  lotNo: string | null;
  expiryDate: string | null;
  mfgDate: string | null;
  mrp: number | null;
  costPrice: number | null;
  targetBinId: string | null;
  qcStatus: string | null;
  fifoSequence: number | null;
}

interface Location {
  id: string;
  code: string;
  name: string;
}

interface SKU {
  id: string;
  code: string;
  name: string;
  mrp?: number;
  costPrice?: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-500", icon: FileText },
  RECEIVING: { label: "Receiving", color: "bg-blue-500", icon: PlayCircle },
  POSTED: { label: "Posted", color: "bg-green-500", icon: CheckCircle2 },
  REVERSED: { label: "Reversed", color: "bg-orange-500", icon: RotateCcw },
  CANCELLED: { label: "Cancelled", color: "bg-red-500", icon: XCircle },
};

const sourceTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  EXTERNAL_PO: { label: "External PO", icon: ShoppingCart, color: "text-blue-600" },
  ASN: { label: "ASN", icon: Truck, color: "text-purple-600" },
  RETURN: { label: "Sales Return", icon: CornerDownLeft, color: "text-orange-600" },
  STO: { label: "Stock Transfer", icon: ArrowRightLeft, color: "text-cyan-600" },
  MANUAL: { label: "Manual Entry", icon: PenLine, color: "text-gray-600" },
};

// Workflow Stepper Component
function WorkflowStepper({ status }: { status: string }) {
  const steps = [
    { key: "DRAFT", label: "Draft", icon: FileText },
    { key: "RECEIVING", label: "Receiving", icon: PlayCircle },
    { key: "POSTED", label: "Posted", icon: CheckCircle2 },
  ];

  const getStepStatus = (stepKey: string) => {
    if (status === "CANCELLED") return stepKey === "DRAFT" ? "cancelled" : "pending";
    if (status === "REVERSED") {
      if (stepKey === "DRAFT" || stepKey === "RECEIVING" || stepKey === "POSTED") return "reversed";
    }

    const currentIndex = steps.findIndex((s) => s.key === status);
    const stepIndex = steps.findIndex((s) => s.key === stepKey);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <div className="flex items-center justify-center py-4">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        const StepIcon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${stepStatus === "completed" ? "bg-green-500 border-green-500 text-white" : ""}
                  ${stepStatus === "current" ? "bg-blue-500 border-blue-500 text-white" : ""}
                  ${stepStatus === "pending" ? "bg-gray-100 border-gray-300 text-gray-400" : ""}
                  ${stepStatus === "cancelled" ? "bg-red-100 border-red-300 text-red-500" : ""}
                  ${stepStatus === "reversed" ? "bg-orange-100 border-orange-300 text-orange-500" : ""}
                `}
              >
                {stepStatus === "completed" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <StepIcon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium
                  ${stepStatus === "completed" ? "text-green-600" : ""}
                  ${stepStatus === "current" ? "text-blue-600" : ""}
                  ${stepStatus === "pending" ? "text-gray-400" : ""}
                  ${stepStatus === "cancelled" || stepStatus === "reversed" ? "text-gray-500" : ""}
                `}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`
                  w-16 h-0.5 mx-2 mt-[-20px]
                  ${getStepStatus(steps[index + 1].key) !== "pending" ? "bg-green-500" : "bg-gray-300"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GoodsReceiptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const grId = params.id as string;
  const { data: session } = useSession();

  const [gr, setGR] = useState<GoodsReceipt | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // SKU search for adding items
  const [skus, setSkus] = useState<SKU[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);

  // Dialogs
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    action: string;
    title: string;
    description: string;
  } | null>(null);

  // Item form
  const [itemForm, setItemForm] = useState({
    expectedQty: 0,
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    batchNo: "",
    lotNo: "",
    expiryDate: "",
    mfgDate: "",
    costPrice: 0,
    mrp: 0,
  });

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const canEdit = canManage && gr && ["DRAFT", "RECEIVING"].includes(gr.status);
  const canStartReceiving = canManage && gr?.status === "DRAFT";
  const canPost = canManage && gr && ["DRAFT", "RECEIVING"].includes(gr.status);
  const canReverse = canManage && gr?.status === "POSTED";
  const canCancel = canManage && gr && ["DRAFT", "RECEIVING"].includes(gr.status);

  useEffect(() => {
    fetchGoodsReceipt();
  }, [grId]);

  useEffect(() => {
    if (skuSearch.length >= 2) {
      searchSkus(skuSearch);
    }
  }, [skuSearch]);

  async function fetchGoodsReceipt() {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/goods-receipts/${grId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Goods receipt not found");
          router.push("/inbound/goods-receipt");
          return;
        }
        throw new Error("Failed to fetch goods receipt");
      }
      const data = await response.json();
      setGR(data);

      // Fetch location
      const locResponse = await fetch(`/api/v1/locations/${data.locationId}`);
      if (locResponse.ok) {
        setLocation(await locResponse.json());
      }
    } catch (error) {
      console.error("Error fetching goods receipt:", error);
      toast.error("Failed to load goods receipt");
    } finally {
      setIsLoading(false);
    }
  }

  async function searchSkus(query: string) {
    try {
      setIsSearching(true);
      const response = await fetch(`/api/v1/skus?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        setSkus(await response.json());
      }
    } catch (error) {
      console.error("Error searching SKUs:", error);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddItem() {
    if (!selectedSku) {
      toast.error("Please select a SKU");
      return;
    }

    if (itemForm.receivedQty <= 0) {
      toast.error("Received quantity must be greater than 0");
      return;
    }

    try {
      setActionLoading("add-item");
      const response = await fetch(`/api/v1/goods-receipts/${grId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goodsReceiptId: grId,
          skuId: selectedSku.id,
          expectedQty: itemForm.expectedQty,
          receivedQty: itemForm.receivedQty,
          acceptedQty: itemForm.acceptedQty || itemForm.receivedQty,
          rejectedQty: itemForm.rejectedQty,
          batchNo: itemForm.batchNo || null,
          lotNo: itemForm.lotNo || null,
          expiryDate: itemForm.expiryDate || null,
          mfgDate: itemForm.mfgDate || null,
          costPrice: itemForm.costPrice || null,
          mrp: itemForm.mrp || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.msg || error.message || JSON.stringify(error.detail) || "Failed to add item");
        throw new Error(errorMessage);
      }

      toast.success("Item added successfully");
      setShowAddItemDialog(false);
      resetItemForm();
      fetchGoodsReceipt();
    } catch (error) {
      console.error("Error adding item:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : "Failed to add item");
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  }

  function resetItemForm() {
    setSelectedSku(null);
    setSkuSearch("");
    setSkus([]);
    setItemForm({
      expectedQty: 0,
      receivedQty: 0,
      acceptedQty: 0,
      rejectedQty: 0,
      batchNo: "",
      lotNo: "",
      expiryDate: "",
      mfgDate: "",
      costPrice: 0,
      mrp: 0,
    });
  }

  async function handleAction(action: string) {
    try {
      setActionLoading(action);
      const response = await fetch(`/api/v1/goods-receipts/${grId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = typeof error.detail === 'string'
          ? error.detail
          : (error.detail?.msg || error.message || JSON.stringify(error.detail) || `Failed to ${action} goods receipt`);
        throw new Error(errorMessage);
      }

      const actionLabels: Record<string, string> = {
        receive: "Receiving started",
        post: "Goods receipt posted",
        reverse: "Goods receipt reversed",
        cancel: "Goods receipt cancelled",
      };

      toast.success(actionLabels[action] || "Action completed");
      setShowConfirmDialog(null);
      fetchGoodsReceipt();
    } catch (error) {
      console.error(`Error ${action} goods receipt:`, error);
      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : `Failed to ${action}`);
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gr) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Goods receipt not found</p>
        <Button
          variant="link"
          onClick={() => router.push("/inbound/goods-receipt")}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const StatusIcon = statusConfig[gr.status]?.icon || FileText;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/inbound/goods-receipt")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{gr.grNo}</h1>
              <Badge
                className={`${statusConfig[gr.status]?.color || "bg-gray-500"} text-white`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[gr.status]?.label || gr.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created {formatDistanceToNow(new Date(gr.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canStartReceiving && (
            <Button
              onClick={() =>
                setShowConfirmDialog({
                  action: "receive",
                  title: "Start Receiving",
                  description:
                    "This will change the status to RECEIVING. You can continue adding or updating items.",
                })
              }
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Receiving
            </Button>
          )}
          {canPost && (
            <Button
              variant="default"
              onClick={() =>
                setShowConfirmDialog({
                  action: "post",
                  title: "Post Goods Receipt",
                  description:
                    "This will create inventory records and assign FIFO sequences. This action cannot be easily undone.",
                })
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Post
            </Button>
          )}
          {canReverse && (
            <Button
              variant="outline"
              onClick={() =>
                setShowConfirmDialog({
                  action: "reverse",
                  title: "Reverse Goods Receipt",
                  description:
                    "This will remove the inventory created by this goods receipt. Make sure there are no reservations against this inventory.",
                })
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reverse
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() =>
                setShowConfirmDialog({
                  action: "cancel",
                  title: "Cancel Goods Receipt",
                  description:
                    "This will cancel the goods receipt. This action cannot be undone.",
                })
              }
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Stepper */}
      <Card>
        <CardContent className="pt-6">
          <WorkflowStepper status={gr.status} />
          {gr.status === "CANCELLED" && (
            <div className="flex items-center justify-center mt-2">
              <Badge variant="destructive" className="text-sm">
                <XCircle className="h-3 w-3 mr-1" />
                This goods receipt has been cancelled
              </Badge>
            </div>
          )}
          {gr.status === "REVERSED" && (
            <div className="flex items-center justify-center mt-2">
              <Badge variant="outline" className="text-sm border-orange-500 text-orange-600">
                <RotateCcw className="h-3 w-3 mr-1" />
                This goods receipt has been reversed
              </Badge>
            </div>
          )}
          {gr.status === "POSTED" && (
            <div className="flex items-center justify-center mt-2">
              <Badge variant="outline" className="text-sm border-green-500 text-green-600">
                <PackageCheck className="h-3 w-3 mr-1" />
                Inventory created successfully
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Information */}
      {(gr.sourceType || gr.externalPoId || gr.asnId || gr.vendorName) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {(() => {
                const sourceConfig = sourceTypeConfig[gr.sourceType || "MANUAL"];
                const SourceIcon = sourceConfig?.icon || PenLine;
                return (
                  <>
                    <SourceIcon className={`h-5 w-5 ${sourceConfig?.color || "text-gray-500"}`} />
                    <CardTitle className="text-base">Source: {sourceConfig?.label || "Manual Entry"}</CardTitle>
                  </>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Source Document Reference */}
              {gr.externalPoNumber && (
                <div>
                  <Label className="text-muted-foreground text-xs">External PO</Label>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">{gr.externalPoNumber}</p>
                    {gr.externalPoId && (
                      <Link href={`/inbound/external-po/${gr.externalPoId}`}>
                        <ExternalLink className="h-3 w-3 text-blue-500 hover:text-blue-700" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {gr.asnNo && (
                <div>
                  <Label className="text-muted-foreground text-xs">ASN Number</Label>
                  <div className="flex items-center gap-1">
                    <p className="font-medium">{gr.asnNo}</p>
                    {gr.asnId && (
                      <Link href={`/inbound/asn/${gr.asnId}`}>
                        <ExternalLink className="h-3 w-3 text-blue-500 hover:text-blue-700" />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Vendor Info */}
              {gr.vendorName && (
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor</Label>
                  <p className="font-medium">{gr.vendorName}</p>
                  {gr.vendorCode && (
                    <p className="text-xs text-muted-foreground">{gr.vendorCode}</p>
                  )}
                </div>
              )}

              {/* Receiving Details */}
              {gr.vehicleNumber && (
                <div>
                  <Label className="text-muted-foreground text-xs">Vehicle</Label>
                  <p className="font-medium">{gr.vehicleNumber}</p>
                </div>
              )}
              {gr.driverName && (
                <div>
                  <Label className="text-muted-foreground text-xs">Driver</Label>
                  <p className="font-medium">{gr.driverName}</p>
                </div>
              )}
              {gr.gateEntryNo && (
                <div>
                  <Label className="text-muted-foreground text-xs">Gate Entry</Label>
                  <p className="font-medium">{gr.gateEntryNo}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Receipt Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">
                  {location?.name || "Unknown"} ({location?.code || "-"})
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Movement Type</Label>
                <p className="font-medium">
                  {gr.movementType === "101"
                    ? "101 - Goods Receipt"
                    : gr.movementType === "102"
                    ? "102 - GR Reversal"
                    : gr.movementType}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <p className="font-medium">
                  {format(new Date(gr.createdAt), "PPp")}
                </p>
              </div>
              {gr.receivedAt && (
                <div>
                  <Label className="text-muted-foreground">Receiving Started</Label>
                  <p className="font-medium">
                    {format(new Date(gr.receivedAt), "PPp")}
                  </p>
                </div>
              )}
              {gr.postedAt && (
                <div>
                  <Label className="text-muted-foreground">Posted At</Label>
                  <p className="font-medium">
                    {format(new Date(gr.postedAt), "PPp")}
                  </p>
                </div>
              )}
            </div>
            {gr.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{gr.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Items</span>
              <span className="font-medium">{gr.itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Quantity</span>
              <span className="font-medium">{gr.totalQty.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Value</span>
              <span className="font-medium">
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                }).format(gr.totalValue)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Items</CardTitle>
            <CardDescription>{gr.items?.length || 0} items in this receipt</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => setShowAddItemDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {(!gr.items || gr.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No items in this goods receipt</p>
              {canEdit && (
                <Button variant="link" onClick={() => setShowAddItemDialog(true)}>
                  Add your first item
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch/Lot</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  {gr.status === "POSTED" && <TableHead>FIFO Seq</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gr.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.skuCode || item.skuId}</p>
                        {item.skuName && (
                          <p className="text-xs text-muted-foreground">
                            {item.skuName}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.batchNo && <p>Batch: {item.batchNo}</p>}
                      {item.lotNo && <p>Lot: {item.lotNo}</p>}
                      {!item.batchNo && !item.lotNo && "-"}
                    </TableCell>
                    <TableCell>
                      {item.expiryDate
                        ? format(new Date(item.expiryDate), "PP")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{item.expectedQty}</TableCell>
                    <TableCell className="text-right">{item.receivedQty}</TableCell>
                    <TableCell className="text-right">{item.acceptedQty}</TableCell>
                    <TableCell className="text-right">
                      {item.rejectedQty > 0 ? (
                        <span className="text-red-500">{item.rejectedQty}</span>
                      ) : (
                        item.rejectedQty
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.costPrice
                        ? new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                          }).format(item.costPrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                      }).format((item.costPrice || 0) * item.acceptedQty)}
                    </TableCell>
                    {gr.status === "POSTED" && (
                      <TableCell>
                        {item.fifoSequence ? (
                          <Badge variant="outline">#{item.fifoSequence}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inventory Created - Show for POSTED GRNs */}
      {gr.status === "POSTED" && gr.items && gr.items.length > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base text-green-800">Inventory Created</CardTitle>
            </div>
            <CardDescription>
              The following inventory records were created when this GRN was posted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch/Lot</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>FIFO Sequence</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gr.items.filter(item => item.acceptedQty > 0).map((item) => (
                  <TableRow key={`inv-${item.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.skuCode || item.skuId}</p>
                        {item.skuName && (
                          <p className="text-xs text-muted-foreground">{item.skuName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.batchNo && <span>Batch: {item.batchNo}</span>}
                        {item.batchNo && item.lotNo && <span> / </span>}
                        {item.lotNo && <span>Lot: {item.lotNo}</span>}
                        {!item.batchNo && !item.lotNo && <span className="text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.acceptedQty.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {item.fifoSequence ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          #{item.fifoSequence}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.costPrice
                        ? new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                          }).format(item.costPrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                      }).format((item.costPrice || 0) * item.acceptedQty)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-between items-center pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">
                  Total inventory created: {gr.items.filter(i => i.acceptedQty > 0).length} SKUs,{" "}
                  {gr.items.reduce((sum, i) => sum + i.acceptedQty, 0).toLocaleString()} units
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/inventory">
                  <Warehouse className="mr-2 h-4 w-4" />
                  View Inventory
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Search and select a SKU to add to this goods receipt
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* SKU Search */}
            <div className="space-y-2">
              <Label>Search SKU</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by SKU code or name..."
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {isSearching && (
                <p className="text-sm text-muted-foreground">Searching...</p>
              )}
              {skus.length > 0 && !selectedSku && (
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {skus.map((sku) => (
                    <div
                      key={sku.id}
                      className="p-2 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setSelectedSku(sku);
                        setItemForm({
                          ...itemForm,
                          mrp: sku.mrp || 0,
                          costPrice: sku.costPrice || 0,
                        });
                      }}
                    >
                      <p className="font-medium">{sku.code}</p>
                      <p className="text-sm text-muted-foreground">{sku.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedSku && (
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{selectedSku.code}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSku.name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSku(null)}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantities */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Expected Qty</Label>
                <Input
                  type="number"
                  value={itemForm.expectedQty || ""}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, expectedQty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Received Qty *</Label>
                <Input
                  type="number"
                  value={itemForm.receivedQty || ""}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value) || 0;
                    setItemForm({
                      ...itemForm,
                      receivedQty: qty,
                      acceptedQty: qty,
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Accepted Qty</Label>
                <Input
                  type="number"
                  value={itemForm.acceptedQty || ""}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, acceptedQty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Rejected Qty</Label>
                <Input
                  type="number"
                  value={itemForm.rejectedQty || ""}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, rejectedQty: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Batch/Lot */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Batch No</Label>
                <Input
                  value={itemForm.batchNo}
                  onChange={(e) => setItemForm({ ...itemForm, batchNo: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Lot No</Label>
                <Input
                  value={itemForm.lotNo}
                  onChange={(e) => setItemForm({ ...itemForm, lotNo: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Manufacturing Date</Label>
                <Input
                  type="date"
                  value={itemForm.mfgDate}
                  onChange={(e) => setItemForm({ ...itemForm, mfgDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={itemForm.expiryDate}
                  onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cost Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.costPrice || ""}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, costPrice: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>MRP</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.mrp || ""}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, mrp: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedSku || actionLoading === "add-item"}
            >
              {actionLoading === "add-item" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!showConfirmDialog}
        onOpenChange={() => setShowConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{showConfirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {showConfirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(showConfirmDialog?.action || "")}
              disabled={!!actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
