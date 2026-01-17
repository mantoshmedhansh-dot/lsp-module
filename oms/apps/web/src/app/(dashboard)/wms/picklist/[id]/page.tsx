"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Package,
  Clock,
  ScanLine,
  MapPin,
  User,
  ShoppingCart,
  Minus,
  Plus,
  RotateCcw,
  Check,
  AlertTriangle,
  Barcode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PicklistItem {
  id: string;
  requiredQty: number;
  pickedQty: number;
  pickedAt: string | null;
  serialNumbers: string[];
  batchNo: string | null;
  sku: {
    id: string;
    code: string;
    name: string;
    barcodes: string[];
    weight: number | null;
    isSerialised?: boolean;
  };
  bin: {
    id: string;
    code: string;
    zone: {
      id: string;
      code: string;
      name: string;
    };
  };
}

interface Picklist {
  id: string;
  picklistNo: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    customerPhone: string;
    shippingAddress: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
    location: {
      id: string;
      code: string;
      name: string;
    };
    items: Array<{
      id: string;
      quantity: number;
      sku: {
        code: string;
        name: string;
      };
    }>;
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: PicklistItem[];
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  ASSIGNED: { label: "Assigned", variant: "secondary", icon: User },
  IN_PROGRESS: { label: "In Progress", variant: "secondary", icon: ScanLine },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

export default function PicklistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const picklistId = params.id as string;

  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [pickQuantity, setPickQuantity] = useState(1);
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [currentSerial, setCurrentSerial] = useState("");
  const [selectedItem, setSelectedItem] = useState<PicklistItem | null>(null);
  const [showPickDialog, setShowPickDialog] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const fetchPicklist = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/v1/picklists/${picklistId}`);
      if (!response.ok) throw new Error("Failed to fetch picklist");
      const result = await response.json();
      setPicklist(result);
    } catch (error) {
      console.error("Error fetching picklist:", error);
      toast.error("Failed to load picklist");
    } finally {
      setIsLoading(false);
    }
  }, [picklistId]);

  useEffect(() => {
    fetchPicklist();
  }, [fetchPicklist]);

  // Focus on scan input when in IN_PROGRESS status
  useEffect(() => {
    if (picklist?.status === "IN_PROGRESS" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [picklist?.status]);

  async function handleStartPicking() {
    try {
      const response = await fetch(`/api/v1/v1/picklists/${picklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      if (response.ok) {
        toast.success("Picking started");
        fetchPicklist();
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to start picking");
      }
    } catch (error) {
      console.error("Error starting picking:", error);
      toast.error("Failed to start picking");
    }
  }

  async function handleCompletePicking() {
    try {
      const response = await fetch(`/api/v1/v1/picklists/${picklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });

      if (response.ok) {
        toast.success("Picklist completed");
        fetchPicklist();
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to complete picklist");
      }
    } catch (error) {
      console.error("Error completing picklist:", error);
      toast.error("Failed to complete picking");
    }
  }

  async function handleScan(barcode: string) {
    if (!barcode.trim()) return;

    setIsScanning(true);
    try {
      const response = await fetch(`/api/v1/v1/picklists/${picklistId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scannedBarcode: barcode,
          quantity: 1,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setLastScanResult({
          success: true,
          message: result.message,
        });
        toast.success(result.message);
        fetchPicklist();
      } else {
        setLastScanResult({
          success: false,
          message: result.error,
        });
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error scanning item:", error);
      setLastScanResult({
        success: false,
        message: "Failed to process scan",
      });
      toast.error("Failed to process scan");
    } finally {
      setScanInput("");
      setIsScanning(false);
      scanInputRef.current?.focus();
    }
  }

  async function handleManualPick() {
    if (!selectedItem) return;

    try {
      const response = await fetch(`/api/v1/v1/picklists/${picklistId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          quantity: pickQuantity,
          serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setShowPickDialog(false);
        setSelectedItem(null);
        setPickQuantity(1);
        setSerialNumbers([]);
        fetchPicklist();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error picking item:", error);
      toast.error("Failed to pick item");
    }
  }

  async function handleUndoPick(itemId: string, quantity: number = 1) {
    try {
      const response = await fetch(
        `/api/v1/picklists/${picklistId}/pick?itemId=${itemId}&quantity=${quantity}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        fetchPicklist();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Error undoing pick:", error);
      toast.error("Failed to undo pick");
    }
  }

  function openPickDialog(item: PicklistItem) {
    setSelectedItem(item);
    setPickQuantity(Math.min(1, item.requiredQty - item.pickedQty));
    setSerialNumbers([]);
    setShowPickDialog(true);
  }

  function addSerial() {
    if (currentSerial && !serialNumbers.includes(currentSerial)) {
      setSerialNumbers([...serialNumbers, currentSerial]);
      setCurrentSerial("");
    }
  }

  function removeSerial(serial: string) {
    setSerialNumbers(serialNumbers.filter((s) => s !== serial));
  }

  function getPickProgress() {
    if (!picklist) return 0;
    const totalRequired = picklist.items.reduce((sum, item) => sum + item.requiredQty, 0);
    const totalPicked = picklist.items.reduce((sum, item) => sum + item.pickedQty, 0);
    return totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0;
  }

  function isAllPicked() {
    if (!picklist) return false;
    return picklist.items.every((item) => item.pickedQty >= item.requiredQty);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-muted-foreground">Loading picklist...</div>
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Picklist not found</p>
        <Button variant="link" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[picklist.status] || {
    label: picklist.status,
    variant: "outline" as const,
    icon: Clock,
  };
  const progress = getPickProgress();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {picklist.picklistNo}
              </h1>
              <Badge variant={statusInfo.variant}>
                <statusInfo.icon className="mr-1 h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Order: {picklist.order.orderNo}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {picklist.status === "PENDING" && (
            <Button onClick={handleStartPicking}>
              <Play className="mr-2 h-4 w-4" />
              Start Picking
            </Button>
          )}
          {picklist.status === "IN_PROGRESS" && isAllPicked() && (
            <Button onClick={handleCompletePicking}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Picking
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Picking Progress</span>
                <span className="text-sm text-muted-foreground">
                  {picklist.items.reduce((s, i) => s + i.pickedQty, 0)} /{" "}
                  {picklist.items.reduce((s, i) => s + i.requiredQty, 0)} units
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            <div className="text-2xl font-bold">{progress}%</div>
          </div>
        </CardContent>
      </Card>

      {/* Scanning Interface - Only show when IN_PROGRESS */}
      {picklist.status === "IN_PROGRESS" && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Scan Item
            </CardTitle>
            <CardDescription>
              Scan the barcode of the item you are picking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={scanInputRef}
                  placeholder="Scan or enter barcode..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleScan(scanInput);
                    }
                  }}
                  className="pl-10 text-lg h-12"
                  disabled={isScanning}
                  autoFocus
                />
              </div>
              <Button
                size="lg"
                onClick={() => handleScan(scanInput)}
                disabled={isScanning || !scanInput}
              >
                {isScanning ? "Processing..." : "Pick"}
              </Button>
            </div>

            {/* Last Scan Result */}
            {lastScanResult && (
              <Alert
                variant={lastScanResult.success ? "default" : "destructive"}
                className="mt-4"
              >
                {lastScanResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{lastScanResult.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Picklist Items */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items to Pick</CardTitle>
              <CardDescription>
                Pick items from the specified bin locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                    <TableHead className="text-center">Picked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {picklist.items.map((item) => {
                    const isPicked = item.pickedQty >= item.requiredQty;
                    const remaining = item.requiredQty - item.pickedQty;

                    return (
                      <TableRow
                        key={item.id}
                        className={isPicked ? "bg-green-50 dark:bg-green-950/20" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.sku.code}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.sku.name}
                            </p>
                            {item.sku.barcodes.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Barcode: {item.sku.barcodes[0]}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{item.bin.code}</p>
                              <p className="text-xs text-muted-foreground">
                                Zone: {item.bin.zone.code}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-lg font-bold">
                          {item.requiredQty}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`text-lg font-bold ${
                              isPicked ? "text-green-600" : item.pickedQty > 0 ? "text-yellow-600" : ""
                            }`}
                          >
                            {item.pickedQty}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isPicked ? (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="mr-1 h-3 w-3" />
                              Complete
                            </Badge>
                          ) : item.pickedQty > 0 ? (
                            <Badge variant="secondary">
                              {remaining} remaining
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {picklist.status === "IN_PROGRESS" && (
                            <div className="flex justify-end gap-2">
                              {!isPicked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPickDialog(item)}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Pick
                                </Button>
                              )}
                              {item.pickedQty > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndoPick(item.id)}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Undo
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Order & Picklist Info */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Order No</Label>
                <p className="font-medium">{picklist.order.orderNo}</p>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Customer</Label>
                <p className="font-medium">{picklist.order.customerName}</p>
                <p className="text-sm text-muted-foreground">
                  {picklist.order.customerPhone}
                </p>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Shipping Address</Label>
                <p className="text-sm">
                  {picklist.order.shippingAddress.line1}
                  {picklist.order.shippingAddress.line2 && (
                    <>, {picklist.order.shippingAddress.line2}</>
                  )}
                  <br />
                  {picklist.order.shippingAddress.city},{" "}
                  {picklist.order.shippingAddress.state}{" "}
                  {picklist.order.shippingAddress.pincode}
                </p>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">
                  {picklist.order.location.name} ({picklist.order.location.code})
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Picklist Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Picklist Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Assigned To</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">
                    {picklist.assignedTo?.name || "Unassigned"}
                  </p>
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="text-sm">
                  {format(new Date(picklist.createdAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              {picklist.startedAt && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Started</Label>
                    <p className="text-sm">
                      {format(new Date(picklist.startedAt), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </>
              )}
              {picklist.completedAt && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Completed</Label>
                    <p className="text-sm">
                      {format(new Date(picklist.completedAt), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manual Pick Dialog */}
      <Dialog open={showPickDialog} onOpenChange={setShowPickDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick Item</DialogTitle>
            <DialogDescription>
              Manually pick {selectedItem?.sku.code}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label>SKU</Label>
                <p className="font-medium">{selectedItem.sku.code}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.sku.name}
                </p>
              </div>
              <div>
                <Label>Location</Label>
                <p className="font-medium">
                  {selectedItem.bin.code} ({selectedItem.bin.zone.code})
                </p>
              </div>
              <div>
                <Label>Required: {selectedItem.requiredQty}</Label>
                <p className="text-sm text-muted-foreground">
                  Already picked: {selectedItem.pickedQty}
                </p>
              </div>
              <Separator />
              <div>
                <Label>Quantity to Pick</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPickQuantity(Math.max(1, pickQuantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={pickQuantity}
                    onChange={(e) =>
                      setPickQuantity(
                        Math.min(
                          selectedItem.requiredQty - selectedItem.pickedQty,
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      )
                    }
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setPickQuantity(
                        Math.min(
                          selectedItem.requiredQty - selectedItem.pickedQty,
                          pickQuantity + 1
                        )
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Serial Numbers for serialized items */}
              {selectedItem.sku.isSerialised && (
                <div>
                  <Label>Serial Numbers (Required: {pickQuantity})</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter serial number"
                      value={currentSerial}
                      onChange={(e) => setCurrentSerial(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSerial();
                        }
                      }}
                    />
                    <Button variant="outline" onClick={addSerial}>
                      Add
                    </Button>
                  </div>
                  {serialNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {serialNumbers.map((serial) => (
                        <Badge
                          key={serial}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeSerial(serial)}
                        >
                          {serial} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPickDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleManualPick}
              disabled={
                selectedItem?.sku.isSerialised &&
                serialNumbers.length !== pickQuantity
              }
            >
              <Check className="mr-2 h-4 w-4" />
              Confirm Pick
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
