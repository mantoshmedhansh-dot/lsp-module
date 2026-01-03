"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import {
  ShoppingCart,
  Link2,
  RefreshCw,
  Plus,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  Settings,
  Zap,
} from "lucide-react";

interface EcommerceIntegration {
  id: string;
  name: string;
  platform: string;
  clientId: string;
  shopUrl?: string;
  sellerId?: string;
  isActive: boolean;
  lastSyncAt?: string;
  totalOrdersSynced: number;
  syncErrorCount: number;
  _count: { orders: number; syncLogs: number };
  stores: { id: string; storeName: string; isActive: boolean }[];
}

interface EcommerceOrder {
  id: string;
  platformOrderNumber: string;
  platformStatus: string;
  orderDate: string;
  customerName: string;
  shippingCity: string;
  totalAmount: number;
  fulfillmentStatus: string;
  awbNumber?: string;
  isCod: boolean;
  integration: { name: string; platform: string };
}

interface AvailablePlatform {
  type: string;
  name: string;
  icon: string;
  description: string;
}

export default function EcommercePage() {
  const [integrations, setIntegrations] = useState<EcommerceIntegration[]>([]);
  const [orders, setOrders] = useState<EcommerceOrder[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<AvailablePlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("integrations");
  const [summary, setSummary] = useState({ total: 0, active: 0, totalOrders: 0 });
  const [orderSummary, setOrderSummary] = useState({ pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [intRes, ordersRes] = await Promise.all([
        fetch("/api/ecommerce/integrations"),
        fetch("/api/ecommerce/orders"),
      ]);

      const [intData, ordersData] = await Promise.all([
        intRes.json(),
        ordersRes.json(),
      ]);

      if (intData.success) {
        setIntegrations(intData.data.items || []);
        setAvailablePlatforms(intData.data.availablePlatforms || []);
        setSummary(intData.data.summary || {});
      }
      if (ordersData.success) {
        setOrders(ordersData.data.items || []);
        setOrderSummary(ordersData.data.summary || {});
      }
    } catch (error) {
      console.error("Failed to fetch ecommerce data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function syncOrders(integrationId: string) {
    try {
      await fetch("/api/ecommerce/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SYNC_ORDERS", integrationId }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to sync orders:", error);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
      PENDING: "warning",
      PROCESSING: "info",
      SHIPPED: "info",
      DELIVERED: "success",
      CANCELLED: "danger",
    };
    return <Badge variant={colors[status] || "default"}>{status}</Badge>;
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      SHOPIFY: "🛍️",
      WOOCOMMERCE: "🔷",
      AMAZON: "📦",
      FLIPKART: "🛒",
      MAGENTO: "🟠",
      CUSTOM: "🔗",
    };
    return icons[platform] || "🔗";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-500" />
            E-commerce Integrations
          </h1>
          <p className="text-muted-foreground">Connect Shopify, WooCommerce, Amazon, Flipkart and more</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Add Integration</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">{summary.active} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{orderSummary.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting shipment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{orderSummary.processing}</div>
            <p className="text-xs text-muted-foreground">Being prepared</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Shipped</CardTitle>
            <Zap className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{orderSummary.shipped}</div>
            <p className="text-xs text-muted-foreground">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{orderSummary.delivered}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["integrations", "orders", "platforms"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab === "integrations" ? "Connected Stores" : tab === "orders" ? "Orders" : "Available Platforms"}
          </button>
        ))}
      </div>

      {activeTab === "integrations" && (
        <Card>
          <CardHeader>
            <CardTitle>Connected E-commerce Stores</CardTitle>
            <p className="text-sm text-muted-foreground">Manage your connected online stores</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : integrations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No integrations configured</p>
                <Button variant="outline" className="mt-4">Connect First Store</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {integrations.map((integration) => (
                  <Card key={integration.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getPlatformIcon(integration.platform)}</span>
                          <div>
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{integration.platform}</p>
                          </div>
                        </div>
                        <Badge variant={integration.isActive ? "success" : "default"}>
                          {integration.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Orders Synced:</span>
                          <span className="ml-2 font-medium">{integration.totalOrdersSynced}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errors:</span>
                          <span className={`ml-2 font-medium ${integration.syncErrorCount > 0 ? "text-red-600" : ""}`}>
                            {integration.syncErrorCount}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Last Sync:</span>
                          <span className="ml-2">
                            {integration.lastSyncAt
                              ? new Date(integration.lastSyncAt).toLocaleString()
                              : "Never"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => syncOrders(integration.id)}>
                          <RefreshCw className="mr-1 h-3 w-3" />Sync Now
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="mr-1 h-3 w-3" />Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle>E-commerce Orders</CardTitle>
            <p className="text-sm text-muted-foreground">Orders synced from connected platforms</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No orders synced yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Order #</th>
                      <th className="px-4 py-2 text-left font-medium">Platform</th>
                      <th className="px-4 py-2 text-left font-medium">Customer</th>
                      <th className="px-4 py-2 text-left font-medium">Amount</th>
                      <th className="px-4 py-2 text-left font-medium">AWB</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="font-medium">{order.platformOrderNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="info">{order.integration.platform}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div>{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.shippingCity}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">Rs. {order.totalAmount.toLocaleString()}</div>
                          {order.isCod && <Badge variant="warning">COD</Badge>}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{order.awbNumber || "-"}</td>
                        <td className="px-4 py-2">{getStatusBadge(order.fulfillmentStatus)}</td>
                        <td className="px-4 py-2">
                          {order.fulfillmentStatus === "PENDING" && (
                            <Button size="sm" variant="outline">Create Shipment</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "platforms" && (
        <Card>
          <CardHeader>
            <CardTitle>Available E-commerce Platforms</CardTitle>
            <p className="text-sm text-muted-foreground">Supported platforms for integration</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {availablePlatforms.map((platform) => (
                <div key={platform.type} className="rounded-lg border p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{getPlatformIcon(platform.type)}</span>
                    <div>
                      <h3 className="font-medium">{platform.name}</h3>
                      <p className="text-xs text-muted-foreground">{platform.type}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{platform.description}</p>
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />Connect
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
