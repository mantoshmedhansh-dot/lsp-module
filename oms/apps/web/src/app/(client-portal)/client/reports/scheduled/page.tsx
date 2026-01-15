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
import { Plus, Calendar, Mail, Clock, CheckCircle } from "lucide-react";

export default function ClientScheduledReportsPage() {
  const scheduledReports = [
    {
      id: "SCH-001",
      name: "Daily Sales Summary",
      frequency: "DAILY",
      nextRun: "2024-01-16 08:00",
      recipients: 2,
      format: "Excel",
      status: "ACTIVE",
    },
    {
      id: "SCH-002",
      name: "Weekly Inventory Report",
      frequency: "WEEKLY",
      nextRun: "2024-01-22 09:00",
      recipients: 3,
      format: "PDF",
      status: "ACTIVE",
    },
    {
      id: "SCH-003",
      name: "Monthly Finance Summary",
      frequency: "MONTHLY",
      nextRun: "2024-02-01 10:00",
      recipients: 2,
      format: "Excel",
      status: "ACTIVE",
    },
  ];

  const frequencyColors: Record<string, string> = {
    DAILY: "bg-blue-100 text-blue-800",
    WEEKLY: "bg-purple-100 text-purple-800",
    MONTHLY: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Reports</h1>
          <p className="text-muted-foreground">
            Manage automated report deliveries
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Scheduled Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-muted-foreground">Running Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">7</p>
                <p className="text-sm text-muted-foreground">Recipients</p>
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
                <p className="text-sm text-muted-foreground">Delivered (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Reports</CardTitle>
          <CardDescription>Automated report configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-mono">{report.id}</TableCell>
                  <TableCell className="font-medium">{report.name}</TableCell>
                  <TableCell>
                    <Badge className={frequencyColors[report.frequency]}>{report.frequency}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{report.nextRun}</TableCell>
                  <TableCell>{report.recipients}</TableCell>
                  <TableCell>{report.format}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">{report.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Edit</Button>
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
