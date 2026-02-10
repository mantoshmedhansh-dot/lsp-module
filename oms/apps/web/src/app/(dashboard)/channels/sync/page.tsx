"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Play,
  Loader2,
} from "lucide-react";

interface Marketplace {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  ordersSynced: number | null;
  syncErrors: number | null;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  COMPLETED_WITH_ERRORS: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SYNCING: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-gray-100 text-gray-800",
  NEVER: "bg-gray-100 text-gray-500",
};

const statusIcons: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle className="h-4 w-4" />,
  COMPLETED_WITH_ERRORS: <AlertTriangle className="h-4 w-4" />,
  IN_PROGRESS: <RefreshCw className="h-4 w-4 animate-spin" />,
  SYNCING: <RefreshCw className="h-4 w-4 animate-spin" />,
  FAILED: <XCircle className="h-4 w-4" />,
  PENDING: <Clock className="h-4 w-4" />,
  NEVER: <Clock className="h-4 w-4" />,
};

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function ChannelSyncPage() {
  const [channelFilter, setChannelFilter] = useState("all");
  const queryClient = useQueryClient();

  // Fetch marketplaces from API
  const {
    data: marketplaces,
    isLoading,
    error,
    refetch,
  } = useQuery<Marketplace[]>({
    queryKey: ["channel-sync-marketplaces"],
    queryFn: async () => {
      const res = await fetch("/api/v1/marketplaces");
      if (!res.ok) throw new Error("Failed to fetch marketplaces");
      const result = await res.json();
      const items: Marketplace[] = Array.isArray(result)
        ? result
        : result?.items || result?.data || [];
      return items;
    },
  });

  // Mutation: trigger manual sync for a marketplace
  const syncMutation = useMutation({
    mutationFn: async (marketplaceId: string) => {
      const res = await fetch(
        `/api/v1/marketplaces/${marketplaceId}/sync-orders`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Sync request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-sync-marketplaces"] });
    },
  });

  // Mutation: sync all channels
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const activeMarketplaces = (marketplaces || []).filter(
        (m) => m.isActive || m.status === "ACTIVE"
      );
      const results = await Promise.allSettled(
        activeMarketplaces.map((m) =>
          fetch(`/api/v1/marketplaces/${m.id}/sync-orders`, { method: "POST" })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-sync-marketplaces"] });
    },
  });

  const items = marketplaces || [];

  // Compute stats from live data
  const totalSyncedToday = items.reduce(
    (sum, m) => sum + (m.ordersSynced || 0),
    0
  );
  const pendingSyncCount = items.filter(
    (m) =>
      m.lastSyncStatus === "PENDING" ||
      m.lastSyncStatus === "IN_PROGRESS" ||
      m.lastSyncStatus === "SYNCING"
  ).length;
  const errorCount = items.reduce((sum, m) => sum + (m.syncErrors || 0), 0);
  const completedCount = items.filter(
    (m) => m.lastSyncStatus === "COMPLETED"
  ).length;
  const successRate =
    items.length > 0
      ? ((completedCount / items.length) * 100).toFixed(1)
      : "--";

  // Filter by channel
  const filteredItems =
    channelFilter === "all"
      ? items
      : items.filter(
          (m) =>
            m.name.toLowerCase().includes(channelFilter.toLowerCase()) ||
            m.code?.toLowerCase() === channelFilter.toLowerCase()
        );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">Failed to load marketplace data</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Sync</h1>
          <p className="text-muted-foreground">
            Manage channel synchronization and resolve sync issues
          </p>
        </div>
        <Button
          onClick={() => syncAllMutation.mutate()}
          disabled={syncAllMutation.isPending}
        >
          {syncAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Sync All Channels
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{totalSyncedToday}</p>
                <p className="text-sm text-muted-foreground">Orders Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingSyncCount}</p>
                <p className="text-sm text-muted-foreground">Pending Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Sync Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Marketplace Sync Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Marketplace Sync Status</CardTitle>
              <CardDescription>
                Sync history and status for each connected marketplace
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  {items.map((m) => (
                    <SelectItem key={m.id} value={m.code || m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Marketplaces Found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Connect marketplaces from the Channels page to start syncing
                orders.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders Synced</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((marketplace) => {
                  const syncStatus =
                    marketplace.lastSyncStatus || "NEVER";
                  const isSyncing =
                    syncMutation.isPending &&
                    syncMutation.variables === marketplace.id;

                  return (
                    <TableRow key={marketplace.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            {(marketplace.code || marketplace.name)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{marketplace.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {marketplace.type}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatSyncTime(marketplace.lastSyncAt)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[syncStatus] || statusColors.PENDING}>
                          <span className="flex items-center gap-1">
                            {isSyncing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              statusIcons[syncStatus] || statusIcons.PENDING
                            )}
                            {isSyncing
                              ? "SYNCING"
                              : syncStatus.replace(/_/g, " ")}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {marketplace.ordersSynced ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(marketplace.syncErrors || 0) > 0 ? (
                          <span className="text-red-600 font-medium">
                            {marketplace.syncErrors}
                          </span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncMutation.mutate(marketplace.id)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
