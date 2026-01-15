"use client";

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
import { RefreshCw, CheckCircle, AlertTriangle, Clock, XCircle, Play } from "lucide-react";

export default function ClientChannelSyncPage() {
  const syncHistory = [
    {
      id: "SYNC001",
      channel: "Amazon India",
      type: "Orders",
      startTime: "2024-01-15 10:30:00",
      duration: "45s",
      itemsSynced: 23,
      errors: 0,
      status: "COMPLETED",
    },
    {
      id: "SYNC002",
      channel: "Flipkart",
      type: "Orders",
      startTime: "2024-01-15 10:28:00",
      duration: "1m 12s",
      itemsSynced: 15,
      errors: 2,
      status: "COMPLETED_WITH_ERRORS",
    },
    {
      id: "SYNC003",
      channel: "Myntra",
      type: "Inventory",
      startTime: "2024-01-15 10:25:00",
      duration: "2m 30s",
      itemsSynced: 456,
      errors: 0,
      status: "COMPLETED",
    },
    {
      id: "SYNC004",
      channel: "Shopify",
      type: "Orders",
      startTime: "2024-01-15 10:20:00",
      duration: "-",
      itemsSynced: 0,
      errors: 1,
      status: "FAILED",
    },
  ];

  const pendingSync = [
    { channel: "Flipkart", type: "Orders", pending: 5, scheduled: "In 2 mins" },
    { channel: "Amazon India", type: "Inventory", pending: 120, scheduled: "In 5 mins" },
  ];

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    COMPLETED_WITH_ERRORS: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    FAILED: "bg-red-100 text-red-800",
    PENDING: "bg-gray-100 text-gray-800",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircle className="h-4 w-4" />,
    COMPLETED_WITH_ERRORS: <AlertTriangle className="h-4 w-4" />,
    IN_PROGRESS: <RefreshCw className="h-4 w-4 animate-spin" />,
    FAILED: <XCircle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Sync</h1>
          <p className="text-muted-foreground">
            Monitor channel synchronization status
          </p>
        </div>
        <Button>
          <Play className="h-4 w-4 mr-2" />
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
                <p className="text-2xl font-bold">156</p>
                <p className="text-sm text-muted-foreground">Synced Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">7</p>
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
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Sync Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">98.7%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Synchronization</CardTitle>
          <CardDescription>Orders and inventory awaiting sync</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pending Items</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingSync.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.channel}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>
                    <span className="font-medium">{item.pending}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.scheduled}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync Now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent synchronization jobs</CardDescription>
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="flipkart">Flipkart</SelectItem>
                <SelectItem value="myntra">Myntra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sync ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncHistory.map((sync) => (
                <TableRow key={sync.id}>
                  <TableCell className="font-mono font-medium">{sync.id}</TableCell>
                  <TableCell>{sync.channel}</TableCell>
                  <TableCell>{sync.type}</TableCell>
                  <TableCell className="text-muted-foreground">{sync.startTime}</TableCell>
                  <TableCell>{sync.duration}</TableCell>
                  <TableCell>{sync.itemsSynced}</TableCell>
                  <TableCell>
                    {sync.errors > 0 ? (
                      <span className="text-red-600 font-medium">{sync.errors}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sync.status]}>
                      <span className="flex items-center gap-1">
                        {statusIcons[sync.status]}
                        {sync.status.replace(/_/g, " ")}
                      </span>
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
