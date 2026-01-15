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

export default function ClientInboundQCPage() {
  const qcQueue = [
    {
      id: "QC-INB-001",
      asnNumber: "ASN-2024-001",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      quantity: 100,
      inspected: 100,
      passed: 98,
      failed: 2,
      status: "COMPLETED",
    },
    {
      id: "QC-INB-002",
      asnNumber: "ASN-2024-001",
      sku: "SKU-JEANS-002",
      product: "Slim Fit Jeans",
      quantity: 50,
      inspected: 30,
      passed: 28,
      failed: 2,
      status: "IN_PROGRESS",
    },
    {
      id: "QC-INB-003",
      asnNumber: "ASN-2024-002",
      sku: "SKU-DRESS-003",
      product: "Summer Dress",
      quantity: 75,
      inspected: 0,
      passed: 0,
      failed: 0,
      status: "PENDING",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbound QC</h1>
          <p className="text-muted-foreground">
            Quality check for received goods
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
                <p className="text-2xl font-bold">5</p>
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
                <p className="text-2xl font-bold">98.5%</p>
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
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Rejected Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QC Queue */}
      <Card>
        <CardHeader>
          <CardTitle>QC Queue</CardTitle>
          <CardDescription>Items awaiting quality inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QC ID</TableHead>
                <TableHead>ASN</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Passed</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qcQueue.map((qc) => (
                <TableRow key={qc.id}>
                  <TableCell className="font-mono">{qc.id}</TableCell>
                  <TableCell className="font-mono text-sm">{qc.asnNumber}</TableCell>
                  <TableCell className="font-medium">{qc.sku}</TableCell>
                  <TableCell>{qc.product}</TableCell>
                  <TableCell>{qc.quantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(qc.inspected / qc.quantity) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {qc.inspected}/{qc.quantity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">{qc.passed}</TableCell>
                  <TableCell className={qc.failed > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                    {qc.failed}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[qc.status]}>
                      {qc.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {qc.status === "PENDING" ? (
                      <Button size="sm">Start QC</Button>
                    ) : qc.status === "IN_PROGRESS" ? (
                      <Button size="sm">Continue</Button>
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
