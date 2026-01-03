"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import {
  Zap,
  MapPin,
  Users,
  Package,
  Clock,
  TrendingUp,
  Plus,
  RefreshCw,
  Search,
  Bike,
  Store,
} from "lucide-react";

interface DarkStore {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  maxOrdersPerHour: number;
  currentUtilization: number;
  isActive: boolean;
  _count: { hyperlocalOrders: number; riders: number };
}

interface HyperlocalOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  promisedDeliveryTime: string;
  totalAmount: number;
  paymentMode: string;
  darkStore: { code: string; name: string };
  rider?: { riderCode: string; name: string; status: string };
}

interface Rider {
  id: string;
  riderCode: string;
  name: string;
  phone: string;
  vehicleType: string;
  status: string;
  todayDeliveries: number;
  avgRating: number;
  darkStore?: { code: string; name: string };
}

export default function HyperlocalPage() {
  const [darkStores, setDarkStores] = useState<DarkStore[]>([]);
  const [orders, setOrders] = useState<HyperlocalOrder[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState({ totalStores: 0, activeRiders: 0, todayOrders: 0, pendingOrders: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [storesRes, ordersRes, ridersRes] = await Promise.all([
        fetch("/api/hyperlocal/dark-stores"),
        fetch("/api/hyperlocal/orders"),
        fetch("/api/hyperlocal/riders"),
      ]);

      const [storesData, ordersData, ridersData] = await Promise.all([
        storesRes.json(),
        ordersRes.json(),
        ridersRes.json(),
      ]);

      if (storesData.success) {
        setDarkStores(storesData.data.items || []);
        setSummary(storesData.data.summary || {});
      }
      if (ordersData.success) setOrders(ordersData.data.items || []);
      if (ridersData.success) setRiders(ridersData.data.items || []);
    } catch (error) {
      console.error("Failed to fetch hyperlocal data:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
      ONLINE: "success",
      BUSY: "warning",
      OFFLINE: "default",
      ON_BREAK: "info",
      PENDING: "warning",
      CONFIRMED: "info",
      PICKING: "info",
      IN_TRANSIT: "info",
      DELIVERED: "success",
      FAILED: "danger",
      CANCELLED: "danger",
    };
    return <Badge variant={colors[status] || "default"}>{status}</Badge>;
  };

  const getOrderTypeBadge = (type: string) => {
    const colors: Record<string, "success" | "warning" | "info" | "danger"> = {
      EXPRESS: "danger",
      SAME_DAY: "warning",
      SCHEDULED: "info",
    };
    return <Badge variant={colors[type] || "default"}>{type}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Hyperlocal Delivery
          </h1>
          <p className="text-muted-foreground">15-minute express & same-day delivery operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Add Dark Store</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dark Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalStores}</div>
            <p className="text-xs text-muted-foreground">Active micro-fulfillment centers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Riders</CardTitle>
            <Bike className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.activeRiders}</div>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Orders</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.todayOrders}</div>
            <p className="text-xs text-muted-foreground">Deliveries today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Awaiting pickup</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["overview", "orders", "riders", "stores"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab === "overview" ? "Live Overview" : tab === "orders" ? "Orders" : tab === "riders" ? "Riders" : "Dark Stores"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Live Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Live Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : orders.filter(o => !["DELIVERED", "CANCELLED", "FAILED"].includes(o.status)).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No active orders</div>
              ) : (
                <div className="space-y-3">
                  {orders.filter(o => !["DELIVERED", "CANCELLED", "FAILED"].includes(o.status)).slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.orderNumber}</span>
                          {getOrderTypeBadge(order.orderType)}
                        </div>
                        <div className="text-sm text-muted-foreground">{order.customerName}</div>
                        <div className="text-xs text-muted-foreground">
                          Due: {new Date(order.promisedDeliveryTime).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(order.status)}
                        <div className="text-sm font-medium mt-1">Rs. {order.totalAmount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Riders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bike className="h-5 w-5" />
                Active Riders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : riders.filter(r => r.status !== "OFFLINE").length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No riders online</div>
              ) : (
                <div className="space-y-3">
                  {riders.filter(r => r.status !== "OFFLINE").map((rider) => (
                    <div key={rider.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${rider.status === "ONLINE" ? "bg-green-500" : rider.status === "BUSY" ? "bg-yellow-500" : "bg-gray-400"}`} />
                        <div>
                          <div className="font-medium">{rider.name}</div>
                          <div className="text-xs text-muted-foreground">{rider.riderCode} • {rider.vehicleType}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(rider.status)}
                        <div className="text-xs text-muted-foreground mt-1">{rider.todayDeliveries} today</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle>Hyperlocal Orders</CardTitle>
            <p className="text-sm text-muted-foreground">Express and same-day delivery orders</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Order</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Customer</th>
                      <th className="px-4 py-2 text-left font-medium">Dark Store</th>
                      <th className="px-4 py-2 text-left font-medium">Rider</th>
                      <th className="px-4 py-2 text-left font-medium">Due Time</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{order.orderNumber}</td>
                        <td className="px-4 py-2">{getOrderTypeBadge(order.orderType)}</td>
                        <td className="px-4 py-2">
                          <div>{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                        </td>
                        <td className="px-4 py-2">{order.darkStore?.name}</td>
                        <td className="px-4 py-2">{order.rider?.name || "-"}</td>
                        <td className="px-4 py-2">{new Date(order.promisedDeliveryTime).toLocaleTimeString()}</td>
                        <td className="px-4 py-2">{getStatusBadge(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "riders" && (
        <Card>
          <CardHeader>
            <CardTitle>Hyperlocal Riders</CardTitle>
            <p className="text-sm text-muted-foreground">Manage delivery riders for quick commerce</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : riders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Bike className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No riders registered</p>
                <Button variant="outline" className="mt-4">Add First Rider</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Rider</th>
                      <th className="px-4 py-2 text-left font-medium">Vehicle</th>
                      <th className="px-4 py-2 text-left font-medium">Dark Store</th>
                      <th className="px-4 py-2 text-left font-medium">Today</th>
                      <th className="px-4 py-2 text-left font-medium">Rating</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map((rider) => (
                      <tr key={rider.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="font-medium">{rider.name}</div>
                          <div className="text-xs text-muted-foreground">{rider.riderCode}</div>
                        </td>
                        <td className="px-4 py-2">{rider.vehicleType}</td>
                        <td className="px-4 py-2">{rider.darkStore?.name || "-"}</td>
                        <td className="px-4 py-2">{rider.todayDeliveries}</td>
                        <td className="px-4 py-2">{rider.avgRating.toFixed(1)} ★</td>
                        <td className="px-4 py-2">{getStatusBadge(rider.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "stores" && (
        <Card>
          <CardHeader>
            <CardTitle>Dark Stores</CardTitle>
            <p className="text-sm text-muted-foreground">Micro-fulfillment centers for hyperlocal delivery</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : darkStores.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Store className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No dark stores configured</p>
                <Button variant="outline" className="mt-4">Add First Dark Store</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {darkStores.map((store) => (
                  <Card key={store.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{store.name}</CardTitle>
                        <Badge variant={store.isActive ? "success" : "default"}>
                          {store.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{store.code}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{store.city} - {store.pincode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Coverage:</span>
                          <span>{store.serviceRadiusKm} km radius</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capacity:</span>
                          <span>{store.maxOrdersPerHour}/hour</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Riders:</span>
                          <span>{store._count.riders}</span>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Utilization</span>
                            <span>{store.currentUtilization.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full ${store.currentUtilization > 80 ? "bg-red-500" : store.currentUtilization > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(store.currentUtilization, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
