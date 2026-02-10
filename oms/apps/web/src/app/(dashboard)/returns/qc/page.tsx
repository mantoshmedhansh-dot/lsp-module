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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Search,
  ClipboardCheck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface QCExecution {
  id: string;
  executionNo?: string;
  type: string;
  status: string;
  result?: string;
  orderNo?: string;
  orderId?: string;
  returnNo?: string;
  returnId?: string;
  templateId?: string;
  template?: {
    id: string;
    name: string;
  };
  items?: {
    id: string;
    skuCode?: string;
    skuName?: string;
    quantity?: number;
    result?: string;
  }[];
  _count?: { items: number };
  totalItems?: number;
  passedItems?: number;
  failedItems?: number;
  remarks?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800", icon: ClipboardCheck },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: XCircle },
};

const resultColors: Record<string, string> = {
  PASSED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PARTIAL: "bg-orange-100 text-orange-800",
};

export default function ReturnQCPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const queryClient = useQueryClient();

  // Fetch QC executions for returns
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["return-qc-executions", statusFilter, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: "RETURN",
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const res = await fetch(`/api/v1/qc/executions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch QC executions");
      return res.json();
    },
  });

  // Normalize response
  const executions: QCExecution[] = Array.isArray(data)
    ? data
    : data?.items || data?.data || data?.executions || [];
  const totalPages = data?.totalPages || Math.ceil((data?.total || 0) / limit) || 1;
  const total = data?.total || executions.length;

  // Compute stats from data
  const stats = {
    total,
    pending: data?.stats?.pending ?? executions.filter((e) => e.status === "PENDING").length,
    inProgress: data?.stats?.inProgress ?? executions.filter((e) => e.status === "IN_PROGRESS").length,
    completed: data?.stats?.completed ?? executions.filter((e) => e.status === "COMPLETED").length,
    failed: data?.stats?.failed ?? executions.filter((e) => e.status === "FAILED").length,
    passRate: data?.stats?.passRate ?? null,
  };

  const handleSearch = () => {
    setPage(1);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Return QC</h1>
          <p className="text-muted-foreground">
            Quality check for returned products
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
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
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Passed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order no, return no..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QC Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>QC Queue</CardTitle>
          <CardDescription>
            Return quality check executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mb-4 opacity-50" />
              <p>No QC executions found</p>
              <p className="text-sm">Return QC items will appear here when created</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QC ID</TableHead>
                  <TableHead>Order / Return</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution: QCExecution) => {
                  const statusInfo = statusConfig[execution.status] || statusConfig.PENDING;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={execution.id}>
                      <TableCell className="font-medium font-mono">
                        {execution.executionNo || execution.id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">
                            {execution.orderNo || execution.orderId?.slice(0, 8) || "-"}
                          </p>
                          {execution.returnNo && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {execution.returnNo}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {execution.template?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {execution._count?.items || execution.totalItems || execution.items?.length || 0}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <span className="flex items-center gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {execution.result ? (
                          <Badge className={resultColors[execution.result] || "bg-gray-100 text-gray-800"}>
                            {execution.result.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(execution.startedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(execution.completedAt)}
                      </TableCell>
                      <TableCell>
                        {execution.status === "PENDING" || execution.status === "IN_PROGRESS" ? (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="text-green-600">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Pass
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600">
                              <XCircle className="mr-1 h-3 w-3" />
                              Fail
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {executions.length} of {total} executions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* QC Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>QC Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Pass Criteria (Restockable)</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>- Product in original packaging</li>
                <li>- No visible damage or stains</li>
                <li>- All tags intact</li>
                <li>- No signs of use</li>
              </ul>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Fail Criteria (Non-Restockable)</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>- Visible damage or defects</li>
                <li>- Missing components or tags</li>
                <li>- Signs of wear or washing</li>
                <li>- Hygiene products opened</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
