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
import { FileText, IndianRupee, CheckCircle, Clock, Download } from "lucide-react";

export default function ClientFreightBillingPage() {
  const invoices = [
    {
      id: "INV-DEL-001",
      courier: "Delhivery",
      period: "Jan 1-15, 2024",
      shipments: 450,
      amount: 45000,
      gst: 8100,
      total: 53100,
      status: "PENDING",
    },
    {
      id: "INV-BLU-001",
      courier: "BlueDart",
      period: "Jan 1-15, 2024",
      shipments: 320,
      amount: 38400,
      gst: 6912,
      total: 45312,
      status: "PAID",
    },
    {
      id: "INV-EKT-001",
      courier: "Ekart",
      period: "Jan 1-15, 2024",
      shipments: 280,
      amount: 28000,
      gst: 5040,
      total: 33040,
      status: "DISPUTED",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800",
    DISPUTED: "bg-red-100 text-red-800",
    OVERDUE: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Freight Billing</h1>
          <p className="text-muted-foreground">
            View and manage courier freight invoices
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">₹1,31,452</p>
                <p className="text-sm text-muted-foreground">Total Billed (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹45,312</p>
                <p className="text-sm text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">₹53,100</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Invoices (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Freight Invoices</CardTitle>
          <CardDescription>Courier billing invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono">{inv.id}</TableCell>
                  <TableCell className="font-medium">{inv.courier}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.period}</TableCell>
                  <TableCell>{inv.shipments}</TableCell>
                  <TableCell className="text-right">₹{inv.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">₹{inv.gst.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">₹{inv.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[inv.status]}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
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
