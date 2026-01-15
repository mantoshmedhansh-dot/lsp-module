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
import { Plus, Truck, Clock, CheckCircle, Package } from "lucide-react";

export default function ClientASNPage() {
  const asnList = [
    {
      id: "ASN-2024-001",
      poNumber: "PO-2024-001",
      supplier: "ABC Textiles",
      items: 5,
      totalQty: 500,
      expectedDate: "2024-01-15",
      arrivalTime: "10:00 AM",
      status: "ARRIVED",
    },
    {
      id: "ASN-2024-002",
      poNumber: "PO-2024-002",
      supplier: "XYZ Fashion",
      items: 3,
      totalQty: 150,
      expectedDate: "2024-01-16",
      arrivalTime: "2:00 PM",
      status: "IN_TRANSIT",
    },
    {
      id: "ASN-2024-003",
      poNumber: "PO-2024-003",
      supplier: "DEF Garments",
      items: 8,
      totalQty: 800,
      expectedDate: "2024-01-18",
      arrivalTime: "-",
      status: "SCHEDULED",
    },
  ];

  const statusColors: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-800",
    IN_TRANSIT: "bg-blue-100 text-blue-800",
    ARRIVED: "bg-purple-100 text-purple-800",
    RECEIVING: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ASN / Receiving</h1>
          <p className="text-muted-foreground">
            Advanced Shipping Notices and goods receiving
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create ASN
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Scheduled Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Awaiting Receiving</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Received Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ASN Table */}
      <Card>
        <CardHeader>
          <CardTitle>ASN List</CardTitle>
          <CardDescription>Upcoming and recent shipments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ASN Number</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asnList.map((asn) => (
                <TableRow key={asn.id}>
                  <TableCell className="font-medium">{asn.id}</TableCell>
                  <TableCell className="font-mono text-sm">{asn.poNumber}</TableCell>
                  <TableCell>{asn.supplier}</TableCell>
                  <TableCell>{asn.items}</TableCell>
                  <TableCell>{asn.totalQty}</TableCell>
                  <TableCell>{asn.expectedDate}</TableCell>
                  <TableCell className="text-muted-foreground">{asn.arrivalTime}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[asn.status]}>
                      {asn.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {asn.status === "ARRIVED" ? (
                      <Button size="sm">Start Receiving</Button>
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
