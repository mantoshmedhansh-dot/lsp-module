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
import { Truck, Package, Clock, CheckCircle, AlertTriangle, RotateCcw } from "lucide-react";

export default function ClientLogisticsDashboardPage() {
  const courierStats = [
    { name: "Delhivery", shipped: 45, delivered: 38, rto: 2, pending: 5 },
    { name: "BlueDart", shipped: 32, delivered: 28, rto: 1, pending: 3 },
    { name: "Ekart", shipped: 28, delivered: 25, rto: 0, pending: 3 },
    { name: "DTDC", shipped: 15, delivered: 12, rto: 1, pending: 2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor shipping performance and delivery metrics
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">156</p>
                <p className="text-sm text-muted-foreground">Shipped Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
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
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Delayed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">RTO</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Courier Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Courier Performance</CardTitle>
          <CardDescription>Today's shipment breakdown by courier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {courierStats.map((courier) => (
              <Card key={courier.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{courier.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipped</span>
                      <span className="font-medium">{courier.shipped}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivered</span>
                      <span className="text-green-600 font-medium">{courier.delivered}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="text-yellow-600 font-medium">{courier.pending}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">RTO</span>
                      <span className={courier.rto > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>{courier.rto}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common logistics operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline">Generate AWB</Button>
            <Button variant="outline">Schedule Pickup</Button>
            <Button variant="outline">Track Shipments</Button>
            <Button variant="outline">View Pending</Button>
            <Button variant="outline">Download Reports</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
