"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RotateCcw,
  Package,
  AlertTriangle,
  Clock,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { useReturnList, useReturnSummary } from "@/hooks";
import type { ReturnStatus, ReturnType } from "@/lib/api/client";

// Type for summary data (since API returns unknown)
interface ReturnSummaryData {
  totalReturns?: number;
  byStatus?: Record<string, number>;
  byReason?: Record<string, number>;
  rtoRate?: number;
}

export default function RTOManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Fetch returns with RTO type filter
  const {
    data: returnsData,
    isLoading: isLoadingReturns,
    refetch,
  } = useReturnList({
    skip: (page - 1) * limit,
    limit,
    returnType: "RTO" as ReturnType,
    ...(statusFilter !== "all" && { status: statusFilter as ReturnStatus }),
  });

  // Fetch return summary for stats - cast to expected type
  const { data: rawSummaryData, isLoading: isLoadingSummary } = useReturnSummary();
  const summaryData = rawSummaryData as ReturnSummaryData | undefined;

  const statusColors: Record<string, string> = {
    INITIATED: "bg-yellow-100 text-yellow-800",
    PICKUP_SCHEDULED: "bg-blue-100 text-blue-800",
    PICKED_UP: "bg-indigo-100 text-indigo-800",
    IN_TRANSIT: "bg-purple-100 text-purple-800",
    RECEIVED: "bg-blue-100 text-blue-800",
    QC_PENDING: "bg-orange-100 text-orange-800",
    QC_PASSED: "bg-green-100 text-green-800",
    QC_FAILED: "bg-red-100 text-red-800",
    REFUND_INITIATED: "bg-cyan-100 text-cyan-800",
    CANCELLED: "bg-gray-100 text-gray-800",
  };

  // Extract returns from response
  const returns = Array.isArray(returnsData) ? returnsData : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RTO Management</h1>
          <p className="text-muted-foreground">
            Track and manage return to origin shipments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {isLoadingSummary ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {summaryData?.totalReturns || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Active RTOs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {summaryData?.byStatus?.QC_PENDING || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">QC Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {summaryData?.byStatus?.QC_PASSED || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">QC Passed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {summaryData?.rtoRate
                        ? `${(summaryData.rtoRate * 100).toFixed(1)}%`
                        : "0%"}
                    </p>
                    <p className="text-sm text-muted-foreground">RTO Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* RTO Reasons Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>RTO Reasons Analysis</CardTitle>
          <CardDescription>Top reasons for return to origin</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSummary ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {summaryData?.byReason &&
                Object.entries(summaryData.byReason).map(([reason, count]) => {
                  const total = summaryData.totalReturns || 1;
                  const percent = Math.round(((count as number) / total) * 100);
                  return (
                    <div key={reason} className="flex items-center gap-4">
                      <div className="w-40 text-sm">{reason.replace(/_/g, " ")}</div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm text-muted-foreground">
                        {count as number} ({percent}%)
                      </div>
                    </div>
                  );
                })}
              {(!summaryData?.byReason ||
                Object.keys(summaryData.byReason).length === 0) && (
                <p className="text-muted-foreground text-center py-4">
                  No RTO reason data available
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by AWB or Order ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="INITIATED">Initiated</SelectItem>
                <SelectItem value="PICKUP_SCHEDULED">Pickup Scheduled</SelectItem>
                <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="QC_PENDING">QC Pending</SelectItem>
                <SelectItem value="QC_PASSED">QC Passed</SelectItem>
                <SelectItem value="QC_FAILED">QC Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* RTO List */}
      <Card>
        <CardHeader>
          <CardTitle>RTO Orders</CardTitle>
          <CardDescription>All return to origin shipments</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReturns ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No RTO orders found</p>
              <p className="text-sm">RTOs will appear here when created</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return ID</TableHead>
                  <TableHead>Order / AWB</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((rto: any) => (
                  <TableRow key={rto.id}>
                    <TableCell className="font-medium font-mono">
                      {rto.returnNo || rto.id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{rto.orderNo || rto.orderId?.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {rto.awbNo || "N/A"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rto.reason?.replace(/_/g, " ") || "N/A"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rto.createdAt
                        ? new Date(rto.createdAt).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[rto.status] || "bg-gray-100"}>
                        {rto.status?.replace(/_/g, " ") || "UNKNOWN"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
