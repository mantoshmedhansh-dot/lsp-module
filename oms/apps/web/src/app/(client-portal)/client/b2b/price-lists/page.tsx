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
import { Plus, Tag, Users, Percent } from "lucide-react";

export default function ClientPriceListsPage() {
  const priceLists = [
    {
      id: "PL-001",
      name: "Retail Standard",
      type: "RETAIL",
      discount: "10%",
      customers: 25,
      skus: 850,
      status: "ACTIVE",
    },
    {
      id: "PL-002",
      name: "Wholesale Premium",
      type: "WHOLESALE",
      discount: "25%",
      customers: 12,
      skus: 850,
      status: "ACTIVE",
    },
    {
      id: "PL-003",
      name: "Distributor Special",
      type: "DISTRIBUTOR",
      discount: "35%",
      customers: 5,
      skus: 650,
      status: "ACTIVE",
    },
  ];

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    INACTIVE: "bg-gray-100 text-gray-800",
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
          <h1 className="text-3xl font-bold tracking-tight">Price Lists</h1>
          <p className="text-muted-foreground">
            Manage customer-specific pricing
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Price List
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Active Price Lists</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">42</p>
                <p className="text-sm text-muted-foreground">Assigned Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">23%</p>
                <p className="text-sm text-muted-foreground">Avg Discount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Price Lists</CardTitle>
          <CardDescription>Customer pricing configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price List ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>SKUs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((pl) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-mono">{pl.id}</TableCell>
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[pl.type]}>{pl.type}</Badge>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">{pl.discount}</TableCell>
                  <TableCell>{pl.customers}</TableCell>
                  <TableCell>{pl.skus}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[pl.status]}>{pl.status}</Badge>
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
