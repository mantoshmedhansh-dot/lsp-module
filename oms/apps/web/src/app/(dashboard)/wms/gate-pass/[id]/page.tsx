"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Users,
  Truck,
  Package,
  MapPin,
  Phone,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  LogIn,
  LogOut,
  FileCheck,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface GatePassItem {
  id: string;
  skuId?: string;
  description?: string;
  quantity: number;
  unit?: string;
  remarks?: string;
  sku?: {
    code: string;
    name: string;
  };
}

interface GatePass {
  id: string;
  gatePassNo: string;
  type: string;
  status: string;
  locationId: string;
  visitorName?: string;
  visitorPhone?: string;
  visitorIdType?: string;
  visitorIdNo?: string;
  companyName?: string;
  purpose?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  sealNumber?: string;
  awbNo?: string;
  poNo?: string;
  invoiceNo?: string;
  entryTime: string;
  exitTime?: string;
  remarks?: string;
  securityRemarks?: string;
  verifiedById?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  items: GatePassItem[];
  location?: {
    id: string;
    name: string;
    code: string;
  };
  verifiedBy?: {
    id: string;
    name: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  OPEN: { label: "Open", color: "bg-gray-100 text-gray-800", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: LogIn },
  CLOSED: { label: "Closed", color: "bg-purple-100 text-purple-800", icon: LogOut },
  VERIFIED: { label: "Verified", color: "bg-green-100 text-green-800", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  VISITOR: { label: "Visitor", icon: Users },
  DELIVERY_IN: { label: "Delivery In", icon: Package },
  DELIVERY_OUT: { label: "Delivery Out", icon: Package },
  MATERIAL_IN: { label: "Material In", icon: Package },
  MATERIAL_OUT: { label: "Material Out", icon: Package },
  VEHICLE: { label: "Vehicle", icon: Truck },
};

export default function GatePassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const gatePassId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRemarks, setCancelRemarks] = useState("");

  // Fetch gate pass details
  const { data: gatePass, isLoading, error } = useQuery<GatePass>({
    queryKey: ["gate-pass", gatePassId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/gate-passes/${gatePassId}`);
      if (!res.ok) throw new Error("Failed to fetch gate pass");
      return res.json();
    },
  });

  // Action mutation
  const actionMutation = useMutation({
    mutationFn: async ({ action, remarks }: { action: string; remarks?: string }) => {
      const res = await fetch(`/api/v1/gate-passes/${gatePassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remarks }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update gate pass");
      }
      return res.json();
    },
    onSuccess: (_, { action }) => {
      const actionLabels: Record<string, string> = {
        start: "started",
        close: "closed",
        verify: "verified",
        cancel: "cancelled",
      };
      toast({
        title: "Success",
        description: `Gate pass ${actionLabels[action] || action}`,
      });
      queryClient.invalidateQueries({ queryKey: ["gate-pass", gatePassId] });
      setShowCancelDialog(false);
      setCancelRemarks("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/gate-passes/${gatePassId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete gate pass");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Gate pass deleted",
      });
      router.push("/wms/gate-pass");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-muted-foreground">Loading gate pass...</div>
      </div>
    );
  }

  if (error || !gatePass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Gate pass not found</p>
        <Button variant="link" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[gatePass.status] || statusConfig.OPEN;
  const typeInfo = typeConfig[gatePass.type] || typeConfig.VISITOR;
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusInfo.icon;

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
              <h1 className="text-2xl font-bold tracking-tight">
                {gatePass.gatePassNo}
              </h1>
              <Badge className={statusInfo.color}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <TypeIcon className="h-4 w-4" />
              <span>{typeInfo.label}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {gatePass.status === "OPEN" && (
            <Button onClick={() => actionMutation.mutate({ action: "start" })}>
              <LogIn className="mr-2 h-4 w-4" />
              Start / Check In
            </Button>
          )}
          {gatePass.status === "IN_PROGRESS" && (
            <Button onClick={() => actionMutation.mutate({ action: "close" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Close / Check Out
            </Button>
          )}
          {gatePass.status === "CLOSED" && (
            <Button onClick={() => actionMutation.mutate({ action: "verify" })}>
              <FileCheck className="mr-2 h-4 w-4" />
              Verify
            </Button>
          )}
          {!["VERIFIED", "CLOSED"].includes(gatePass.status) && (
            <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Visitor/Driver Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {gatePass.type === "VEHICLE" ? (
                  <>
                    <Truck className="h-5 w-5" />
                    Vehicle & Driver Information
                  </>
                ) : (
                  <>
                    <Users className="h-5 w-5" />
                    Visitor Information
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {gatePass.visitorName && (
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{gatePass.visitorName}</p>
                  </div>
                )}
                {gatePass.driverName && (
                  <div>
                    <Label className="text-muted-foreground">Driver Name</Label>
                    <p className="font-medium">{gatePass.driverName}</p>
                  </div>
                )}
                {(gatePass.visitorPhone || gatePass.driverPhone) && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {gatePass.visitorPhone || gatePass.driverPhone}
                    </p>
                  </div>
                )}
                {gatePass.companyName && (
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {gatePass.companyName}
                    </p>
                  </div>
                )}
                {gatePass.visitorIdType && (
                  <div>
                    <Label className="text-muted-foreground">ID Type</Label>
                    <p className="font-medium">{gatePass.visitorIdType}</p>
                  </div>
                )}
                {gatePass.visitorIdNo && (
                  <div>
                    <Label className="text-muted-foreground">ID Number</Label>
                    <p className="font-medium">{gatePass.visitorIdNo}</p>
                  </div>
                )}
                {gatePass.vehicleNumber && (
                  <div>
                    <Label className="text-muted-foreground">Vehicle Number</Label>
                    <p className="font-medium">{gatePass.vehicleNumber}</p>
                  </div>
                )}
                {gatePass.vehicleType && (
                  <div>
                    <Label className="text-muted-foreground">Vehicle Type</Label>
                    <p className="font-medium">{gatePass.vehicleType}</p>
                  </div>
                )}
                {gatePass.sealNumber && (
                  <div>
                    <Label className="text-muted-foreground">Seal Number</Label>
                    <p className="font-medium">{gatePass.sealNumber}</p>
                  </div>
                )}
              </div>
              {gatePass.purpose && (
                <div className="mt-4">
                  <Label className="text-muted-foreground">Purpose</Label>
                  <p className="mt-1">{gatePass.purpose}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Info */}
          {(gatePass.awbNo || gatePass.poNo || gatePass.invoiceNo) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {gatePass.awbNo && (
                    <div>
                      <Label className="text-muted-foreground">AWB / Tracking No</Label>
                      <p className="font-medium">{gatePass.awbNo}</p>
                    </div>
                  )}
                  {gatePass.poNo && (
                    <div>
                      <Label className="text-muted-foreground">PO Number</Label>
                      <p className="font-medium">{gatePass.poNo}</p>
                    </div>
                  )}
                  {gatePass.invoiceNo && (
                    <div>
                      <Label className="text-muted-foreground">Invoice Number</Label>
                      <p className="font-medium">{gatePass.invoiceNo}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          {gatePass.items && gatePass.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>
                  {gatePass.items.length} items in this gate pass
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gatePass.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.sku ? (
                            <div>
                              <p className="font-medium">{item.sku.code}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.sku.name}
                              </p>
                            </div>
                          ) : (
                            <p>{item.description || "-"}</p>
                          )}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit || "-"}</TableCell>
                        <TableCell>{item.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Remarks */}
          {(gatePass.remarks || gatePass.securityRemarks) && (
            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {gatePass.remarks && (
                  <div>
                    <Label className="text-muted-foreground">General Remarks</Label>
                    <p className="mt-1">{gatePass.remarks}</p>
                  </div>
                )}
                {gatePass.securityRemarks && (
                  <div>
                    <Label className="text-muted-foreground">Security Remarks</Label>
                    <p className="mt-1">{gatePass.securityRemarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Time Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="font-medium">
                  {format(new Date(gatePass.createdAt), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              <Separator />
              <div>
                <Label className="text-muted-foreground">Entry Time</Label>
                <p className="font-medium">
                  {format(new Date(gatePass.entryTime), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
              {gatePass.exitTime && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Exit Time</Label>
                    <p className="font-medium">
                      {format(new Date(gatePass.exitTime), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </>
              )}
              {gatePass.verifiedAt && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Verified At</Label>
                    <p className="font-medium">
                      {format(new Date(gatePass.verifiedAt), "dd MMM yyyy, HH:mm")}
                    </p>
                    {gatePass.verifiedBy && (
                      <p className="text-sm text-muted-foreground">
                        by {gatePass.verifiedBy.name}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Location Info */}
          {gatePass.location && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{gatePass.location.name}</p>
                <p className="text-sm text-muted-foreground">
                  {gatePass.location.code}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          {!["VERIFIED", "IN_PROGRESS"].includes(gatePass.status) && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this gate pass?")) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Gate Pass
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Gate Pass</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this gate pass? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Cancellation Remarks</Label>
            <Textarea
              value={cancelRemarks}
              onChange={(e) => setCancelRemarks(e.target.value)}
              placeholder="Enter reason for cancellation..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Gate Pass
            </Button>
            <Button
              variant="destructive"
              onClick={() => actionMutation.mutate({ action: "cancel", remarks: cancelRemarks })}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? "Cancelling..." : "Cancel Gate Pass"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
