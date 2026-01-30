"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  X,
  MoreHorizontal,
  Eye,
  Phone,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  Bot,
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
import { toast } from "sonner";

interface NDR {
  id: string;
  ndrNo: string;
  orderId: string;
  orderNo: string;
  awb: string;
  status: string;
  reason: string;
  attempts: number;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  carrierName: string;
  lastAttemptDate: string;
  createdAt: string;
  priority: string;
  outreachCount: number;
}

interface NDRSummary {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rto: number;
  byReason: Record<string, number>;
  byCarrier: Record<string, number>;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "outline" },
  IN_PROGRESS: { label: "In Progress", variant: "secondary" },
  RESOLVED: { label: "Resolved", variant: "default" },
  RTO_INITIATED: { label: "RTO Initiated", variant: "destructive" },
  RTO_COMPLETED: { label: "RTO Completed", variant: "destructive" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  HIGH: { label: "High", color: "text-red-600" },
  MEDIUM: { label: "Medium", color: "text-yellow-600" },
  LOW: { label: "Low", color: "text-green-600" },
};

const reasonLabels: Record<string, string> = {
  CUSTOMER_NOT_AVAILABLE: "Customer Not Available",
  WRONG_ADDRESS: "Wrong Address",
  CUSTOMER_REFUSED: "Customer Refused",
  PHONE_UNREACHABLE: "Phone Unreachable",
  INCOMPLETE_ADDRESS: "Incomplete Address",
  COD_NOT_READY: "COD Not Ready",
  DELIVERY_RESCHEDULED: "Delivery Rescheduled",
  AREA_NOT_SERVICEABLE: "Area Not Serviceable",
  OTHER: "Other",
};

const statusTabs = [
  { value: "all", label: "All NDRs" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "RTO_INITIATED", label: "RTO" },
];

export default function NDRQueuePage() {
  const router = useRouter();
  const [ndrs, setNdrs] = useState<NDR[]>([]);
  const [summary, setSummary] = useState<NDRSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showBanner, setShowBanner] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const fetchNDRs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      if (reasonFilter !== "all") params.set("reason", reasonFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/ndr?${params}`);
      if (!response.ok) throw new Error("Failed to fetch NDRs");
      const result = await response.json();
      setNdrs(result.ndrs || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error("Error fetching NDRs:", error);
      toast.error("Failed to load NDRs");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, reasonFilter, priorityFilter, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/ndr/summary");
      if (!response.ok) throw new Error("Failed to fetch summary");
      const result = await response.json();
      setSummary(result);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchNDRs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchNDRs]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  async function handleOutreach(ndrId: string, channel: string) {
    try {
      const response = await fetch(`/api/v1/ndr/${ndrId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      if (response.ok) {
        toast.success(`${channel} outreach initiated`);
        fetchNDRs();
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to initiate outreach");
      }
    } catch (error) {
      console.error("Error initiating outreach:", error);
      toast.error("Failed to initiate outreach");
    }
  }

  async function handleScheduleReattempt(ndrId: string) {
    try {
      const response = await fetch(`/api/v1/ndr/${ndrId}/reattempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast.success("Reattempt scheduled");
        fetchNDRs();
      } else {
        const result = await response.json();
        toast.error(result.error || "Failed to schedule reattempt");
      }
    } catch (error) {
      console.error("Error scheduling reattempt:", error);
      toast.error("Failed to schedule reattempt");
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
    setReasonFilter("all");
    setPriorityFilter("all");
    setPage(1);
  }

  const hasFilters = search || activeTab !== "all" || reasonFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NDR Queue</h1>
          <p className="text-muted-foreground">
            Manage non-delivery reports and customer outreach
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchNDRs(); fetchSummary(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/ndr/reattempts")}>
            <Clock className="mr-2 h-4 w-4" />
            Reattempts
          </Button>
        </div>
      </div>

      {/* AI Command Center Promotion Banner */}
      {showBanner && (
        <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-indigo-700">Try AI-Powered NDR Command Center</p>
                  <p className="text-sm text-indigo-600">
                    Rule-based detection, AI actions, risk scoring, and automated outreach
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => router.push("/control-tower/ndr")}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  Open Command Center
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600"
                  onClick={() => setShowBanner(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total NDRs</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RTO</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.rto}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
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
                placeholder="Search by order, AWB, or customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {Object.entries(reasonLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
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

      {/* NDR Table */}
      <Card>
        <CardHeader>
          <CardTitle>NDR List</CardTitle>
          <CardDescription>
            {total} NDRs found {hasFilters && "(filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : ndrs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No NDRs match your filters" : "No NDRs found"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NDR / Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ndrs.map((ndr) => {
                    const statusInfo = statusConfig[ndr.status] || {
                      label: ndr.status,
                      variant: "outline" as const,
                    };
                    const priorityInfo = priorityConfig[ndr.priority] || {
                      label: ndr.priority,
                      color: "text-muted-foreground",
                    };

                    return (
                      <TableRow key={ndr.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ndr.ndrNo}</p>
                            <button
                              onClick={() => router.push(`/orders/${ndr.orderId}`)}
                              className="text-xs text-primary hover:underline"
                            >
                              {ndr.orderNo}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{ndr.customerName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {ndr.customerCity}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm">{ndr.awb}</p>
                            <p className="text-xs text-muted-foreground">
                              {ndr.carrierName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reasonLabels[ndr.reason] || ndr.reason}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ndr.attempts}</span>
                            {ndr.outreachCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <MessageCircle className="h-3 w-3 mr-1" />
                                {ndr.outreachCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={priorityInfo.color}>
                            {priorityInfo.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/orders/${ndr.orderId}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Order
                              </DropdownMenuItem>
                              {ndr.status === "PENDING" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleOutreach(ndr.id, "WHATSAPP")}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    WhatsApp Outreach
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOutreach(ndr.id, "SMS")}
                                  >
                                    <Phone className="mr-2 h-4 w-4" />
                                    SMS Outreach
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleOutreach(ndr.id, "AI_VOICE")}
                                  >
                                    <Bot className="mr-2 h-4 w-4" />
                                    AI Voice Call
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleScheduleReattempt(ndr.id)}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    Schedule Reattempt
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
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
