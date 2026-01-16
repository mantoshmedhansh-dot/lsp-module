"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  User,
  MapPin,
  Layers,
  Zap,
  RefreshCw,
  Printer,
  MoreHorizontal,
  ScanLine,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface WaveItem {
  id: string;
  orderId: string;
  orderNo: string;
  sku: {
    id: string;
    code: string;
    name: string;
  };
  quantity: number;
  pickedQty: number;
  binLocation: string | null;
  status: string;
}

interface WaveOrder {
  id: string;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
  };
  status: string;
  pickedAt: string | null;
}

interface Wave {
  id: string;
  waveNo: string;
  name: string;
  status: string;
  waveType: string;
  priority: number;
  createdAt: string;
  releasedAt: string | null;
  completedAt: string | null;
  location: {
    id: string;
    code: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  waveOrders: WaveOrder[];
  waveItems: WaveItem[];
  _count: {
    waveOrders: number;
    waveItems: number;
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; color: string }> = {
  DRAFT: { label: "Draft", variant: "outline", icon: Clock, color: "text-gray-500" },
  PLANNED: { label: "Planned", variant: "secondary", icon: Layers, color: "text-blue-500" },
  RELEASED: { label: "Released", variant: "secondary", icon: Play, color: "text-yellow-500" },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Zap, color: "text-orange-500" },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle, color: "text-green-500" },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle, color: "text-red-500" },
};

const waveTypeLabels: Record<string, string> = {
  BATCH_PICK: "Batch Pick",
  ZONE_PICK: "Zone Pick",
  CLUSTER_PICK: "Cluster Pick",
  PRIORITY_PICK: "Priority Pick",
};

export default function WaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const waveId = params.id as string;

  const [wave, setWave] = useState<Wave | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const fetchWave = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/waves/${waveId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Wave not found");
          router.push("/wms/waves");
          return;
        }
        throw new Error("Failed to fetch wave");
      }
      const data = await response.json();
      setWave(data);
    } catch (error) {
      console.error("Error fetching wave:", error);
      toast.error("Failed to load wave details");
    } finally {
      setIsLoading(false);
    }
  }, [waveId, router]);

  useEffect(() => {
    fetchWave();
  }, [fetchWave]);

  async function handleAction(action: string) {
    try {
      const response = await fetch(`/api/v1/waves/${waveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} wave`);
      }

      toast.success(`Wave ${action}ed successfully`);
      fetchWave();
    } catch (error) {
      console.error(`Error ${action}ing wave:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} wave`);
    }
  }

  async function handlePickItem(itemId: string, pickedQty: number) {
    try {
      const response = await fetch(`/api/v1/waves/${waveId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, pickedQty }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to pick item");
      }

      toast.success("Item picked successfully");
      fetchWave();
    } catch (error) {
      console.error("Error picking item:", error);
      toast.error(error instanceof Error ? error.message : "Failed to pick item");
    }
  }

  function toggleItemSelection(itemId: string) {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!wave) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Wave not found</p>
        <Button variant="link" onClick={() => router.push("/wms/waves")}>
          Back to Waves
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[wave.status] || statusConfig.DRAFT;
  const totalItems = wave.waveItems?.length || wave._count?.waveItems || 0;
  const pickedItems = wave.waveItems?.filter((i) => i.status === "PICKED").length || 0;
  const progress = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/wms/waves")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{wave.waveNo}</h1>
              <Badge variant={statusInfo.variant} className="text-sm">
                <statusInfo.icon className="mr-1 h-4 w-4" />
                {statusInfo.label}
              </Badge>
            </div>
            {wave.name && (
              <p className="text-muted-foreground">{wave.name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchWave}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Actions
                <MoreHorizontal className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {wave.status === "DRAFT" && (
                <DropdownMenuItem onClick={() => handleAction("plan")}>
                  <Layers className="mr-2 h-4 w-4" />
                  Plan Wave
                </DropdownMenuItem>
              )}
              {wave.status === "PLANNED" && (
                <DropdownMenuItem onClick={() => handleAction("release")}>
                  <Play className="mr-2 h-4 w-4" />
                  Release Wave
                </DropdownMenuItem>
              )}
              {wave.status === "RELEASED" && (
                <DropdownMenuItem onClick={() => handleAction("start")}>
                  <Zap className="mr-2 h-4 w-4" />
                  Start Picking
                </DropdownMenuItem>
              )}
              {wave.status === "IN_PROGRESS" && (
                <>
                  <DropdownMenuItem onClick={() => handleAction("pause")}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction("complete")}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete Wave
                  </DropdownMenuItem>
                </>
              )}
              {["DRAFT", "PLANNED"].includes(wave.status) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleAction("cancel")}
                    className="text-red-600"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Wave
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wave._count?.waveOrders || wave.waveOrders?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Items</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pickedItems} of {totalItems} picked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Priority</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wave.priority}</div>
            <p className="text-xs text-muted-foreground">{waveTypeLabels[wave.waveType] || wave.waveType}</p>
          </CardContent>
        </Card>
      </div>

      {/* Wave Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Wave Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">
                  {wave.location?.name || "N/A"} ({wave.location?.code})
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Created By</p>
                <p className="text-sm text-muted-foreground">
                  {wave.createdBy?.name || "System"}
                </p>
              </div>
            </div>
            {wave.assignedTo && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Assigned To</p>
                    <p className="text-sm text-muted-foreground">
                      {wave.assignedTo.name}
                    </p>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(wave.createdAt), "dd MMM yyyy HH:mm")}
                </p>
              </div>
            </div>
            {wave.releasedAt && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <Play className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Released</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(wave.releasedAt), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              </>
            )}
            {wave.completedAt && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(wave.completedAt), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pick Items */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Pick Items</CardTitle>
            <CardDescription>
              Items to be picked in this wave
            </CardDescription>
          </CardHeader>
          <CardContent>
            {wave.waveItems && wave.waveItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox />
                    </TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Picked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wave.waveItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{item.sku.code}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {item.sku.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.orderNo}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.binLocation || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <span className={item.pickedQty === item.quantity ? "text-green-600" : ""}>
                          {item.pickedQty}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === "PICKED" ? "default" : "outline"}
                          className={item.status === "PICKED" ? "bg-green-100 text-green-800" : ""}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status !== "PICKED" && wave.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePickItem(item.id, item.quantity)}
                          >
                            <ScanLine className="mr-1 h-4 w-4" />
                            Pick
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items in this wave</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders in Wave */}
      <Card>
        <CardHeader>
          <CardTitle>Orders in Wave</CardTitle>
          <CardDescription>
            {wave.waveOrders?.length || 0} orders included in this wave
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wave.waveOrders && wave.waveOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order Status</TableHead>
                  <TableHead>Wave Status</TableHead>
                  <TableHead>Picked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wave.waveOrders.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => router.push(`/orders/${wo.order.id}`)}
                      >
                        {wo.order.orderNo}
                      </Button>
                    </TableCell>
                    <TableCell>{wo.order.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{wo.order.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={wo.status === "PICKED" ? "default" : "secondary"}
                      >
                        {wo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {wo.pickedAt
                        ? format(new Date(wo.pickedAt), "dd MMM HH:mm")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders in this wave</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
