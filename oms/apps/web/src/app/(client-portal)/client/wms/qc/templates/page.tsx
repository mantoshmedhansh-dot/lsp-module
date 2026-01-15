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
import { Plus, ClipboardList, CheckCircle } from "lucide-react";

export default function ClientQCTemplatesPage() {
  const templates = [
    {
      id: "TPL-001",
      name: "Standard Apparel",
      type: "OUTBOUND",
      parameters: 5,
      usageCount: 1250,
      status: "ACTIVE",
    },
    {
      id: "TPL-002",
      name: "Premium Check",
      type: "OUTBOUND",
      parameters: 8,
      usageCount: 450,
      status: "ACTIVE",
    },
    {
      id: "TPL-003",
      name: "Electronics",
      type: "OUTBOUND",
      parameters: 10,
      usageCount: 320,
      status: "ACTIVE",
    },
    {
      id: "TPL-004",
      name: "Inbound Basic",
      type: "INBOUND",
      parameters: 4,
      usageCount: 890,
      status: "ACTIVE",
    },
    {
      id: "TPL-005",
      name: "Return QC",
      type: "RETURN",
      parameters: 6,
      usageCount: 230,
      status: "ACTIVE",
    },
  ];

  const typeColors: Record<string, string> = {
    INBOUND: "bg-blue-100 text-blue-800",
    OUTBOUND: "bg-green-100 text-green-800",
    RETURN: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QC Templates</h1>
          <p className="text-muted-foreground">
            Configure quality check templates
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Active Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">3,140</p>
                <p className="text-sm text-muted-foreground">QC Checks (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">98.8%</p>
              <p className="text-sm text-muted-foreground">Overall Pass Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Quality check templates</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Parameters</TableHead>
                <TableHead>Usage Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-mono">{tpl.id}</TableCell>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[tpl.type]}>{tpl.type}</Badge>
                  </TableCell>
                  <TableCell>{tpl.parameters}</TableCell>
                  <TableCell>{tpl.usageCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-800">{tpl.status}</Badge>
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
