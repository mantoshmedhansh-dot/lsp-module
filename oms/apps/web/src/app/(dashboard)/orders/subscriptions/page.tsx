"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Repeat,
  Calendar,
  Package,
  RefreshCw,
  Play,
  Pause,
  X,
  User,
  DollarSign,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Subscription {
  id: string;
  subscriptionNo: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  frequency: string;
  nextDeliveryDate: string | null;
  lastDeliveryDate: string | null;
  totalDeliveries: number;
  completedDeliveries: number;
  maxDeliveries: number | null;
  totalAmount: string;
  autoRenew: boolean;
  pausedAt: string | null;
  createdAt: string;
}

interface UpcomingDelivery {
  subscriptionId: string;
  subscriptionNo: string;
  customerName: string | null;
  nextDeliveryDate: string | null;
  frequency: string;
  totalAmount: string;
  status: string;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

const frequencyLabels: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
  CUSTOM: "Custom",
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/v1/subscriptions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search]);

  const fetchUpcoming = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/subscriptions/upcoming");
      if (response.ok) {
        const data = await response.json();
        setUpcoming(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching upcoming:", error);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(fetchSubscriptions, 300);
    return () => clearTimeout(debounce);
  }, [fetchSubscriptions]);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  const pauseSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/v1/subscriptions/${selectedSubscription.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success("Subscription paused");
        setShowPauseDialog(false);
        fetchSubscriptions();
      } else {
        toast.error("Failed to pause subscription");
      }
    } catch (error) {
      toast.error("Failed to pause subscription");
    } finally {
      setIsProcessing(false);
    }
  };

  const resumeSubscription = async (subscription: Subscription) => {
    try {
      const response = await fetch(`/api/v1/subscriptions/${subscription.id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success("Subscription resumed");
        fetchSubscriptions();
      } else {
        toast.error("Failed to resume subscription");
      }
    } catch (error) {
      toast.error("Failed to resume subscription");
    }
  };

  const cancelSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/v1/subscriptions/${selectedSubscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (response.ok) {
        toast.success("Subscription cancelled");
        setShowCancelDialog(false);
        fetchSubscriptions();
      } else {
        toast.error("Failed to cancel subscription");
      }
    } catch (error) {
      toast.error("Failed to cancel subscription");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="secondary">Draft</Badge>;
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Active</Badge>;
      case "PAUSED":
        return <Badge className="bg-yellow-100 text-yellow-800"><Pause className="mr-1 h-3 w-3" />Paused</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "EXPIRED":
        return <Badge variant="outline">Expired</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === "ACTIVE").length,
    paused: subscriptions.filter(s => s.status === "PAUSED").length,
    upcoming: upcoming.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage recurring orders and delivery schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSubscriptions}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Subscription
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Deliveries</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deliveries */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deliveries</CardTitle>
            <CardDescription>Subscriptions due for delivery in the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {upcoming.slice(0, 6).map((delivery) => (
                <div key={delivery.subscriptionId} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm">{delivery.subscriptionNo}</span>
                    <Badge variant="outline">{frequencyLabels[delivery.frequency]}</Badge>
                  </div>
                  <p className="font-medium">{delivery.customerName}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {delivery.nextDeliveryDate
                      ? new Date(delivery.nextDeliveryDate).toLocaleDateString()
                      : "-"
                    }
                  </div>
                  <p className="font-medium">${parseDecimal(delivery.totalAmount).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="Search by subscription #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>{subscriptions.length} subscriptions found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : subscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Repeat className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No subscriptions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscription #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Delivery</TableHead>
                  <TableHead className="text-center">Deliveries</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium font-mono">
                      {subscription.subscriptionNo}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{subscription.customerName || "-"}</p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.customerEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {frequencyLabels[subscription.frequency] || subscription.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription.nextDeliveryDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(subscription.nextDeliveryDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {subscription.completedDeliveries}
                      {subscription.maxDeliveries && (
                        <span className="text-muted-foreground">
                          /{subscription.maxDeliveries}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseDecimal(subscription.totalAmount).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {subscription.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedSubscription(subscription);
                              setShowPauseDialog(true);
                            }}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {subscription.status === "PAUSED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resumeSubscription(subscription)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {(subscription.status === "ACTIVE" || subscription.status === "PAUSED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              setSelectedSubscription(subscription);
                              setShowCancelDialog(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pause Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Subscription</DialogTitle>
            <DialogDescription>
              The subscription will be paused until manually resumed
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Subscription #</span>
                <span className="font-mono font-medium">{selectedSubscription.subscriptionNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Customer</span>
                <span className="font-medium">{selectedSubscription.customerName}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={pauseSubscription} disabled={isProcessing}>
              {isProcessing ? "Pausing..." : "Pause Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              This action cannot be undone
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Subscription #</span>
                <span className="font-mono font-medium">{selectedSubscription.subscriptionNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Customer</span>
                <span className="font-medium">{selectedSubscription.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Completed Deliveries</span>
                <span className="font-medium">{selectedSubscription.completedDeliveries}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Active
            </Button>
            <Button variant="destructive" onClick={cancelSubscription} disabled={isProcessing}>
              {isProcessing ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
