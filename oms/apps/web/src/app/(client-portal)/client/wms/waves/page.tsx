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
import { Plus, Play, Layers, Clock, CheckCircle, Users } from "lucide-react";

export default function ClientWavePickingPage() {
  const waves = [
    {
      id: "WAVE-001",
      name: "Morning Rush",
      type: "BATCH_PICK",
      orders: 45,
      items: 120,
      pickers: 3,
      progress: 85,
      status: "IN_PROGRESS",
      created: "2024-01-15 08:00",
    },
    {
      id: "WAVE-002",
      name: "Zone A Priority",
      type: "ZONE_PICK",
      orders: 20,
      items: 45,
      pickers: 1,
      progress: 100,
      status: "COMPLETED",
      created: "2024-01-15 07:30",
    },
    {
      id: "WAVE-003",
      name: "Afternoon Batch",
      type: "BATCH_PICK",
      orders: 60,
      items: 180,
      pickers: 0,
      progress: 0,
      status: "PLANNED",
      created: "2024-01-15 09:00",
    },
  ];

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    PLANNED: "bg-blue-100 text-blue-800",
    RELEASED: "bg-purple-100 text-purple-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const typeColors: Record<string, string> = {
    BATCH_PICK: "bg-blue-50 text-blue-700",
    ZONE_PICK: "bg-purple-50 text-purple-700",
    CLUSTER_PICK: "bg-orange-50 text-orange-700",
    PRIORITY_PICK: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wave Picking</h1>
          <p className="text-muted-foreground">
            Manage picking waves and assignments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Wave
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Active Waves</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">125</p>
                <p className="text-sm text-muted-foreground">Orders in Waves</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-sm text-muted-foreground">Active Pickers</p>
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
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Waves Table */}
      <Card>
        <CardHeader>
          <CardTitle>Picking Waves</CardTitle>
          <CardDescription>Manage order picking waves</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wave ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Pickers</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waves.map((wave) => (
                <TableRow key={wave.id}>
                  <TableCell className="font-mono">{wave.id}</TableCell>
                  <TableCell className="font-medium">{wave.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[wave.type]}>
                      {wave.type.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{wave.orders}</TableCell>
                  <TableCell>{wave.items}</TableCell>
                  <TableCell>{wave.pickers}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${wave.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{wave.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[wave.status]}>
                      {wave.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {wave.status === "PLANNED" ? (
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    ) : wave.status === "IN_PROGRESS" ? (
                      <Button variant="outline" size="sm">View Progress</Button>
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
