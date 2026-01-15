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
import { IndianRupee, Truck } from "lucide-react";

export default function ClientRateCardsPage() {
  const rateCards = [
    {
      courier: "Delhivery",
      zone: "Local",
      baseRate: 35,
      perKg: 15,
      codCharge: 25,
      status: "ACTIVE",
    },
    {
      courier: "Delhivery",
      zone: "Metro",
      baseRate: 45,
      perKg: 20,
      codCharge: 30,
      status: "ACTIVE",
    },
    {
      courier: "Delhivery",
      zone: "Regional",
      baseRate: 55,
      perKg: 25,
      codCharge: 35,
      status: "ACTIVE",
    },
    {
      courier: "BlueDart",
      zone: "Local",
      baseRate: 50,
      perKg: 20,
      codCharge: 30,
      status: "ACTIVE",
    },
    {
      courier: "BlueDart",
      zone: "Metro",
      baseRate: 65,
      perKg: 25,
      codCharge: 35,
      status: "ACTIVE",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Cards</h1>
          <p className="text-muted-foreground">
            View shipping rates by courier and zone
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
                <p className="text-sm text-muted-foreground">Couriers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹45</p>
                <p className="text-sm text-muted-foreground">Avg Base Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">5</p>
              <p className="text-sm text-muted-foreground">Zones Covered</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Rates</CardTitle>
          <CardDescription>Rate cards by courier and zone</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Courier</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead className="text-right">Per Kg</TableHead>
                <TableHead className="text-right">COD Charge</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rateCards.map((rate, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{rate.courier}</TableCell>
                  <TableCell>{rate.zone}</TableCell>
                  <TableCell className="text-right">₹{rate.baseRate}</TableCell>
                  <TableCell className="text-right">₹{rate.perKg}</TableCell>
                  <TableCell className="text-right">₹{rate.codCharge}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">{rate.status}</Badge>
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
