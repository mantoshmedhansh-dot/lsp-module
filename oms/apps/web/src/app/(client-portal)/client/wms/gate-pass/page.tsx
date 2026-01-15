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
import { Plus, FileCheck, Truck, Clock, CheckCircle } from "lucide-react";

export default function ClientGatePassPage() {
  const gatePasses = [
    {
      id: "GP-001",
      type: "OUTBOUND",
      courier: "Delhivery",
      vehicle: "MH-12-AB-1234",
      driver: "Ramesh Kumar",
      packages: 45,
      createdAt: "2024-01-15 11:30",
      status: "APPROVED",
    },
    {
      id: "GP-002",
      type: "INBOUND",
      courier: "ABC Logistics",
      vehicle: "MH-01-CD-5678",
      driver: "Suresh Singh",
      packages: 120,
      createdAt: "2024-01-15 10:00",
      status: "COMPLETED",
    },
    {
      id: "GP-003",
      type: "OUTBOUND",
      courier: "BlueDart",
      vehicle: "DL-05-EF-9012",
      driver: "Vikram Patel",
      packages: 23,
      createdAt: "2024-01-15 12:00",
      status: "PENDING",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const typeColors: Record<string, string> = {
    INBOUND: "bg-purple-100 text-purple-800",
    OUTBOUND: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gate Pass</h1>
          <p className="text-muted-foreground">
            Manage vehicle entry and exit
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Gate Pass
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Vehicles In Premises</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Inbound Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Outbound Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gate Pass Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gate Passes</CardTitle>
          <CardDescription>Today's vehicle gate passes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gate Pass ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Courier/Vendor</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Packages</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gatePasses.map((gp) => (
                <TableRow key={gp.id}>
                  <TableCell className="font-mono">{gp.id}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[gp.type]}>{gp.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{gp.courier}</TableCell>
                  <TableCell className="font-mono">{gp.vehicle}</TableCell>
                  <TableCell>{gp.driver}</TableCell>
                  <TableCell>{gp.packages}</TableCell>
                  <TableCell className="text-muted-foreground">{gp.createdAt}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[gp.status]}>{gp.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {gp.status === "PENDING" ? (
                      <Button size="sm">Approve</Button>
                    ) : gp.status === "APPROVED" ? (
                      <Button variant="outline" size="sm">Complete Exit</Button>
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
