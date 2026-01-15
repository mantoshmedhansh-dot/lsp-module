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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowRight, Download, Package, Truck, RotateCcw, ShoppingCart } from "lucide-react";

export default function ClientMovementHistoryPage() {
  const movements = [
    {
      id: "MOV-001",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      type: "SALE",
      quantity: -2,
      fromLocation: "Mumbai WH",
      toLocation: "Customer",
      reference: "ORD-2024-1001",
      date: "2024-01-15 10:30",
    },
    {
      id: "MOV-002",
      sku: "SKU-JEANS-002",
      product: "Slim Fit Jeans",
      type: "INBOUND",
      quantity: 100,
      fromLocation: "Supplier",
      toLocation: "Delhi WH",
      reference: "PO-2024-045",
      date: "2024-01-15 09:45",
    },
    {
      id: "MOV-003",
      sku: "SKU-DRESS-003",
      product: "Summer Dress",
      type: "TRANSFER",
      quantity: 50,
      fromLocation: "Mumbai WH",
      toLocation: "Bangalore WH",
      reference: "TRF-2024-012",
      date: "2024-01-15 08:30",
    },
    {
      id: "MOV-004",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      type: "RETURN",
      quantity: 1,
      fromLocation: "Customer",
      toLocation: "Mumbai WH",
      reference: "RET-2024-089",
      date: "2024-01-14 16:20",
    },
  ];

  const typeColors: Record<string, string> = {
    SALE: "bg-green-100 text-green-800",
    INBOUND: "bg-blue-100 text-blue-800",
    TRANSFER: "bg-purple-100 text-purple-800",
    RETURN: "bg-orange-100 text-orange-800",
    ADJUSTMENT: "bg-gray-100 text-gray-800",
  };

  const typeIcons: Record<string, React.ReactNode> = {
    SALE: <ShoppingCart className="h-4 w-4" />,
    INBOUND: <Package className="h-4 w-4" />,
    TRANSFER: <Truck className="h-4 w-4" />,
    RETURN: <RotateCcw className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movement History</h1>
          <p className="text-muted-foreground">
            Track all inventory movements
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">1,234</p>
                <p className="text-sm text-muted-foreground">Sales (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">567</p>
                <p className="text-sm text-muted-foreground">Inbound (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">89</p>
                <p className="text-sm text-muted-foreground">Transfers (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">45</p>
                <p className="text-sm text-muted-foreground">Returns (MTD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by SKU, Reference..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="return">Return</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="mumbai">Mumbai WH</SelectItem>
                <SelectItem value="delhi">Delhi WH</SelectItem>
                <SelectItem value="bangalore">Bangalore WH</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movement Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movement Log</CardTitle>
          <CardDescription>All inventory movements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Movement</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((mov) => (
                <TableRow key={mov.id}>
                  <TableCell className="font-mono">{mov.id}</TableCell>
                  <TableCell className="font-medium">{mov.sku}</TableCell>
                  <TableCell>{mov.product}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[mov.type]}>
                      <span className="flex items-center gap-1">
                        {typeIcons[mov.type]}
                        {mov.type}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-bold ${mov.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                    {mov.quantity > 0 ? "+" : ""}{mov.quantity}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      {mov.fromLocation}
                      <ArrowRight className="h-3 w-3" />
                      {mov.toLocation}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{mov.reference}</TableCell>
                  <TableCell className="text-muted-foreground">{mov.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
