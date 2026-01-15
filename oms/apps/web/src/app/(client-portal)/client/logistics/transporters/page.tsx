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
import { Truck, CheckCircle, Settings } from "lucide-react";

export default function ClientTransportersPage() {
  const couriers = [
    {
      id: "1",
      name: "Delhivery",
      type: "EXPRESS",
      status: "ACTIVE",
      shipments: 1250,
      deliveryRate: 96.5,
      avgDays: 3.2,
    },
    {
      id: "2",
      name: "BlueDart",
      type: "EXPRESS",
      status: "ACTIVE",
      shipments: 890,
      deliveryRate: 97.8,
      avgDays: 2.8,
    },
    {
      id: "3",
      name: "Ekart",
      type: "STANDARD",
      status: "ACTIVE",
      shipments: 650,
      deliveryRate: 95.2,
      avgDays: 4.1,
    },
    {
      id: "4",
      name: "DTDC",
      type: "ECONOMY",
      status: "ACTIVE",
      shipments: 420,
      deliveryRate: 94.0,
      avgDays: 5.2,
    },
  ];

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
  };

  const typeColors: Record<string, string> = {
    EXPRESS: "bg-purple-100 text-purple-800",
    STANDARD: "bg-blue-100 text-blue-800",
    ECONOMY: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courier Partners</h1>
          <p className="text-muted-foreground">
            View connected courier partners
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-sm text-muted-foreground">Active Couriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">96.2%</p>
                <p className="text-sm text-muted-foreground">Avg Delivery Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">3.8 days</p>
              <p className="text-sm text-muted-foreground">Avg Delivery Time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Couriers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {couriers.map((courier) => (
          <Card key={courier.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {courier.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{courier.name}</CardTitle>
                    <Badge className={typeColors[courier.type]}>{courier.type}</Badge>
                  </div>
                </div>
                <Badge className={statusColors[courier.status]}>{courier.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipments (MTD)</span>
                  <span className="font-medium">{courier.shipments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Rate</span>
                  <span className="text-green-600 font-medium">{courier.deliveryRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Delivery</span>
                  <span className="text-muted-foreground">{courier.avgDays} days</span>
                </div>
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
