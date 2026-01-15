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
import { ClipboardCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function ClientWMSQCPage() {
  const qcQueue = [
    {
      id: "QC-OUT-001",
      orderId: "ORD-2024-1001",
      channel: "Amazon",
      items: 3,
      template: "Standard Apparel",
      status: "PENDING",
    },
    {
      id: "QC-OUT-002",
      orderId: "ORD-2024-1002",
      channel: "Flipkart",
      items: 1,
      template: "Premium Check",
      status: "IN_PROGRESS",
    },
    {
      id: "QC-OUT-003",
      orderId: "ORD-2024-1003",
      channel: "Myntra",
      items: 2,
      template: "Standard Apparel",
      status: "PASSED",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    PASSED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QC Queue</h1>
          <p className="text-muted-foreground">
            Outbound quality check before shipping
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">15</p>
                <p className="text-sm text-muted-foreground">Pending QC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">99.2%</p>
                <p className="text-sm text-muted-foreground">Pass Rate</p>
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
                <p className="text-sm text-muted-foreground">Failed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QC Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Check Queue</CardTitle>
          <CardDescription>Orders awaiting quality inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QC ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qcQueue.map((qc) => (
                <TableRow key={qc.id}>
                  <TableCell className="font-mono">{qc.id}</TableCell>
                  <TableCell className="font-medium">{qc.orderId}</TableCell>
                  <TableCell>{qc.channel}</TableCell>
                  <TableCell>{qc.items}</TableCell>
                  <TableCell className="text-muted-foreground">{qc.template}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[qc.status]}>
                      {qc.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {qc.status === "PENDING" ? (
                      <Button size="sm">Start QC</Button>
                    ) : qc.status === "IN_PROGRESS" ? (
                      <Button variant="outline" size="sm">Continue</Button>
                    ) : (
                      <Button variant="ghost" size="sm">View</Button>
                    )}
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
