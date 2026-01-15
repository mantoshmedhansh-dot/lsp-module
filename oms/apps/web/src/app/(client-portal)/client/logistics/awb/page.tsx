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
import { Search, Plus, FileText, CheckCircle, Clock } from "lucide-react";

export default function ClientAWBPage() {
  const awbList = [
    {
      awb: "DEL123456789",
      orderId: "ORD-2024-1001",
      courier: "Delhivery",
      destination: "Mumbai, MH",
      weight: "0.5 kg",
      status: "SHIPPED",
      createdAt: "2024-01-15 10:30",
    },
    {
      awb: "BLU987654321",
      orderId: "ORD-2024-1002",
      courier: "BlueDart",
      destination: "Delhi, DL",
      weight: "1.2 kg",
      status: "IN_TRANSIT",
      createdAt: "2024-01-15 09:45",
    },
    {
      awb: "EKT456789123",
      orderId: "ORD-2024-1003",
      courier: "Ekart",
      destination: "Bangalore, KA",
      weight: "0.8 kg",
      status: "DELIVERED",
      createdAt: "2024-01-14 16:20",
    },
  ];

  const statusColors: Record<string, string> = {
    GENERATED: "bg-gray-100 text-gray-800",
    SHIPPED: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-purple-100 text-purple-800",
    OUT_FOR_DELIVERY: "bg-yellow-100 text-yellow-800",
    DELIVERED: "bg-green-100 text-green-800",
    RTO: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AWB Management</h1>
          <p className="text-muted-foreground">
            Manage airway bills and shipment tracking
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Generate AWB
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
                <p className="text-sm text-muted-foreground">AWBs Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Pending Pickup</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">3,450</p>
                <p className="text-sm text-muted-foreground">AWBs (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">98.5%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
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
              <Input placeholder="Search by AWB or Order ID..." className="pl-10" />
            </div>
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
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AWB Table */}
      <Card>
        <CardHeader>
          <CardTitle>AWB List</CardTitle>
          <CardDescription>Recent shipment airway bills</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AWB Number</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awbList.map((awb) => (
                <TableRow key={awb.awb}>
                  <TableCell className="font-mono font-medium">{awb.awb}</TableCell>
                  <TableCell>{awb.orderId}</TableCell>
                  <TableCell>{awb.courier}</TableCell>
                  <TableCell>{awb.destination}</TableCell>
                  <TableCell>{awb.weight}</TableCell>
                  <TableCell className="text-muted-foreground">{awb.createdAt}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[awb.status]}>
                      {awb.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Track</Button>
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
