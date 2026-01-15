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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Users, Building2, IndianRupee } from "lucide-react";

export default function ClientB2BCustomersPage() {
  const customers = [
    {
      id: "CUST-001",
      name: "ABC Retail Store",
      type: "RETAIL",
      contact: "Raj Kumar",
      email: "raj@abcretail.com",
      creditLimit: 100000,
      outstanding: 25000,
      status: "ACTIVE",
    },
    {
      id: "CUST-002",
      name: "XYZ Distributors",
      type: "DISTRIBUTOR",
      contact: "Priya Sharma",
      email: "priya@xyzdist.com",
      creditLimit: 500000,
      outstanding: 125000,
      status: "ACTIVE",
    },
    {
      id: "CUST-003",
      name: "DEF Wholesale",
      type: "WHOLESALE",
      contact: "Amit Patel",
      email: "amit@defwholesale.com",
      creditLimit: 250000,
      outstanding: 0,
      status: "ACTIVE",
    },
  ];

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
    BLOCKED: "bg-red-100 text-red-800",
  };

  const typeColors: Record<string, string> = {
    RETAIL: "bg-blue-100 text-blue-800",
    WHOLESALE: "bg-purple-100 text-purple-800",
    DISTRIBUTOR: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">B2B Customers</h1>
          <p className="text-muted-foreground">
            Manage business customers
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">45</p>
                <p className="text-sm text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">42</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">₹12,50,000</p>
                <p className="text-sm text-muted-foreground">Total Credit Limit</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">₹3,50,000</p>
              <p className="text-sm text-muted-foreground">Outstanding</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>Business customers list</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((cust) => (
                <TableRow key={cust.id}>
                  <TableCell className="font-mono">{cust.id}</TableCell>
                  <TableCell className="font-medium">{cust.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[cust.type]}>{cust.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{cust.contact}</p>
                      <p className="text-xs text-muted-foreground">{cust.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">₹{cust.creditLimit.toLocaleString()}</TableCell>
                  <TableCell className={`text-right ${cust.outstanding > 0 ? "text-orange-600 font-medium" : ""}`}>
                    ₹{cust.outstanding.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[cust.status]}>{cust.status}</Badge>
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
