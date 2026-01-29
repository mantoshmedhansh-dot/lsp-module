"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft,
  Package,
  Truck,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Box,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface CrossDockRule {
  id: string;
  ruleName: string;
  ruleType: string;
  priority: number;
  isActive: boolean;
  conditions: object;
  createdAt: string;
}

interface CrossDockOrder {
  id: string;
  orderNo: string;
  status: string;
  inboundAsnNo: string | null;
  outboundOrderNo: string | null;
  skuCount: number;
  totalQuantity: number;
  allocatedQuantity: number;
  expectedArrival: string | null;
  stagingArea: string | null;
  createdAt: string;
}

interface CrossDockAllocation {
  id: string;
  inboundReference: string;
  outboundReference: string;
  skuCode: string;
  allocatedQuantity: number;
  status: string;
  stagingBin: string | null;
  createdAt: string;
}

interface StagingArea {
  id: string;
  areaCode: string;
  areaName: string;
  status: string;
  currentOrders: number;
  capacity: number;
}

export default function CrossDockPage() {
  const [rules, setRules] = useState<CrossDockRule[]>([]);
  const [orders, setOrders] = useState<CrossDockOrder[]>([]);
  const [allocations, setAllocations] = useState<CrossDockAllocation[]>([]);
  const [stagingAreas, setStagingAreas] = useState<StagingArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/cross-dock/rules");
      if (response.ok) {
        const data = await response.json();
        setRules(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/cross-dock/eligible");
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/cross-dock/allocations");
      if (response.ok) {
        const data = await response.json();
        setAllocations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching allocations:", error);
    }
  }, []);

  const fetchStagingAreas = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/cross-dock/staging");
      if (response.ok) {
        const data = await response.json();
        setStagingAreas(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching staging areas:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchRules(), fetchOrders(), fetchAllocations(), fetchStagingAreas()]);
    setIsLoading(false);
  }, [fetchRules, fetchOrders, fetchAllocations, fetchStagingAreas]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "ALLOCATED":
        return <Badge className="bg-blue-100 text-blue-800">Allocated</Badge>;
      case "IN_STAGING":
        return <Badge className="bg-purple-100 text-purple-800">In Staging</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingOrders = orders.filter(o => o.status === "PENDING").length;
  const inStagingOrders = orders.filter(o => o.status === "IN_STAGING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cross-Docking</h1>
          <p className="text-muted-foreground">
            Direct transfer from inbound to outbound without storage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">
              For cross-dock processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Allocation</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting inbound receipt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Staging</CardTitle>
            <Box className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{inStagingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Ready for dispatch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => r.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {rules.length} total rules
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Staging Area Status */}
      {stagingAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staging Areas</CardTitle>
            <CardDescription>Cross-dock staging zone utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {stagingAreas.map((area) => (
                <div key={area.id} className="space-y-2 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{area.areaCode}</span>
                    <Badge variant={area.status === "ACTIVE" ? "default" : "secondary"}>
                      {area.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{area.areaName}</p>
                  <Progress
                    value={(area.currentOrders / area.capacity) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {area.currentOrders} / {area.capacity} orders
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">
            Eligible Orders
            {pendingOrders > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingOrders}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Dock Eligible Orders</CardTitle>
              <CardDescription>Orders eligible for direct transfer</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No eligible orders</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Inbound ASN</TableHead>
                      <TableHead className="text-center">SKUs</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Staging Area</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium font-mono">{order.orderNo}</TableCell>
                        <TableCell>
                          {order.inboundAsnNo || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{order.skuCount}</TableCell>
                        <TableCell className="text-center">
                          <div>
                            <span className="font-medium">{order.allocatedQuantity}</span>
                            <span className="text-muted-foreground">/{order.totalQuantity}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.stagingArea ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {order.stagingArea}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.expectedArrival ? (
                            new Date(order.expectedArrival).toLocaleDateString()
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Dock Allocations</CardTitle>
              <CardDescription>Inbound to outbound mapping</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : allocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No allocations created</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inbound Ref</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Outbound Ref</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Staging Bin</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((alloc) => (
                      <TableRow key={alloc.id}>
                        <TableCell className="font-mono">{alloc.inboundReference}</TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono">{alloc.outboundReference}</TableCell>
                        <TableCell>{alloc.skuCode}</TableCell>
                        <TableCell className="text-center font-medium">
                          {alloc.allocatedQuantity}
                        </TableCell>
                        <TableCell>
                          {alloc.stagingBin || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(alloc.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Dock Rules</CardTitle>
              <CardDescription>Automatic allocation rules</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No rules configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.ruleName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.ruleType}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{rule.priority}</TableCell>
                        <TableCell>
                          {rule.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
