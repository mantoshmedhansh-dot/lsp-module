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
import { ClipboardCheck, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function ClientReturnQCPage() {
  const returnQCQueue = [
    {
      id: "RQC-001",
      returnId: "RET-2024-001",
      orderId: "ORD-2024-1001",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      reason: "Size Issue",
      status: "PENDING",
    },
    {
      id: "RQC-002",
      returnId: "RET-2024-002",
      orderId: "ORD-2024-1002",
      sku: "SKU-JEANS-002",
      product: "Slim Fit Jeans",
      reason: "Defective",
      status: "IN_PROGRESS",
    },
    {
      id: "RQC-003",
      returnId: "RET-2024-003",
      orderId: "ORD-2024-1003",
      sku: "SKU-DRESS-003",
      product: "Summer Dress",
      reason: "Wrong Item",
      status: "PASSED",
    },
    {
      id: "RQC-004",
      returnId: "RET-2024-004",
      orderId: "ORD-2024-1004",
      sku: "SKU-SHIRT-004",
      product: "Formal Shirt",
      reason: "Damaged",
      status: "FAILED",
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
          <h1 className="text-3xl font-bold tracking-tight">Return QC</h1>
          <p className="text-muted-foreground">
            Quality check for returned items
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
                <p className="text-2xl font-bold">12</p>
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
                <p className="text-2xl font-bold">78%</p>
                <p className="text-sm text-muted-foreground">Resalable Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Failed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QC Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Return QC Queue</CardTitle>
          <CardDescription>Returned items awaiting quality inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QC ID</TableHead>
                <TableHead>Return ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Return Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnQCQueue.map((qc) => (
                <TableRow key={qc.id}>
                  <TableCell className="font-mono">{qc.id}</TableCell>
                  <TableCell className="font-mono text-sm">{qc.returnId}</TableCell>
                  <TableCell>{qc.orderId}</TableCell>
                  <TableCell className="font-medium">{qc.sku}</TableCell>
                  <TableCell>{qc.product}</TableCell>
                  <TableCell className="text-muted-foreground">{qc.reason}</TableCell>
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
