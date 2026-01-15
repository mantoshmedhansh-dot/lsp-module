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
import { IndianRupee, Clock, CheckCircle, Download } from "lucide-react";

export default function ClientCODReconciliationPage() {
  const remittances = [
    {
      id: "REM-001",
      courier: "Delhivery",
      shipments: 45,
      codAmount: 125000,
      deductions: 2500,
      netAmount: 122500,
      expectedDate: "2024-01-18",
      status: "PENDING",
    },
    {
      id: "REM-002",
      courier: "BlueDart",
      shipments: 32,
      codAmount: 89000,
      deductions: 1780,
      netAmount: 87220,
      expectedDate: "2024-01-17",
      status: "RECEIVED",
    },
    {
      id: "REM-003",
      courier: "Ekart",
      shipments: 28,
      codAmount: 67500,
      deductions: 1350,
      netAmount: 66150,
      expectedDate: "2024-01-19",
      status: "PROCESSING",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    RECEIVED: "bg-green-100 text-green-800",
    DISPUTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">COD Reconciliation</h1>
          <p className="text-muted-foreground">
            Track COD remittances from couriers
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹8,90,000</p>
                <p className="text-sm text-muted-foreground">Total COD (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹5,45,000</p>
                <p className="text-sm text-muted-foreground">Received</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">₹3,45,000</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">3.2 days</p>
              <p className="text-sm text-muted-foreground">Avg Remittance Time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                <SelectItem value="delhivery">Delhivery</SelectItem>
                <SelectItem value="bluedart">BlueDart</SelectItem>
                <SelectItem value="ekart">Ekart</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Remittances Table */}
      <Card>
        <CardHeader>
          <CardTitle>Remittance Batches</CardTitle>
          <CardDescription>COD remittance batches from couriers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead className="text-right">COD Amount</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Amount</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remittances.map((rem) => (
                <TableRow key={rem.id}>
                  <TableCell className="font-mono">{rem.id}</TableCell>
                  <TableCell className="font-medium">{rem.courier}</TableCell>
                  <TableCell>{rem.shipments}</TableCell>
                  <TableCell className="text-right">₹{rem.codAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-600">-₹{rem.deductions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold">₹{rem.netAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{rem.expectedDate}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[rem.status]}>{rem.status}</Badge>
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
