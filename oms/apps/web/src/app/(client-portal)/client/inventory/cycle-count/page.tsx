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
import { Plus, ClipboardCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function ClientCycleCountPage() {
  const cycleCounts = [
    {
      id: "CC-001",
      name: "Monthly High-Value SKUs",
      warehouse: "Mumbai",
      skuCount: 150,
      completed: 142,
      variance: 3,
      status: "IN_PROGRESS",
      startDate: "2024-01-15",
    },
    {
      id: "CC-002",
      name: "Weekly Fast Movers",
      warehouse: "Delhi",
      skuCount: 50,
      completed: 50,
      variance: 1,
      status: "COMPLETED",
      startDate: "2024-01-14",
    },
    {
      id: "CC-003",
      name: "Quarterly Full Count",
      warehouse: "Bangalore",
      skuCount: 500,
      completed: 0,
      variance: 0,
      status: "SCHEDULED",
      startDate: "2024-01-20",
    },
  ];

  const statusColors: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Count</h1>
          <p className="text-muted-foreground">
            Plan and execute inventory cycle counts
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Cycle Count
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
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
                <p className="text-sm text-muted-foreground">Completed (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">0.8%</p>
                <p className="text-sm text-muted-foreground">Avg Variance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Counts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Count Plans</CardTitle>
          <CardDescription>Manage your inventory counting plans</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycleCounts.map((cc) => (
                <TableRow key={cc.id}>
                  <TableCell className="font-mono">{cc.id}</TableCell>
                  <TableCell className="font-medium">{cc.name}</TableCell>
                  <TableCell>{cc.warehouse}</TableCell>
                  <TableCell>{cc.skuCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(cc.completed / cc.skuCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {cc.completed}/{cc.skuCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cc.variance > 0 ? (
                      <span className="text-orange-600 font-medium">{cc.variance} SKUs</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{cc.startDate}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[cc.status]}>
                      {cc.status.replace(/_/g, " ")}
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
