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
import { Search, Plus, Package, Clock, CheckCircle, Truck } from "lucide-react";

export default function ClientPurchaseOrdersPage() {
  const purchaseOrders = [
    {
      id: "PO-2024-001",
      supplier: "ABC Textiles",
      items: 5,
      totalQty: 500,
      receivedQty: 500,
      value: 125000,
      expectedDate: "2024-01-15",
      status: "RECEIVED",
    },
    {
      id: "PO-2024-002",
      supplier: "XYZ Fashion",
      items: 3,
      totalQty: 300,
      receivedQty: 150,
      value: 89000,
      expectedDate: "2024-01-16",
      status: "PARTIAL",
    },
    {
      id: "PO-2024-003",
      supplier: "DEF Garments",
      items: 8,
      totalQty: 800,
      receivedQty: 0,
      value: 245000,
      expectedDate: "2024-01-18",
      status: "IN_TRANSIT",
    },
    {
      id: "PO-2024-004",
      supplier: "GHI Apparels",
      items: 2,
      totalQty: 200,
      receivedQty: 0,
      value: 56000,
      expectedDate: "2024-01-20",
      status: "PENDING",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-purple-100 text-purple-800",
    PARTIAL: "bg-yellow-100 text-yellow-800",
    RECEIVED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage inbound purchase orders
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Pending POs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Partial Receipt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">45</p>
                <p className="text-sm text-muted-foreground">Received (MTD)</p>
              </div>
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
              <Input placeholder="Search by PO ID, Supplier..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PO Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>All purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.id}</TableCell>
                  <TableCell>{po.supplier}</TableCell>
                  <TableCell>{po.items}</TableCell>
                  <TableCell>{po.totalQty}</TableCell>
                  <TableCell>
                    <span className={po.receivedQty === po.totalQty ? "text-green-600" : po.receivedQty > 0 ? "text-yellow-600" : ""}>
                      {po.receivedQty}/{po.totalQty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold">₹{po.value.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{po.expectedDate}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[po.status]}>
                      {po.status.replace(/_/g, " ")}
                    </Badge>
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
