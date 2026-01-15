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
import { Search, MapPin, Truck, CheckCircle, Clock } from "lucide-react";

export default function ClientTrackingPage() {
  const recentShipments = [
    {
      awb: "DEL123456789",
      orderId: "ORD-2024-1001",
      courier: "Delhivery",
      destination: "Mumbai, MH",
      lastUpdate: "Out for delivery",
      status: "OUT_FOR_DELIVERY",
    },
    {
      awb: "BLU987654321",
      orderId: "ORD-2024-1002",
      courier: "BlueDart",
      destination: "Delhi, DL",
      lastUpdate: "In transit - Gurgaon Hub",
      status: "IN_TRANSIT",
    },
    {
      awb: "EKT456789123",
      orderId: "ORD-2024-1003",
      courier: "Ekart",
      destination: "Bangalore, KA",
      lastUpdate: "Delivered",
      status: "DELIVERED",
    },
  ];

  const statusColors: Record<string, string> = {
    PICKED_UP: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-purple-100 text-purple-800",
    OUT_FOR_DELIVERY: "bg-yellow-100 text-yellow-800",
    DELIVERED: "bg-green-100 text-green-800",
    RTO: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipment Tracking</h1>
          <p className="text-muted-foreground">
            Track shipments in real-time
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">423</p>
                <p className="text-sm text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">45</p>
                <p className="text-sm text-muted-foreground">Out for Delivery</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">89</p>
                <p className="text-sm text-muted-foreground">Delivered Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Enter AWB number or Order ID to track..." className="pl-10" />
            </div>
            <Button>Track</Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Shipments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
          <CardDescription>Track your recent shipments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AWB Number</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentShipments.map((shipment) => (
                <TableRow key={shipment.awb}>
                  <TableCell className="font-mono font-medium">{shipment.awb}</TableCell>
                  <TableCell>{shipment.orderId}</TableCell>
                  <TableCell>{shipment.courier}</TableCell>
                  <TableCell>{shipment.destination}</TableCell>
                  <TableCell className="text-muted-foreground">{shipment.lastUpdate}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[shipment.status]}>
                      {shipment.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">Track</Button>
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
