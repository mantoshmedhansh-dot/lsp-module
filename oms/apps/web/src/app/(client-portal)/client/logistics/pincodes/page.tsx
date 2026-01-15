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
import { Search, MapPin, CheckCircle } from "lucide-react";

export default function ClientServicePincodesPage() {
  const pincodes = [
    { pincode: "400001", city: "Mumbai", state: "Maharashtra", zone: "Metro", couriers: ["Delhivery", "BlueDart", "Ekart"], cod: true },
    { pincode: "110001", city: "New Delhi", state: "Delhi", zone: "Metro", couriers: ["Delhivery", "BlueDart", "Ekart"], cod: true },
    { pincode: "560001", city: "Bangalore", state: "Karnataka", zone: "Metro", couriers: ["Delhivery", "BlueDart", "Ekart"], cod: true },
    { pincode: "600001", city: "Chennai", state: "Tamil Nadu", zone: "Metro", couriers: ["Delhivery", "Ekart"], cod: true },
    { pincode: "700001", city: "Kolkata", state: "West Bengal", zone: "Metro", couriers: ["Delhivery", "DTDC"], cod: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Pincodes</h1>
          <p className="text-muted-foreground">
            Check serviceability by pincode
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">28,500</p>
                <p className="text-sm text-muted-foreground">Serviceable Pincodes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">26,800</p>
                <p className="text-sm text-muted-foreground">COD Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">95%</p>
              <p className="text-sm text-muted-foreground">India Coverage</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Enter pincode to check serviceability..." className="pl-10" />
            </div>
            <Button>Check</Button>
          </div>
        </CardContent>
      </Card>

      {/* Pincodes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Serviceable Pincodes</CardTitle>
          <CardDescription>Metro cities coverage</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pincode</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Couriers</TableHead>
                <TableHead>COD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pincodes.map((pin) => (
                <TableRow key={pin.pincode}>
                  <TableCell className="font-mono font-medium">{pin.pincode}</TableCell>
                  <TableCell>{pin.city}</TableCell>
                  <TableCell>{pin.state}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pin.zone}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {pin.couriers.map((c) => (
                        <Badge key={c} className="bg-blue-50 text-blue-700 text-xs">{c}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pin.cod ? (
                      <Badge className="bg-green-100 text-green-800">Yes</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">No</Badge>
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
