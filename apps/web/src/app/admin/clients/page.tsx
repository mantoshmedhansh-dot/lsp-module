"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  Package,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Search,
  Building2,
  Users,
  Warehouse,
  CreditCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

interface Client {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstNumber: string | null;
  billingAddress: string | null;
  status: string;
  createdAt: string;
  _count: {
    users: number;
    warehouses: number;
    orders: number;
    pickupRequests: number;
    supportTickets: number;
  };
}

interface ClientStats {
  totalOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  totalPickups: number;
  pendingPickups: number;
  completedPickups: number;
  openTickets: number;
  totalWarehouses: number;
  totalUsers: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    consigneeName: string;
    destinationCity: string;
  }>;
  recentPickups: Array<{
    id: string;
    pickupNumber: string;
    status: string;
    scheduledDate: string;
    warehouseName: string;
  }>;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchClientStats(selectedClient.id);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/admin/clients");
      const data = await response.json();
      if (data.success) {
        setClients(data.data);
        if (data.data.length > 0) {
          setSelectedClient(data.data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientStats = async (clientId: string) => {
    setStatsLoading(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/stats`);
      const data = await response.json();
      if (data.success) {
        setClientStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch client stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "SUSPENDED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "IN_TRANSIT":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
      case "PENDING_PICKUP":
        return "bg-yellow-100 text-yellow-800";
      case "FAILED":
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-gray-600 mt-1">
            View and manage client operations and KPIs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Client List Sidebar */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No clients found</p>
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors ${
                    selectedClient?.id === client.id ? "bg-primary-50 border-l-4 border-l-primary-600" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{client.companyName}</h3>
                      <p className="text-sm text-gray-500 mt-1">{client.contactPerson}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {client._count.orders} orders
                        </span>
                        <span className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3" />
                          {client._count.warehouses} warehouses
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Client Details & KPIs */}
        <div className="col-span-8 space-y-6">
          {selectedClient ? (
            <>
              {/* Client Info Card */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-primary-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedClient.companyName}</h2>
                      <p className="text-gray-500">{selectedClient.contactPerson}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {selectedClient.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {selectedClient.phone}
                        </span>
                      </div>
                      {selectedClient.gstNumber && (
                        <p className="text-sm text-gray-500 mt-1">GST: {selectedClient.gstNumber}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedClient.status)}`}>
                    {selectedClient.status}
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              {statsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : clientStats ? (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <Package className="h-8 w-8 text-blue-500" />
                        <span className="text-xs text-green-600 flex items-center">
                          <ArrowUpRight className="h-3 w-3" />
                          12%
                        </span>
                      </div>
                      <p className="text-2xl font-bold mt-2">{clientStats.totalOrders}</p>
                      <p className="text-sm text-gray-500">Total Orders</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <Truck className="h-8 w-8 text-orange-500" />
                        <span className="text-xs text-blue-600 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      </div>
                      <p className="text-2xl font-bold mt-2">{clientStats.inTransitOrders}</p>
                      <p className="text-sm text-gray-500">In Transit</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <span className="text-xs text-green-600">
                          {clientStats.totalOrders > 0
                            ? Math.round((clientStats.deliveredOrders / clientStats.totalOrders) * 100)
                            : 0}%
                        </span>
                      </div>
                      <p className="text-2xl font-bold mt-2">{clientStats.deliveredOrders}</p>
                      <p className="text-sm text-gray-500">Delivered</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center justify-between">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                        <span className="text-xs text-red-600 flex items-center">
                          <ArrowDownRight className="h-3 w-3" />
                          3%
                        </span>
                      </div>
                      <p className="text-2xl font-bold mt-2">{clientStats.failedOrders}</p>
                      <p className="text-sm text-gray-500">Exceptions</p>
                    </div>
                  </div>

                  {/* Secondary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Truck className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{clientStats.totalPickups}</p>
                          <p className="text-sm text-gray-500">Total Pickups</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="text-yellow-600">
                          {clientStats.pendingPickups} pending
                        </span>
                        <span className="text-green-600">
                          {clientStats.completedPickups} completed
                        </span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <FileText className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{clientStats.openTickets}</p>
                          <p className="text-sm text-gray-500">Open Tickets</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{clientStats.totalUsers}</p>
                          <p className="text-sm text-gray-500">Portal Users</p>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        {clientStats.totalWarehouses} warehouses
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Recent Orders */}
                    <div className="bg-white rounded-xl shadow-sm border">
                      <div className="p-4 border-b flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Recent Orders</h3>
                        <span className="text-sm text-primary-600 cursor-pointer hover:underline">
                          View All
                        </span>
                      </div>
                      <div className="divide-y">
                        {clientStats.recentOrders.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No orders yet
                          </div>
                        ) : (
                          clientStats.recentOrders.slice(0, 5).map((order) => (
                            <div key={order.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{order.orderNumber}</p>
                                  <p className="text-xs text-gray-500">
                                    {order.consigneeName} - {order.destinationCity}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                                  {order.status.replace(/_/g, " ")}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Recent Pickups */}
                    <div className="bg-white rounded-xl shadow-sm border">
                      <div className="p-4 border-b flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Recent Pickups</h3>
                        <span className="text-sm text-primary-600 cursor-pointer hover:underline">
                          View All
                        </span>
                      </div>
                      <div className="divide-y">
                        {clientStats.recentPickups.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No pickups yet
                          </div>
                        ) : (
                          clientStats.recentPickups.slice(0, 5).map((pickup) => (
                            <div key={pickup.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-sm">{pickup.pickupNumber}</p>
                                  <p className="text-xs text-gray-500">
                                    {pickup.warehouseName}
                                  </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOrderStatusColor(pickup.status)}`}>
                                  {pickup.status.replace(/_/g, " ")}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No statistics available for this client</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <Briefcase className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">Select a Client</h3>
              <p className="text-gray-500 mt-1">
                Choose a client from the list to view their KPIs and operations
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
