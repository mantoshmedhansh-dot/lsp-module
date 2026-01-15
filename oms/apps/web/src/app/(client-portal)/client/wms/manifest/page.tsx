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
import { Plus, FileText, Truck, CheckCircle, Clock } from "lucide-react";

export default function ClientManifestPage() {
  const manifests = [
    {
      id: "MAN-001",
      courier: "Delhivery",
      shipments: 45,
      createdAt: "2024-01-15 10:00",
      closedAt: "2024-01-15 11:30",
      status: "CLOSED",
    },
    {
      id: "MAN-002",
      courier: "BlueDart",
      shipments: 23,
      createdAt: "2024-01-15 10:15",
      closedAt: "-",
      status: "OPEN",
    },
    {
      id: "MAN-003",
      courier: "Ekart",
      shipments: 38,
      createdAt: "2024-01-15 09:30",
      closedAt: "2024-01-15 10:45",
      status: "HANDED_OVER",
    },
  ];

  const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-800",
    CLOSED: "bg-yellow-100 text-yellow-800",
    HANDED_OVER: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manifest</h1>
          <p className="text-muted-foreground">
            Manage courier manifests
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Manifest
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Open Manifests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Awaiting Pickup</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
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
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Handed Over Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manifests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Manifests</CardTitle>
          <CardDescription>Today's courier manifests</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manifest ID</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manifests.map((man) => (
                <TableRow key={man.id}>
                  <TableCell className="font-mono">{man.id}</TableCell>
                  <TableCell className="font-medium">{man.courier}</TableCell>
                  <TableCell>{man.shipments}</TableCell>
                  <TableCell className="text-muted-foreground">{man.createdAt}</TableCell>
                  <TableCell className="text-muted-foreground">{man.closedAt}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[man.status]}>
                      {man.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {man.status === "OPEN" ? (
                      <Button size="sm">Close Manifest</Button>
                    ) : man.status === "CLOSED" ? (
                      <Button variant="outline" size="sm">Print & Handover</Button>
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
