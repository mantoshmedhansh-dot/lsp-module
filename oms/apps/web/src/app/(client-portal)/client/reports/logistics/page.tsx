"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Truck, CheckCircle, Clock, RotateCcw } from "lucide-react";

export default function ClientLogisticsReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics Reports</h1>
          <p className="text-muted-foreground">
            Shipping and delivery performance reports
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="mtd">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3,456</p>
                <p className="text-sm text-muted-foreground">Total Shipments</p>
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
                <p className="text-sm text-muted-foreground">Delivery Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">3.2 days</p>
                <p className="text-sm text-muted-foreground">Avg Delivery Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">2.8%</p>
                <p className="text-sm text-muted-foreground">RTO Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Courier Performance</CardTitle>
            <CardDescription>Delivery metrics by courier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Delhivery", shipments: 1250, deliveryRate: "96.5%", avgDays: "3.2" },
                { name: "BlueDart", shipments: 890, deliveryRate: "97.8%", avgDays: "2.8" },
                { name: "Ekart", shipments: 650, deliveryRate: "95.2%", avgDays: "4.1" },
              ].map((courier) => (
                <div key={courier.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{courier.name}</span>
                  <div className="flex gap-6 text-sm">
                    <span>{courier.shipments} shipments</span>
                    <span className="text-green-600">{courier.deliveryRate}</span>
                    <span className="text-muted-foreground">{courier.avgDays} days</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zone-wise Distribution</CardTitle>
            <CardDescription>Shipments by delivery zone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { zone: "Metro", shipments: 1800, percentage: "52%" },
                { zone: "Regional", shipments: 1100, percentage: "32%" },
                { zone: "Remote", shipments: 556, percentage: "16%" },
              ].map((zone) => (
                <div key={zone.zone} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{zone.zone}</span>
                  <div className="flex gap-6 text-sm">
                    <span>{zone.shipments} shipments</span>
                    <span className="text-blue-600 font-medium">{zone.percentage}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
