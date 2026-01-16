"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  ShieldCheck,
  FileText,
  Save,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-green-100 text-green-800",
  VARIANCE_FOUND: "bg-orange-100 text-orange-800",
  VERIFIED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
  PENDING: "bg-gray-100 text-gray-800",
  COUNTED: "bg-green-100 text-green-800",
};

interface CycleCountItem {
  id: string;
  skuId: string;
  binId: string;
  batchNo?: string;
  expectedQty: number;
  countedQty: number;
  varianceQty: number;
  status: string;
  sku?: { code: string; name: string };
  bin?: { code: string; zone?: { code: string } };
}

interface CycleCount {
  id: string;
  cycleCountNo: string;
  status: string;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  varianceFound: boolean;
  varianceValue?: number;
  remarks?: string;
  items: CycleCountItem[];
}

export default function CycleCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch cycle count details
  const { data: cycleCount, isLoading } = useQuery<CycleCount>({
    queryKey: ["cycle-count", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/cycle-counts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch cycle count");
      return res.json();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      action,
      data,
    }: {
      action: string;
      data?: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/v1/cycle-counts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update cycle count");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Cycle count ${variables.action.replace(/_/g, " ")} completed`,
      });
      queryClient.invalidateQueries({ queryKey: ["cycle-count", id] });
      setConfirmAction(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCountChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setCounts((prev) => ({ ...prev, [itemId]: numValue }));
  };

  const handleSaveCounts = () => {
    const items = Object.entries(counts)
      .filter(([_, value]) => value >= 0)
      .map(([itemId, countedQty]) => ({ itemId, countedQty }));

    if (items.length === 0) {
      toast({
        title: "No counts to save",
        description: "Enter counts for items first",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ action: "record_counts", data: { items } });
    setCounts({});
  };

  if (isLoading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  if (!cycleCount) {
    return <div className="text-center py-8">Cycle count not found</div>;
  }

  const items = cycleCount.items || [];
  const countedItems = items.filter((i) => i.status === "COUNTED");
  const pendingItems = items.filter((i) => i.status === "PENDING");
  const varianceItems = items.filter((i) => i.varianceQty !== 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/cycle-count">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {cycleCount.cycleCountNo}
            </h1>
            <p className="text-muted-foreground">
              Scheduled: {formatDate(cycleCount.scheduledDate)}
            </p>
          </div>
        </div>
        <Badge className={statusColors[cycleCount.status] || ""}>
          {cycleCount.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Counted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {countedItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {pendingItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {varianceItems.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {cycleCount.status === "PLANNED" && (
              <Button onClick={() => setConfirmAction("start")}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Count
              </Button>
            )}
            {cycleCount.status === "IN_PROGRESS" && (
              <>
                <Button
                  onClick={handleSaveCounts}
                  disabled={Object.keys(counts).length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Counts
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction("complete")}
                  disabled={pendingItems.length > 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete
                </Button>
              </>
            )}
            {["COMPLETED", "VARIANCE_FOUND"].includes(cycleCount.status) && (
              <Button onClick={() => setConfirmAction("verify")}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify
              </Button>
            )}
            {cycleCount.status === "VERIFIED" && cycleCount.varianceFound && (
              <Button onClick={() => setConfirmAction("apply_adjustments")}>
                <FileText className="h-4 w-4 mr-2" />
                Apply Adjustments
              </Button>
            )}
            {!["VERIFIED", "CANCELLED"].includes(cycleCount.status) && (
              <Button
                variant="destructive"
                onClick={() => setConfirmAction("cancel")}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items to Count</CardTitle>
          <CardDescription>
            Enter physical counts for each item
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.bin?.zone?.code || "-"}</TableCell>
                  <TableCell className="font-medium">
                    {item.bin?.code || "-"}
                  </TableCell>
                  <TableCell>{item.sku?.code || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {item.sku?.name || "-"}
                  </TableCell>
                  <TableCell>{item.batchNo || "-"}</TableCell>
                  <TableCell className="text-right">{item.expectedQty}</TableCell>
                  <TableCell className="text-right">
                    {cycleCount.status === "IN_PROGRESS" &&
                    item.status === "PENDING" ? (
                      <Input
                        type="number"
                        min="0"
                        className="w-20 text-right"
                        value={counts[item.id] ?? ""}
                        onChange={(e) =>
                          handleCountChange(item.id, e.target.value)
                        }
                        placeholder={item.expectedQty.toString()}
                      />
                    ) : (
                      item.countedQty
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === "COUNTED" && (
                      <span
                        className={
                          item.varianceQty === 0
                            ? "text-green-600"
                            : item.varianceQty > 0
                            ? "text-blue-600"
                            : "text-red-600"
                        }
                      >
                        {item.varianceQty > 0 ? "+" : ""}
                        {item.varianceQty}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[item.status] || ""}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {confirmAction?.replace(/_/g, " ")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "start" &&
                "This will start the cycle count. You can then enter physical counts for each item."}
              {confirmAction === "complete" &&
                "This will mark the cycle count as complete. Any variances will be flagged for review."}
              {confirmAction === "verify" &&
                "This will verify the cycle count results. Make sure all counts are accurate."}
              {confirmAction === "apply_adjustments" &&
                "This will create stock adjustments based on the variance found. Inventory quantities will be updated."}
              {confirmAction === "cancel" &&
                "This will cancel the cycle count. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                updateMutation.mutate({ action: confirmAction! })
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
