"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Plus,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShoppingCart,
  Package,
  ArrowUpDown,
  ExternalLink,
  Store,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface MarketplaceConnection {
  id: string;
  marketplaceName: string;
  marketplaceType: string;
  status: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  pendingOrders: number;
  createdAt: string;
}

const marketplaceLogos: Record<string, string> = {
  AMAZON: "AMZ",
  FLIPKART: "FK",
  MYNTRA: "MYN",
  AJIO: "AJ",
  NYKAA: "NYK",
  MEESHO: "MEE",
  SHOPIFY: "SHO",
  WOOCOMMERCE: "WOO",
  MAGENTO: "MAG",
  TATACLIQ: "TAT",
  JIOMART: "JIO",
};

const marketplaceGradients: Record<string, string> = {
  AMAZON: "from-orange-500 to-yellow-500",
  FLIPKART: "from-blue-500 to-indigo-600",
  MYNTRA: "from-pink-500 to-rose-600",
  AJIO: "from-purple-500 to-violet-600",
  NYKAA: "from-rose-500 to-pink-600",
  MEESHO: "from-teal-500 to-cyan-600",
  SHOPIFY: "from-green-500 to-emerald-600",
  WOOCOMMERCE: "from-violet-500 to-purple-600",
  MAGENTO: "from-orange-600 to-red-600",
  TATACLIQ: "from-blue-600 to-cyan-600",
  JIOMART: "from-blue-500 to-blue-700",
};

export default function ChannelsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/marketplaces");
      if (response.ok) {
        const data = await response.json();
        setConnections(Array.isArray(data) ? data : data?.items || data?.data || []);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const toggleConnection = async (connection: MarketplaceConnection) => {
    try {
      const response = await fetch(`/api/v1/marketplaces/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !connection.isActive }),
      });
      if (response.ok) {
        toast.success(`${connection.marketplaceName} ${connection.isActive ? "disabled" : "enabled"}`);
        fetchConnections();
      } else {
        toast.error("Failed to update connection");
      }
    } catch (error) {
      toast.error("Failed to update connection");
    }
  };

  const syncOrders = async (connection: MarketplaceConnection) => {
    try {
      const response = await fetch(`/api/v1/marketplaces/${connection.id}/sync-orders`, {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Synced ${result.ordersImported || 0} orders from ${connection.marketplaceName}`);
        fetchConnections();
      } else {
        toast.error("Failed to sync orders");
      }
    } catch (error) {
      toast.error("Failed to sync orders");
    }
  };

  const statusColors: Record<string, string> = {
    CONNECTED: "bg-green-100 text-green-800",
    ACTIVE: "bg-green-100 text-green-800",
    DISCONNECTED: "bg-red-100 text-red-800",
    INACTIVE: "bg-gray-100 text-gray-800",
    ERROR: "bg-red-100 text-red-800",
    SYNCING: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
  };

  const activeConnections = connections.filter(c => c.isActive && (c.status === "CONNECTED" || c.status === "ACTIVE")).length;
  const totalOrders = connections.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  const totalListings = connections.reduce((sum, c) => sum + (c.totalListings || 0), 0);
  const pendingSync = connections.reduce((sum, c) => sum + (c.pendingOrders || 0), 0);

  const availableMarketplaces = ["Ajio", "Nykaa", "Tata Cliq", "JioMart", "WooCommerce", "Magento", "BigCommerce", "PrestaShop"]
    .filter(name => !connections.some(c => c.marketplaceName?.toLowerCase().includes(name.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace Integrations</h1>
          <p className="text-muted-foreground">
            Manage marketplace and webstore connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchConnections}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/settings/integrations")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{activeConnections}</p>
                <p className="text-sm text-muted-foreground">Active Channels</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalOrders}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{totalListings}</p>
                <p className="text-sm text-muted-foreground">Total Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingSync}</p>
                <p className="text-sm text-muted-foreground">Pending Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Marketplaces Connected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your first marketplace to start syncing orders and inventory
            </p>
            <Button onClick={() => router.push("/settings/integrations")}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Marketplace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <Card key={connection.id} className="relative hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${marketplaceGradients[connection.marketplaceType] || "from-blue-500 to-indigo-600"} flex items-center justify-center text-white font-bold text-sm`}>
                      {marketplaceLogos[connection.marketplaceType] || connection.marketplaceName?.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{connection.marketplaceName}</CardTitle>
                      <CardDescription>{connection.marketplaceType}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={connection.isActive}
                    onCheckedChange={() => toggleConnection(connection)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className={statusColors[connection.status] || "bg-gray-100 text-gray-800"}>
                      {connection.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orders</span>
                    <span className="font-medium">
                      {connection.totalOrders || 0}
                      {(connection.pendingOrders || 0) > 0 && (
                        <span className="text-yellow-600 ml-1">({connection.pendingOrders} pending)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Listings</span>
                    <span className="font-medium">
                      {connection.activeListings || 0}/{connection.totalListings || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Sync</span>
                    <span className="text-muted-foreground">
                      {connection.lastSyncAt
                        ? new Date(connection.lastSyncAt).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => syncOrders(connection)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/channels/marketplaces")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Available Integrations */}
      {availableMarketplaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Integrations</CardTitle>
            <CardDescription>Connect more sales channels to expand your reach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {availableMarketplaces.map((name) => (
                <div
                  key={name}
                  className="p-4 border rounded-lg text-center hover:border-blue-500 cursor-pointer transition-colors"
                  onClick={() => router.push("/settings/integrations")}
                >
                  <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs font-bold">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground">{name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/channels/sku-mapping")}>
          <CardContent className="pt-6 text-center">
            <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
            <p className="font-medium">SKU Mapping</p>
            <p className="text-xs text-muted-foreground">Map internal SKUs to marketplaces</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/channels/order-sync")}>
          <CardContent className="pt-6 text-center">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="font-medium">Order Sync</p>
            <p className="text-xs text-muted-foreground">Pull orders from channels</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/channels/inventory-sync")}>
          <CardContent className="pt-6 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-purple-600" />
            <p className="font-medium">Inventory Sync</p>
            <p className="text-xs text-muted-foreground">Push stock to marketplaces</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/channels/returns")}>
          <CardContent className="pt-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <p className="font-medium">Returns</p>
            <p className="text-xs text-muted-foreground">Process marketplace returns</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
