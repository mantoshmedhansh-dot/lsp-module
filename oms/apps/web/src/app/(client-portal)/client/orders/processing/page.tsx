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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Clock, AlertTriangle, CheckCircle, Package } from "lucide-react";

export default function ClientOrderProcessingPage() {
  const pendingOrders = [
    {
      id: "ORD-2024-1001",
      channel: "Amazon",
      customer: "Rahul Sharma",
      items: 3,
      total: 4599,
      age: "2h",
      priority: "HIGH",
      warehouse: "Mumbai",
    },
    {
      id: "ORD-2024-1002",
      channel: "Flipkart",
      customer: "Priya Patel",
      items: 1,
      total: 1299,
      age: "1h",
      priority: "NORMAL",
      warehouse: "Delhi",
    },
    {
      id: "ORD-2024-1003",
      channel: "Myntra",
      customer: "Amit Kumar",
      items: 2,
      total: 2899,
      age: "45m",
      priority: "NORMAL",
      warehouse: "Mumbai",
    },
    {
      id: "ORD-2024-1005",
      channel: "Amazon",
      customer: "Vikram Singh",
      items: 1,
      total: 899,
      age: "30m",
      priority: "LOW",
      warehouse: "Bangalore",
    },
  ];

  const priorityColors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800",
    NORMAL: "bg-blue-100 text-blue-800",
    LOW: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Processing</h1>
          <p className="text-muted-foreground">
            Process pending orders for fulfillment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Package className="h-4 w-4 mr-2" />
            Allocate Selected
          </Button>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Process All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">89</p>
                <p className="text-sm text-muted-foreground">Ready to Ship</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">134</p>
                <p className="text-sm text-muted-foreground">Processed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Orders</CardTitle>
          <CardDescription>Orders awaiting processing and allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox />
                </TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.channel}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell className="text-right font-bold">
                    ₹{order.total.toLocaleString()}
                  </TableCell>
                  <TableCell>{order.warehouse}</TableCell>
                  <TableCell className="text-muted-foreground">{order.age}</TableCell>
                  <TableCell>
                    <Badge className={priorityColors[order.priority]}>{order.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">Process</Button>
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
