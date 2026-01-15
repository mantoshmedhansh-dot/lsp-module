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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Download, IndianRupee, CheckCircle } from "lucide-react";

export default function ClientInvoicesPage() {
  const invoices = [
    {
      id: "GST-INV-001",
      orderId: "ORD-2024-1001",
      customer: "Rahul Sharma",
      amount: 4599,
      gst: 828,
      total: 5427,
      date: "2024-01-15",
      status: "GENERATED",
    },
    {
      id: "GST-INV-002",
      orderId: "ORD-2024-1002",
      customer: "Priya Patel",
      amount: 1299,
      gst: 234,
      total: 1533,
      date: "2024-01-15",
      status: "GENERATED",
    },
    {
      id: "GST-INV-003",
      orderId: "ORD-2024-1003",
      customer: "Amit Kumar",
      amount: 2899,
      gst: 522,
      total: 3421,
      date: "2024-01-14",
      status: "SENT",
    },
  ];

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    GENERATED: "bg-blue-100 text-blue-800",
    SENT: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            GST invoices for orders
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Bulk Download
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-sm text-muted-foreground">Invoices (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹4,56,789</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹82,222</p>
                <p className="text-sm text-muted-foreground">GST Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">18%</p>
              <p className="text-sm text-muted-foreground">GST Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by Invoice ID or Order ID..." className="pl-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>GST Invoices</CardTitle>
          <CardDescription>Generated invoices for orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono">{inv.id}</TableCell>
                  <TableCell>{inv.orderId}</TableCell>
                  <TableCell>{inv.customer}</TableCell>
                  <TableCell className="text-right">₹{inv.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">₹{inv.gst.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">₹{inv.total.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[inv.status]}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
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
