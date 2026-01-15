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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, ArrowUp, ArrowDown, Clock } from "lucide-react";

export default function ClientStockAdjustmentPage() {
  const adjustments = [
    {
      id: "ADJ-001",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      type: "INCREASE",
      quantity: 50,
      reason: "New stock received",
      warehouse: "Mumbai",
      date: "2024-01-15 10:30",
      status: "APPROVED",
    },
    {
      id: "ADJ-002",
      sku: "SKU-JEANS-002",
      product: "Slim Fit Jeans",
      type: "DECREASE",
      quantity: 5,
      reason: "Damaged goods",
      warehouse: "Delhi",
      date: "2024-01-15 09:45",
      status: "PENDING",
    },
    {
      id: "ADJ-003",
      sku: "SKU-DRESS-003",
      product: "Summer Dress",
      type: "INCREASE",
      quantity: 100,
      reason: "Purchase order received",
      warehouse: "Mumbai",
      date: "2024-01-14 16:20",
      status: "APPROVED",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Adjustment</h1>
          <p className="text-muted-foreground">
            Create and manage inventory adjustments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Adjustment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">+1,250</p>
                <p className="text-sm text-muted-foreground">Units Added (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">-89</p>
                <p className="text-sm text-muted-foreground">Units Removed (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">45</p>
              <p className="text-sm text-muted-foreground">Adjustments This Month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by SKU or Product..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="increase">Increase</SelectItem>
                <SelectItem value="decrease">Decrease</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
          <CardDescription>Recent stock adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adj) => (
                <TableRow key={adj.id}>
                  <TableCell className="font-mono">{adj.id}</TableCell>
                  <TableCell className="font-medium">{adj.sku}</TableCell>
                  <TableCell>{adj.product}</TableCell>
                  <TableCell>
                    <span className={`flex items-center gap-1 ${adj.type === "INCREASE" ? "text-green-600" : "text-red-600"}`}>
                      {adj.type === "INCREASE" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      {adj.type}
                    </span>
                  </TableCell>
                  <TableCell className={`font-bold ${adj.type === "INCREASE" ? "text-green-600" : "text-red-600"}`}>
                    {adj.type === "INCREASE" ? "+" : "-"}{adj.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{adj.reason}</TableCell>
                  <TableCell>{adj.warehouse}</TableCell>
                  <TableCell className="text-muted-foreground">{adj.date}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[adj.status]}>{adj.status}</Badge>
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
