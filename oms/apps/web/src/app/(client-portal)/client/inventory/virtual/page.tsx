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
import { Search, Plus, Layers, Lock, Clock, ShieldCheck } from "lucide-react";

export default function ClientVirtualInventoryPage() {
  const virtualInventory = [
    {
      id: "VI-001",
      sku: "SKU-TSHIRT-001",
      product: "Classic Cotton T-Shirt",
      totalStock: 500,
      available: 350,
      reserved: 100,
      safetyStock: 50,
      channels: ["Amazon", "Flipkart"],
    },
    {
      id: "VI-002",
      sku: "SKU-JEANS-002",
      product: "Slim Fit Jeans",
      totalStock: 200,
      available: 120,
      reserved: 50,
      safetyStock: 30,
      channels: ["Myntra", "Amazon"],
    },
    {
      id: "VI-003",
      sku: "SKU-DRESS-003",
      product: "Summer Dress",
      totalStock: 150,
      available: 80,
      reserved: 40,
      safetyStock: 30,
      channels: ["Myntra"],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual Inventory</h1>
          <p className="text-muted-foreground">
            Manage channel-wise inventory allocation
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Allocation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">850</p>
                <p className="text-sm text-muted-foreground">Total SKUs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">12,450</p>
                <p className="text-sm text-muted-foreground">Available Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">3,200</p>
                <p className="text-sm text-muted-foreground">Reserved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">1,500</p>
                <p className="text-sm text-muted-foreground">Safety Stock</p>
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
              <Input placeholder="Search by SKU or Product..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="flipkart">Flipkart</SelectItem>
                <SelectItem value="myntra">Myntra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Virtual Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Allocation</CardTitle>
          <CardDescription>Channel-wise inventory distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Safety Stock</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {virtualInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell>{item.product}</TableCell>
                  <TableCell className="text-right font-bold">{item.totalStock}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{item.available}</TableCell>
                  <TableCell className="text-right text-purple-600">{item.reserved}</TableCell>
                  <TableCell className="text-right text-orange-600">{item.safetyStock}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {item.channels.map((channel) => (
                        <Badge key={channel} variant="outline" className="text-xs">
                          {channel}
                        </Badge>
                      ))}
                    </div>
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
