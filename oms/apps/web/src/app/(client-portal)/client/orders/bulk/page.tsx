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
import { Upload, Download, FileText, CheckCircle, Clock, XCircle } from "lucide-react";

export default function ClientBulkActionsPage() {
  const recentUploads = [
    {
      id: "BLK-001",
      filename: "orders_update_jan15.csv",
      type: "Status Update",
      records: 156,
      processed: 156,
      errors: 0,
      status: "COMPLETED",
      date: "2024-01-15 10:30",
    },
    {
      id: "BLK-002",
      filename: "cancel_orders.csv",
      type: "Cancellation",
      records: 23,
      processed: 21,
      errors: 2,
      status: "COMPLETED_WITH_ERRORS",
      date: "2024-01-15 09:45",
    },
    {
      id: "BLK-003",
      filename: "tracking_update.csv",
      type: "Tracking Update",
      records: 89,
      processed: 45,
      errors: 0,
      status: "IN_PROGRESS",
      date: "2024-01-15 11:00",
    },
  ];

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    COMPLETED_WITH_ERRORS: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    FAILED: "bg-red-100 text-red-800",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircle className="h-4 w-4" />,
    COMPLETED_WITH_ERRORS: <CheckCircle className="h-4 w-4" />,
    IN_PROGRESS: <Clock className="h-4 w-4" />,
    FAILED: <XCircle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Actions</h1>
          <p className="text-muted-foreground">
            Perform bulk operations on orders
          </p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-blue-500 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Bulk Upload</CardTitle>
                <CardDescription>Upload CSV for bulk updates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-green-500 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Download className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Export Orders</CardTitle>
                <CardDescription>Download orders as CSV/Excel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-purple-500 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Templates</CardTitle>
                <CardDescription>Download CSV templates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Get Templates
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Bulk Operations</CardTitle>
          <CardDescription>History of bulk upload operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentUploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="font-mono">{upload.id}</TableCell>
                  <TableCell className="font-medium">{upload.filename}</TableCell>
                  <TableCell>{upload.type}</TableCell>
                  <TableCell>{upload.records}</TableCell>
                  <TableCell>{upload.processed}</TableCell>
                  <TableCell>
                    {upload.errors > 0 ? (
                      <span className="text-red-600 font-medium">{upload.errors}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[upload.status]}>
                      <span className="flex items-center gap-1">
                        {statusIcons[upload.status]}
                        {upload.status.replace(/_/g, " ")}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{upload.date}</TableCell>
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
