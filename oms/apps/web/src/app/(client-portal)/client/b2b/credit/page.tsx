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
import { IndianRupee, CreditCard, AlertTriangle, CheckCircle } from "lucide-react";

export default function ClientCreditManagementPage() {
  const creditAccounts = [
    {
      customer: "ABC Retail Store",
      creditLimit: 100000,
      used: 75000,
      available: 25000,
      overdue: 0,
      status: "NORMAL",
    },
    {
      customer: "XYZ Distributors",
      creditLimit: 500000,
      used: 425000,
      available: 75000,
      overdue: 50000,
      status: "OVERDUE",
    },
    {
      customer: "DEF Wholesale",
      creditLimit: 250000,
      used: 0,
      available: 250000,
      overdue: 0,
      status: "NORMAL",
    },
  ];

  const statusColors: Record<string, string> = {
    NORMAL: "bg-green-100 text-green-800",
    WARNING: "bg-yellow-100 text-yellow-800",
    OVERDUE: "bg-red-100 text-red-800",
    BLOCKED: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Management</h1>
          <p className="text-muted-foreground">
            Monitor customer credit status
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">₹8,50,000</p>
                <p className="text-sm text-muted-foreground">Total Credit Limit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">₹5,00,000</p>
                <p className="text-sm text-muted-foreground">Credit Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">₹3,50,000</p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">₹50,000</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Accounts</CardTitle>
          <CardDescription>Customer credit status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditAccounts.map((acc) => (
                <TableRow key={acc.customer}>
                  <TableCell className="font-medium">{acc.customer}</TableCell>
                  <TableCell className="text-right">₹{acc.creditLimit.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-purple-600">₹{acc.used.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">₹{acc.available.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {acc.overdue > 0 ? (
                      <span className="text-red-600 font-medium">₹{acc.overdue.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[acc.status]}>{acc.status}</Badge>
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
