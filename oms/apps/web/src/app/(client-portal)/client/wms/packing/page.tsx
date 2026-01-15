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
import { Search, PackageCheck, Clock, CheckCircle, Box } from "lucide-react";

export default function ClientPackingPage() {
  const packingQueue = [
    {
      id: "ORD-2024-1001",
      channel: "Amazon",
      items: 3,
      picker: "Raj Kumar",
      pickedAt: "10:15 AM",
      packingStation: "Station 1",
      status: "PACKING",
    },
    {
      id: "ORD-2024-1002",
      channel: "Flipkart",
      items: 1,
      picker: "Amit Singh",
      pickedAt: "10:20 AM",
      packingStation: "-",
      status: "READY",
    },
    {
      id: "ORD-2024-1003",
      channel: "Myntra",
      items: 2,
      picker: "Priya Sharma",
      pickedAt: "10:25 AM",
      packingStation: "Station 2",
      status: "PACKED",
    },
  ];

  const statusColors: Record<string, string> = {
    READY: "bg-blue-100 text-blue-800",
    PACKING: "bg-yellow-100 text-yellow-800",
    PACKED: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packing</h1>
          <p className="text-muted-foreground">
            Pack picked orders for shipment
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Ready to Pack</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-sm text-muted-foreground">Packed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">4 min</p>
              <p className="text-sm text-muted-foreground">Avg Pack Time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Scan order barcode or enter Order ID..." className="pl-10" />
            </div>
            <Button>Start Packing</Button>
          </div>
        </CardContent>
      </Card>

      {/* Packing Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Packing Queue</CardTitle>
          <CardDescription>Orders ready for packing</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Picker</TableHead>
                <TableHead>Picked At</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packingQueue.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.channel}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell>{order.picker}</TableCell>
                  <TableCell className="text-muted-foreground">{order.pickedAt}</TableCell>
                  <TableCell>{order.packingStation !== "-" ? order.packingStation : <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[order.status]}>{order.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {order.status === "READY" ? (
                      <Button size="sm">Pack</Button>
                    ) : order.status === "PACKING" ? (
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
