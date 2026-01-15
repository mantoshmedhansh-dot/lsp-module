"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  TrendingUp,
  XCircle,
  Zap,
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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

interface ProactiveCommunication {
  id: string;
  orderId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  trigger: string;
  channel: string;
  content: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  priority: number;
  createdAt: string;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
  } | null;
}

interface CommStats {
  statusCounts: Record<string, number>;
  triggerCounts: Record<string, number>;
  channelCounts: Record<string, number>;
}

const TRIGGER_CONFIG = [
  { key: "ORDER_CONFIRMED", label: "Order Confirmed", icon: CheckCircle, color: "text-green-500" },
  { key: "SHIPPED", label: "Shipped", icon: Send, color: "text-blue-500" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Clock, color: "text-amber-500" },
  { key: "DELAY_PREDICTED", label: "Delay Alert", icon: Bell, color: "text-orange-500" },
  { key: "SLA_BREACH_RISK", label: "SLA Risk", icon: Zap, color: "text-red-500" },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle, color: "text-green-600" },
  { key: "FEEDBACK_REQUEST", label: "Feedback", icon: MessageSquare, color: "text-purple-500" },
];

export default function ProactiveCommunicationPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [communications, setCommunications] = useState<ProactiveCommunication[]>([]);
  const [stats, setStats] = useState<CommStats>({
    statusCounts: {},
    triggerCounts: {},
    channelCounts: {},
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const fetchCommunications = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(triggerFilter && { trigger: triggerFilter }),
        ...(channelFilter && { channel: channelFilter }),
      });

      const response = await fetch(`/api/proactive-communication?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCommunications(data.communications);
        setTotal(data.total);
        setStats({
          statusCounts: data.statusCounts || {},
          triggerCounts: data.triggerCounts || {},
          channelCounts: data.channelCounts || {},
        });
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch communications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCommunications, 60000);
    return () => clearInterval(interval);
  }, [page, statusFilter, triggerFilter, channelFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchCommunications();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [search]);

  const totalComms = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0);
  const sentComms = stats.statusCounts.SENT || 0;
  const deliveredComms = stats.statusCounts.DELIVERED || 0;
  const scheduledComms = stats.statusCounts.SCHEDULED || 0;
  const failedComms = stats.statusCounts.FAILED || 0;

  const deliveryRate = sentComms > 0 ? Math.round((deliveredComms / sentComms) * 100) : 0;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "WHATSAPP":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "SMS":
        return <Phone className="h-4 w-4 text-blue-500" />;
      case "EMAIL":
        return <Mail className="h-4 w-4 text-purple-500" />;
      case "AI_VOICE":
        return <Phone className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SCHEDULED: "bg-blue-100 text-blue-700",
      PENDING: "bg-amber-100 text-amber-700",
      SENT: "bg-green-100 text-green-700",
      DELIVERED: "bg-green-200 text-green-800",
      READ: "bg-purple-100 text-purple-700",
      FAILED: "bg-red-100 text-red-700",
      CANCELLED: "bg-gray-100 text-gray-700",
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="h-7 w-7" />
            Proactive Communication
          </h1>
          <p className="text-muted-foreground">
            Automated customer notifications for order lifecycle events
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCommunications}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledComms}</div>
            <p className="text-xs text-muted-foreground">Pending delivery</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <Send className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentComms}</div>
            <p className="text-xs text-muted-foreground">Messages sent</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredComms}</div>
            <p className="text-xs text-muted-foreground">{deliveryRate}% delivery rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedComms}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalComms}</div>
            <p className="text-xs text-muted-foreground">All communications</p>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Communication Triggers
          </CardTitle>
          <CardDescription>Configure automated communication for order events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TRIGGER_CONFIG.map(({ key, label, icon: Icon, color }) => {
              const count = stats.triggerCounts[key] || 0;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    triggerFilter === key ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setTriggerFilter(triggerFilter === key ? "" : key)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${color}`} />
                      <span className="font-medium text-sm">{label}</span>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        WA
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        SMS
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Channel Performance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {stats.channelCounts.WHATSAPP || 0}
                </span>
                <Badge className="bg-green-100 text-green-700">98% delivery</Badge>
              </div>
              <Progress value={98} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Highest engagement rate
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-500" />
              SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {stats.channelCounts.SMS || 0}
                </span>
                <Badge className="bg-blue-100 text-blue-700">95% delivery</Badge>
              </div>
              <Progress value={95} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Reliable fallback
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-500" />
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">
                  {stats.channelCounts.EMAIL || 0}
                </span>
                <Badge className="bg-purple-100 text-purple-700">85% delivery</Badge>
              </div>
              <Progress value={85} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Best for detailed info
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Communication Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, order..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="READ">Read</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Channels</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="AI_VOICE">AI Voice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No communications found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  communications.map((comm) => (
                    <TableRow key={comm.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{comm.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {comm.customerPhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {comm.order ? (
                          <div className="font-mono text-sm">{comm.order.orderNo}</div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {comm.trigger.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChannelIcon(comm.channel)}
                          <span className="text-sm">{comm.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm truncate" title={comm.content}>
                          {comm.content}
                        </p>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(comm.status)}
                      </TableCell>
                      <TableCell>
                        {comm.scheduledFor ? (
                          <div className="text-sm">
                            {new Date(comm.scheduledFor).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {comm.sentAt ? (
                          <div className="text-sm">
                            {new Date(comm.sentAt).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
    </div>
  );
}
