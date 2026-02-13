"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Link,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  ShoppingCart,
  ArrowUpDown,
  Settings,
  Plus,
  ExternalLink,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  marketplaceName?: string;
  marketplaceType?: string;
  status: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus?: string | null;
  totalListings?: number;
  activeListings?: number;
  totalOrders?: number;
  pendingOrders?: number;
  createdAt: string;
}

interface MarketplaceListing {
  id: string;
  marketplaceId: string;
  marketplaceName: string;
  skuCode: string;
  skuName: string;
  marketplaceSku: string;
  status: string;
  price: string;
  quantity: number;
  lastSyncAt: string | null;
}

interface OrderSync {
  id: string;
  marketplaceId: string;
  marketplaceName: string;
  marketplaceOrderId: string;
  localOrderId: string | null;
  localOrderNo: string | null;
  status: string;
  orderAmount: string;
  syncedAt: string;
  errorMessage: string | null;
}

interface InventorySync {
  id: string;
  marketplaceId: string;
  marketplaceName: string;
  skuCode: string;
  previousQty: number;
  newQty: number;
  status: string;
  syncedAt: string;
  errorMessage: string | null;
}

const marketplaceLogos: Record<string, string> = {
  AMAZON: "🛒",
  FLIPKART: "🛍️",
  MYNTRA: "👗",
  AJIO: "👔",
  NYKAA: "💄",
  MEESHO: "📦",
  SHOPIFY: "🏪",
};

export default function MarketplacesPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [orderSyncs, setOrderSyncs] = useState<OrderSync[]>([]);
  const [inventorySyncs, setInventorySyncs] = useState<InventorySync[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("connections");
  const [selectedConnection, setSelectedConnection] = useState<MarketplaceConnection | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/marketplaces");
      if (response.ok) {
        const data = await response.json();
        setConnections(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  }, []);

  const fetchListings = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/sku-mappings?limit=50");
      if (response.ok) {
        const data = await response.json();
        setListings(Array.isArray(data) ? data : data?.items || data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  }, []);

  const fetchOrderSyncs = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/order-sync/orders?limit=50");
      if (response.ok) {
        const data = await response.json();
        setOrderSyncs(Array.isArray(data) ? data : data?.items || data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching order syncs:", error);
    }
  }, []);

  const fetchInventorySyncs = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/inventory-sync/logs?limit=50");
      if (response.ok) {
        const data = await response.json();
        setInventorySyncs(Array.isArray(data) ? data : data?.items || data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching inventory syncs:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchConnections(),
      fetchListings(),
      fetchOrderSyncs(),
      fetchInventorySyncs(),
    ]);
    setIsLoading(false);
  }, [fetchConnections, fetchListings, fetchOrderSyncs, fetchInventorySyncs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const syncOrders = async (connection: MarketplaceConnection) => {
    try {
      setIsSyncing(true);
      const response = await fetch(`/api/v1/marketplaces/${connection.id}/sync-orders`, {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Synced ${result.ordersImported || 0} orders from ${getDisplayName(connection)}`);
        fetchAll();
      } else {
        toast.error("Failed to sync orders");
      }
    } catch (error) {
      toast.error("Failed to sync orders");
    } finally {
      setIsSyncing(false);
      setShowSyncDialog(false);
    }
  };

  const pushInventory = async (connection: MarketplaceConnection) => {
    try {
      setIsSyncing(true);
      const response = await fetch(`/api/v1/marketplaces/${connection.id}/push-inventory`, {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Pushed inventory for ${result.skusUpdated || 0} SKUs to ${getDisplayName(connection)}`);
        fetchAll();
      } else {
        toast.error("Failed to push inventory");
      }
    } catch (error) {
      toast.error("Failed to push inventory");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleConnection = async (connection: MarketplaceConnection) => {
    try {
      const response = await fetch(`/api/v1/marketplaces/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !connection.isActive }),
      });
      if (response.ok) {
        toast.success(`${getDisplayName(connection)} ${connection.isActive ? "disabled" : "enabled"}`);
        fetchConnections();
      }
    } catch (error) {
      toast.error("Failed to update connection");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Connected</Badge>;
      case "DISCONNECTED":
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />Disconnected</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">Inactive</Badge>;
      case "SYNCED":
        return <Badge className="bg-green-100 text-green-800">Synced</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "IMPORTED":
        return <Badge className="bg-blue-100 text-blue-800">Imported</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const parseDecimal = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return parseFloat(value) || 0;
    return value;
  };

  const formatCurrency = (value: string | number | null): string => {
    const num = parseDecimal(value);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const totalListings = connections.reduce((sum, c) => sum + (Number(c.totalListings) || 0), 0);
  const totalOrders = connections.reduce((sum, c) => sum + (Number(c.totalOrders) || 0), 0);
  const pendingOrders = connections.reduce((sum, c) => sum + (Number(c.pendingOrders) || 0), 0);
  const activeConnections = connections.filter(c => c.status === "CONNECTED" && c.isActive).length;

  // Helper to get display name for a connection
  const getDisplayName = (c: MarketplaceConnection) =>
    c.connectionName || c.marketplaceName || c.marketplace || "Unknown";
  const getMarketplaceType = (c: MarketplaceConnection) =>
    c.marketplace || c.marketplaceType || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Integration</h1>
          <p className="text-muted-foreground">
            Connect and sync with e-commerce marketplaces
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/settings/integrations")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Marketplace
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <Link className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeConnections}</div>
            <p className="text-xs text-muted-foreground">
              of {connections.length} marketplaces
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalListings}</div>
            <p className="text-xs text-muted-foreground">Across all channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {pendingOrders} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderSyncs.length > 0
                ? new Date(orderSyncs[0].syncedAt).toLocaleTimeString()
                : "-"
              }
            </div>
            <p className="text-xs text-muted-foreground">Orders synced</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="orders">Order Sync</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          <Card>
            <CardHeader>
              <CardTitle>Marketplace Connections</CardTitle>
              <CardDescription>Manage your marketplace integrations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Store className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No marketplaces connected</p>
                  <Button className="mt-4" onClick={() => router.push("/settings/integrations")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Connect First Marketplace
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {connections.map((connection) => (
                    <Card key={connection.id} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">
                              {marketplaceLogos[getMarketplaceType(connection)] || "🏪"}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{getDisplayName(connection)}</CardTitle>
                              <CardDescription>{getMarketplaceType(connection)}</CardDescription>
                            </div>
                          </div>
                          <Switch
                            checked={connection.isActive}
                            onCheckedChange={() => toggleConnection(connection)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Status</span>
                          {getStatusBadge(connection.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Listings</p>
                            <p className="font-medium">{Number(connection.activeListings) || 0}/{Number(connection.totalListings) || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Orders</p>
                            <p className="font-medium">{Number(connection.totalOrders) || 0}</p>
                          </div>
                        </div>
                        {connection.lastSyncAt && (
                          <p className="text-xs text-muted-foreground">
                            Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedConnection(connection);
                              setShowSyncDialog(true);
                            }}
                          >
                            <ArrowUpDown className="mr-1 h-4 w-4" />
                            Sync
                          </Button>
                          <Button size="sm" variant="outline">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          <Card>
            <CardHeader>
              <CardTitle>Product Listings</CardTitle>
              <CardDescription>Products listed on marketplaces</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No listings found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Marketplace SKU</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{listing.skuCode}</p>
                            <p className="text-sm text-muted-foreground">{listing.skuName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{listing.marketplaceName}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {listing.marketplaceSku}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(listing.price)}
                        </TableCell>
                        <TableCell className="text-center">{listing.quantity}</TableCell>
                        <TableCell>{getStatusBadge(listing.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {listing.lastSyncAt
                            ? new Date(listing.lastSyncAt).toLocaleString()
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order Sync Log</CardTitle>
              <CardDescription>Recent order imports from marketplaces</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : orderSyncs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders synced yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>Marketplace Order</TableHead>
                      <TableHead>Local Order</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Synced At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderSyncs.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell>
                          <Badge variant="outline">{sync.marketplaceName}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{sync.marketplaceOrderId}</TableCell>
                        <TableCell className="font-mono">
                          {sync.localOrderNo || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sync.orderAmount)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(sync.status)}
                          {sync.errorMessage && (
                            <p className="text-xs text-red-500 mt-1">{sync.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(sync.syncedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Sync Log</CardTitle>
              <CardDescription>Recent inventory updates to marketplaces</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : inventorySyncs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No inventory syncs yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Previous</TableHead>
                      <TableHead className="text-center">New</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Synced At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventorySyncs.map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell>
                          <Badge variant="outline">{sync.marketplaceName}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{sync.skuCode}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {sync.previousQty}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {sync.newQty}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(sync.status)}
                          {sync.errorMessage && (
                            <p className="text-xs text-red-500 mt-1">{sync.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(sync.syncedAt).toLocaleString()}
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

      {/* Sync Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync {selectedConnection?.marketplaceName}</DialogTitle>
            <DialogDescription>
              Choose what to sync with the marketplace
            </DialogDescription>
          </DialogHeader>
          {selectedConnection && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Marketplace</span>
                  <span className="font-medium">{getDisplayName(selectedConnection)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Status</span>
                  {getStatusBadge(selectedConnection.status)}
                </div>
              </div>
              <div className="grid gap-2">
                <Button
                  onClick={() => syncOrders(selectedConnection)}
                  disabled={isSyncing}
                  className="w-full"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Pull Orders from Marketplace
                </Button>
                <Button
                  onClick={() => pushInventory(selectedConnection)}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Push Inventory to Marketplace
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
