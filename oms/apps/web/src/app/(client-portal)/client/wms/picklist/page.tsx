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
import { ClipboardList, Clock, CheckCircle, User, MapPin } from "lucide-react";

export default function ClientPicklistPage() {
  const picklists = [
    {
      id: "PL-001",
      waveId: "WAVE-001",
      picker: "Raj Kumar",
      zone: "Zone A",
      items: 25,
      picked: 20,
      status: "IN_PROGRESS",
      startTime: "09:15 AM",
    },
    {
      id: "PL-002",
      waveId: "WAVE-001",
      picker: "Amit Singh",
      zone: "Zone B",
      items: 30,
      picked: 30,
      status: "COMPLETED",
      startTime: "09:00 AM",
    },
    {
      id: "PL-003",
      waveId: "WAVE-001",
      picker: "Priya Sharma",
      zone: "Zone C",
      items: 35,
      picked: 15,
      status: "IN_PROGRESS",
      startTime: "09:30 AM",
    },
    {
      id: "PL-004",
      waveId: "WAVE-003",
      picker: "-",
      zone: "Zone A",
      items: 40,
      picked: 0,
      status: "PENDING",
      startTime: "-",
    },
  ];

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Picklists</h1>
          <p className="text-muted-foreground">
            View and manage picking assignments
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Pending Assignment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">45</p>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">92%</p>
              <p className="text-sm text-muted-foreground">Pick Accuracy</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Picklists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Picklists</CardTitle>
          <CardDescription>Current picking assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Picklist ID</TableHead>
                <TableHead>Wave</TableHead>
                <TableHead>Picker</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {picklists.map((pl) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-mono">{pl.id}</TableCell>
                  <TableCell className="font-mono text-sm">{pl.waveId}</TableCell>
                  <TableCell>
                    {pl.picker !== "-" ? (
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {pl.picker}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {pl.zone}
                    </span>
                  </TableCell>
                  <TableCell>{pl.items}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(pl.picked / pl.items) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {pl.picked}/{pl.items}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{pl.startTime}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[pl.status]}>
                      {pl.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
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
