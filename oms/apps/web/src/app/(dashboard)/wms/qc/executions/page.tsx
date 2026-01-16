"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  MoreHorizontal,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  RefreshCw,
  Package,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface QCExecution {
  id: string;
  executionNo: string;
  status: string;
  result: string | null;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  template: {
    id: string;
    name: string;
    qcType: string;
  };
  sku: {
    id: string;
    code: string;
    name: string;
  } | null;
  inbound: {
    id: string;
    inboundNo: string;
  } | null;
  returnItem: {
    id: string;
    return: {
      returnNo: string;
    };
  } | null;
  performedBy: {
    id: string;
    name: string;
  } | null;
  _count: {
    results: number;
    defects: number;
  };
}

interface ExecutionsResponse {
  executions: QCExecution[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "secondary", icon: Play },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle },
};

const resultConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  PASS: { label: "Pass", variant: "default" },
  FAIL: { label: "Fail", variant: "destructive" },
  PARTIAL: { label: "Partial", variant: "outline" },
};

const qcTypeConfig: Record<string, { label: string; color: string }> = {
  INBOUND: { label: "Inbound", color: "bg-blue-500" },
  RETURN: { label: "Return", color: "bg-orange-500" },
  PRODUCTION: { label: "Production", color: "bg-green-500" },
  CYCLE_COUNT: { label: "Cycle Count", color: "bg-purple-500" },
  RANDOM_AUDIT: { label: "Random Audit", color: "bg-yellow-500" },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

export default function QCExecutionsPage() {
  const router = useRouter();
  const [data, setData] = useState<ExecutionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchExecutions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      if (typeFilter) params.set("qcType", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/qc/executions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch executions");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching executions:", error);
      toast.error("Failed to load QC executions");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, typeFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchExecutions();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchExecutions]);

  async function handleAction(executionId: string, action: string) {
    try {
      const response = await fetch(`/api/v1/qc/executions/${executionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`QC ${action}ed successfully`);
        fetchExecutions();
      } else {
        toast.error(result.error || `Failed to ${action} QC`);
      }
    } catch (error) {
      console.error(`Error ${action}ing QC:`, error);
      toast.error(`Failed to ${action} QC`);
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
    setTypeFilter("");
    setPage(1);
  }

  const hasFilters = search || activeTab !== "all" || typeFilter;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  function getSourceInfo(execution: QCExecution) {
    if (execution.inbound) {
      return { type: "Inbound", reference: execution.inbound.inboundNo };
    }
    if (execution.returnItem) {
      return { type: "Return", reference: execution.returnItem.return.returnNo };
    }
    if (execution.sku) {
      return { type: "SKU", reference: execution.sku.code };
    }
    return { type: "N/A", reference: "-" };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QC Queue</h1>
          <p className="text-muted-foreground">
            Process quality check executions
          </p>
        </div>
        <Button variant="outline" onClick={fetchExecutions}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending QC</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.statusCounts?.PENDING || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting inspection
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.statusCounts?.IN_PROGRESS || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently being checked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data?.statusCounts?.COMPLETED || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data?.statusCounts?.FAILED || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.label}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {getTabCount(tab.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by execution no, SKU, or reference..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="QC Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(qcTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>QC Executions</CardTitle>
          <CardDescription>
            {data?.total || 0} executions found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.executions?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters
                  ? "No executions match your filters"
                  : "No QC executions found"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                QC executions are created from inbound receiving or returns
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Execution</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Checks</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.executions.map((execution) => {
                    const statusInfo = statusConfig[execution.status] || {
                      label: execution.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const typeInfo = qcTypeConfig[execution.template.qcType] || {
                      label: execution.template.qcType,
                      color: "bg-gray-500",
                    };
                    const sourceInfo = getSourceInfo(execution);

                    return (
                      <TableRow key={execution.id}>
                        <TableCell>
                          <button
                            onClick={() =>
                              router.push(`/wms/qc/executions/${execution.id}`)
                            }
                            className="font-medium text-primary hover:underline"
                          >
                            {execution.executionNo}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(execution.createdAt), "dd MMM HH:mm")}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{execution.template.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <div
                                className={`h-2 w-2 rounded-full ${typeInfo.color}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {typeInfo.label}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="outline" className="text-xs">
                              {sourceInfo.type}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sourceInfo.reference}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {execution.sku ? (
                            <div>
                              <p className="text-sm font-medium">
                                {execution.sku.code}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {execution.sku.name}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {execution._count.results} checks
                            </span>
                            {execution._count.defects > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {execution._count.defects} defects
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {execution.result ? (
                            <Badge
                              variant={
                                resultConfig[execution.result]?.variant || "outline"
                              }
                            >
                              {resultConfig[execution.result]?.label ||
                                execution.result}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {execution.performedBy ? (
                            <span className="text-sm">
                              {execution.performedBy.name}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/wms/qc/executions/${execution.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>

                              {execution.status === "PENDING" && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(execution.id, "start")}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Start QC
                                </DropdownMenuItem>
                              )}

                              {execution.status === "IN_PROGRESS" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(
                                        `/wms/qc/executions/${execution.id}`
                                      )
                                    }
                                  >
                                    <ClipboardCheck className="mr-2 h-4 w-4" />
                                    Continue QC
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction(execution.id, "complete")
                                    }
                                    className="text-green-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={page === data.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
