"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

interface NDR {
  id: string;
  ndrCode: string;
  reason: string;
  aiClassification: string | null;
  confidence: number | null;
  status: string;
  priority: string;
  riskScore: number | null;
  attemptNumber: number;
  attemptDate: string;
  carrierRemark: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    shippingAddress: unknown;
    paymentMode: string;
    totalAmount: number;
  };
  delivery: {
    id: string;
    deliveryNo: string;
    awbNo: string;
    status: string;
    transporter: {
      code: string;
      name: string;
    } | null;
  } | null;
  outreachAttempts: Array<{
    id: string;
    channel: string;
    status: string;
    sentAt: string | null;
    response: string | null;
  }>;
  _count: {
    outreachAttempts: number;
    aiActions: number;
  };
}

interface NDRStats {
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  reasonCounts: Record<string, number>;
}

export default function NDRCommandCenterPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [ndrs, setNdrs] = useState<NDR[]>([]);
  const [stats, setStats] = useState<NDRStats>({
    statusCounts: {},
    priorityCounts: {},
    reasonCounts: {},
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [selectedNDR, setSelectedNDR] = useState<NDR | null>(null);
  const [outreachDialogOpen, setOutreachDialogOpen] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState("WHATSAPP");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const fetchNDRs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(reasonFilter && { reason: reasonFilter }),
      });

      const response = await fetch(`/api/ndr?${params}`);
      if (response.ok) {
        const data = await response.json();
        setNdrs(data.ndrs);
        setTotal(data.total);
        setStats({
          statusCounts: data.statusCounts || {},
          priorityCounts: data.priorityCounts || {},
          reasonCounts: data.reasonCounts || {},
        });
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch NDRs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNDRs();
    // Refresh every 60 seconds
    const interval = setInterval(fetchNDRs, 60000);
    return () => clearInterval(interval);
  }, [page, statusFilter, priorityFilter, reasonFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchNDRs();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleOutreach = async () => {
    if (!selectedNDR) return;
    setIsSending(true);

    try {
      const response = await fetch(`/api/ndr/${selectedNDR.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: outreachChannel,
          customMessage: customMessage || undefined,
        }),
      });

      if (response.ok) {
        setOutreachDialogOpen(false);
        setCustomMessage("");
        fetchNDRs();
      }
    } catch (error) {
      console.error("Failed to send outreach:", error);
    } finally {
      setIsSending(false);
    }
  };

  const totalNDRs = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0);
  const openNDRs = stats.statusCounts.OPEN || 0;
  const contactedNDRs = stats.statusCounts.CONTACTED || 0;
  const resolvedNDRs = stats.statusCounts.RESOLVED || 0;
  const rtoPending = stats.statusCounts.RTO_PENDING || 0;
  const criticalNDRs = stats.priorityCounts.CRITICAL || 0;
  const highPriorityNDRs = stats.priorityCounts.HIGH || 0;

  const resolutionRate = totalNDRs > 0 ? Math.round((resolvedNDRs / totalNDRs) * 100) : 0;
  const contactRate = totalNDRs > 0 ? Math.round(((contactedNDRs + resolvedNDRs) / totalNDRs) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Bot className="h-7 w-7" />
            NDR Command Center
          </h1>
          <p className="text-muted-foreground">
            AI-powered NDR resolution with automated customer outreach
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNDRs}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open NDRs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openNDRs}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <Phone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactedNDRs}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedNDRs}</div>
            <p className="text-xs text-muted-foreground">{resolutionRate}% resolution rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RTO Pending</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rtoPending}</div>
            <p className="text-xs text-muted-foreground">Return initiated</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <ShieldAlert className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalNDRs}</div>
            <p className="text-xs text-muted-foreground">Needs immediate action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Target className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityNDRs}</div>
            <p className="text-xs text-muted-foreground">Priority attention</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Performance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              AI Auto-Resolution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{resolutionRate}%</span>
                {resolutionRate >= 50 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <Progress value={resolutionRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Target: 54% (Industry benchmark)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              Contact Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{contactRate}%</span>
                {contactRate >= 70 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                )}
              </div>
              <Progress value={contactRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Customers reached successfully
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Avg. Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">2.4h</span>
                <TrendingDown className="h-5 w-5 text-green-500" />
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Industry avg: 4-6 hours
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NDR Reason Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">NDR Reasons Distribution</CardTitle>
          <CardDescription>AI-classified NDR reasons across all active cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              { key: "CUSTOMER_NOT_AVAILABLE", label: "Not Available", color: "bg-blue-500" },
              { key: "WRONG_ADDRESS", label: "Wrong Address", color: "bg-red-500" },
              { key: "PHONE_UNREACHABLE", label: "Phone Off", color: "bg-orange-500" },
              { key: "REFUSED", label: "Refused", color: "bg-purple-500" },
              { key: "COD_NOT_READY", label: "COD Not Ready", color: "bg-amber-500" },
              { key: "CUSTOMER_RESCHEDULE", label: "Reschedule", color: "bg-green-500" },
              { key: "OTHER", label: "Other", color: "bg-gray-500" },
            ].map(({ key, label, color }) => {
              const count = stats.reasonCounts[key] || 0;
              const percentage = totalNDRs > 0 ? Math.round((count / totalNDRs) * 100) : 0;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    reasonFilter === key ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setReasonFilter(reasonFilter === key ? "" : key)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <div className="text-xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{percentage}%</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            NDR Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order, AWB, customer..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="CUSTOMER_RESPONDED">Responded</SelectItem>
                <SelectItem value="REATTEMPT_SCHEDULED">Reattempt</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="RTO_PENDING">RTO Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NDR Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NDR Code</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outreach</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ndrs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                        <p>No NDRs matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  ndrs.map((ndr) => (
                    <TableRow key={ndr.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {ndr.ndrCode}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ndr.order.orderNo}</div>
                          <div className="text-xs text-muted-foreground">
                            {ndr.delivery?.awbNo || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{ndr.order.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {ndr.order.customerPhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {ndr.reason.replace(/_/g, " ")}
                          </Badge>
                          {ndr.confidence && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {Math.round(ndr.confidence * 100)}% confident
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ndr.priority === "CRITICAL"
                              ? "bg-red-100 text-red-700"
                              : ndr.priority === "HIGH"
                                ? "bg-orange-100 text-orange-700"
                                : ndr.priority === "MEDIUM"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                          }
                        >
                          {ndr.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ndr.riskScore !== null && (
                          <div className="flex items-center gap-2">
                            <Progress value={ndr.riskScore} className="w-16 h-2" />
                            <span className="text-xs">{ndr.riskScore}%</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ndr.status === "RESOLVED"
                              ? "bg-green-100 text-green-700"
                              : ndr.status === "CONTACTED"
                                ? "bg-blue-100 text-blue-700"
                                : ndr.status === "RTO_PENDING"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                          }
                        >
                          {ndr.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {ndr._count.outreachAttempts} attempts
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedNDR(ndr);
                              setOutreachDialogOpen(true);
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/orders/${ndr.order.id}`, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * 25) + 1} - {Math.min(page * 25, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 25 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outreach Dialog */}
      <Dialog open={outreachDialogOpen} onOpenChange={setOutreachDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Outreach</DialogTitle>
            <DialogDescription>
              Contact customer for NDR resolution via AI-powered communication
            </DialogDescription>
          </DialogHeader>

          {selectedNDR && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order:</span>{" "}
                    <span className="font-medium">{selectedNDR.order.orderNo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>{" "}
                    <span className="font-medium">{selectedNDR.order.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-medium">{selectedNDR.order.customerPhone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reason:</span>{" "}
                    <span className="font-medium">{selectedNDR.reason.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Tabs value={outreachChannel} onValueChange={setOutreachChannel}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="WHATSAPP" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="SMS" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      SMS
                    </TabsTrigger>
                    <TabsTrigger value="AI_VOICE" className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      AI Call
                    </TabsTrigger>
                    <TabsTrigger value="EMAIL" className="flex items-center gap-2" disabled={!selectedNDR.order.customerEmail}>
                      <Mail className="h-4 w-4" />
                      Email
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Message (Optional)</label>
                <Textarea
                  placeholder="Leave empty to use AI-generated message based on NDR reason..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  AI will generate an appropriate message if left empty
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOutreachDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOutreach} disabled={isSending}>
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Outreach
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
