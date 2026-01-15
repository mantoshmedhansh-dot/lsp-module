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
import { Scale, AlertTriangle, CheckCircle, Clock, IndianRupee } from "lucide-react";

export default function ClientWeightDiscrepancyPage() {
  const discrepancies = [
    {
      awb: "DEL123456789",
      orderId: "ORD-2024-1001",
      courier: "Delhivery",
      declaredWeight: "0.5 kg",
      chargedWeight: "1.0 kg",
      difference: "0.5 kg",
      extraCharge: 45,
      status: "PENDING",
    },
    {
      awb: "BLU987654321",
      orderId: "ORD-2024-1002",
      courier: "BlueDart",
      declaredWeight: "1.2 kg",
      chargedWeight: "2.0 kg",
      difference: "0.8 kg",
      extraCharge: 80,
      status: "DISPUTED",
    },
    {
      awb: "EKT456789123",
      orderId: "ORD-2024-1003",
      courier: "Ekart",
      declaredWeight: "0.8 kg",
      chargedWeight: "0.8 kg",
      difference: "0.0 kg",
      extraCharge: 0,
      status: "RESOLVED",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    DISPUTED: "bg-red-100 text-red-800",
    RESOLVED: "bg-green-100 text-green-800",
    ACCEPTED: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weight Discrepancy</h1>
          <p className="text-muted-foreground">
            Review and dispute weight discrepancies
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">23</p>
                <p className="text-sm text-muted-foreground">Discrepancies (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">₹8,900</p>
                <p className="text-sm text-muted-foreground">Extra Charged</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹3,200</p>
                <p className="text-sm text-muted-foreground">Refunded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weight Discrepancies</CardTitle>
          <CardDescription>Shipments with weight differences</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AWB</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Declared</TableHead>
                <TableHead>Charged</TableHead>
                <TableHead>Difference</TableHead>
                <TableHead className="text-right">Extra Charge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discrepancies.map((disc) => (
                <TableRow key={disc.awb}>
                  <TableCell className="font-mono">{disc.awb}</TableCell>
                  <TableCell>{disc.orderId}</TableCell>
                  <TableCell>{disc.courier}</TableCell>
                  <TableCell>{disc.declaredWeight}</TableCell>
                  <TableCell>{disc.chargedWeight}</TableCell>
                  <TableCell className={disc.difference !== "0.0 kg" ? "text-red-600 font-medium" : ""}>
                    {disc.difference}
                  </TableCell>
                  <TableCell className="text-right">
                    {disc.extraCharge > 0 ? (
                      <span className="text-red-600 font-medium">₹{disc.extraCharge}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[disc.status]}>{disc.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {disc.status === "PENDING" && (
                      <Button variant="outline" size="sm">Dispute</Button>
                    )}
                    {disc.status === "DISPUTED" && (
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
