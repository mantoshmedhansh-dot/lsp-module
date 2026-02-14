"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Building2,
  FileText,
  Pencil,
  Save,
  X,
  Warehouse,
  Users,
  Plus,
  BarChart3,
  ShieldCheck,
  CreditCard,
  UserPlus,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Client {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  gst: string | null;
  pan: string | null;
  companyType: string;
  isActive: boolean;
  createdAt: string;
}

interface Contract {
  id: string;
  lspCompanyId: string;
  brandCompanyId: string;
  serviceModel: string;
  status: string;
  contractStart: string | null;
  contractEnd: string | null;
  billingType: string | null;
  billingRate: number | null;
  warehouseIds: string[] | null;
  modules: string[] | null;
  config: Record<string, any> | null;
  slaConfig: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string | null;
}

interface DashboardData {
  totalOrders: number;
  revenue: number;
  fulfillmentRate: number;
  statusCounts: Record<string, number>;
  orderTrend: { date: string; count: number }[];
  inventorySummary: { warehouseId: string; warehouseName: string; totalQty: number }[];
  period: number;
}

const SERVICE_MODEL_LABELS: Record<string, string> = {
  FULL: "Full (Warehousing + Logistics)",
  WAREHOUSING: "Warehousing Only (3PL)",
  LOGISTICS: "Logistics Only (Carrier)",
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  per_order: "Per Order",
  per_sqft: "Per Sq.Ft",
  fixed: "Fixed Monthly",
  hybrid: "Hybrid",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  onboarding: "outline",
  suspended: "destructive",
  terminated: "secondary",
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingContract, setIsEditingContract] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string | null; city: string | null }[]>([]);
  const [contractForm, setContractForm] = useState({
    serviceModel: "FULL",
    status: "active",
    billingType: "per_order",
    billingRate: "0",
    contractStart: "",
    contractEnd: "",
    warehouseIds: [] as string[],
  });

  // Users tab state
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "CLIENT" });

  // Dashboard tab state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState("30");

  // Rate Cards tab state
  const [rateCards, setRateCards] = useState<Record<string, string>>({});
  const [rateCardsLoading, setRateCardsLoading] = useState(false);

  // SLA tab state
  const [slaCompliance, setSlaCompliance] = useState<any>(null);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaForm, setSlaForm] = useState({
    targetDispatchHours: "",
    targetDeliveryDays: "",
    targetAccuracyRate: "",
    targetReturnRate: "",
  });
  const [editingSla, setEditingSla] = useState(false);

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";

  useEffect(() => {
    fetchClient();
    fetchContract();
    fetchWarehouses();
  }, [clientId]);

  async function fetchClient() {
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}`);
      if (!response.ok) throw new Error("Client not found");
      const data = await response.json();
      setClient(data);
    } catch {
      toast.error("Failed to load client");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchContract() {
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}/contract`);
      if (response.ok) {
        const data = await response.json();
        setContract(data);
        setContractForm({
          serviceModel: data.serviceModel || "FULL",
          status: data.status || "active",
          billingType: data.billingType || "per_order",
          billingRate: String(data.billingRate ?? 0),
          contractStart: data.contractStart || "",
          contractEnd: data.contractEnd || "",
          warehouseIds: data.warehouseIds || [],
        });
        const sla = data.slaConfig || {};
        setSlaForm({
          targetDispatchHours: String(sla.targetDispatchHours ?? ""),
          targetDeliveryDays: String(sla.targetDeliveryDays ?? ""),
          targetAccuracyRate: String(sla.targetAccuracyRate ?? ""),
          targetReturnRate: String(sla.targetReturnRate ?? ""),
        });
      }
    } catch {
      // No contract yet
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch(`/api/v1/platform/clients/warehouses/available`);
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : data?.items || data?.data || [];
        setWarehouses(items);
      }
    } catch {
      // silent
    }
  }

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data?.items || data?.data || []);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }

  async function fetchDashboard(days: string) {
    setDashboardLoading(true);
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}/dashboard?days=${days}`);
      if (response.ok) {
        setDashboard(await response.json());
      }
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setDashboardLoading(false);
    }
  }

  async function fetchRateCards() {
    setRateCardsLoading(true);
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}/rate-cards`);
      if (response.ok) {
        const data = await response.json();
        setRateCards(data.rateCards || {});
      }
    } catch {
      toast.error("Failed to load rate cards");
    } finally {
      setRateCardsLoading(false);
    }
  }

  async function fetchSlaCompliance() {
    setSlaLoading(true);
    try {
      const response = await fetch(`/api/v1/platform/clients/${clientId}/sla-compliance?days=30`);
      if (response.ok) {
        setSlaCompliance(await response.json());
      }
    } catch {
      // silent
    } finally {
      setSlaLoading(false);
    }
  }

  function handleTabChange(value: string) {
    if (value === "users" && users.length === 0) fetchUsers();
    if (value === "dashboard" && !dashboard) fetchDashboard(dashboardPeriod);
    if (value === "rate-cards" && Object.keys(rateCards).length === 0) fetchRateCards();
    if (value === "sla" && !slaCompliance) fetchSlaCompliance();
  }

  async function handleSaveContract(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        serviceModel: contractForm.serviceModel,
        status: contractForm.status,
        billingType: contractForm.billingType,
        billingRate: parseFloat(contractForm.billingRate) || 0,
        contractStart: contractForm.contractStart || null,
        contractEnd: contractForm.contractEnd || null,
        warehouseIds: contractForm.warehouseIds,
      };

      const method = contract ? "PATCH" : "POST";
      const response = await fetch(`/api/v1/platform/clients/${clientId}/contract`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          contract ? payload : { ...payload, lspCompanyId: "", brandCompanyId: clientId }
        ),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to save contract");
      }

      const data = await response.json();
      setContract(data);
      setIsEditingContract(false);
      toast.success("Contract saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save contract");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUser, companyId: clientId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to create user");
      }
      toast.success("User created successfully");
      setShowAddUser(false);
      setNewUser({ name: "", email: "", password: "", role: "CLIENT" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  }

  async function handleToggleUser(userId: string, isActive: boolean) {
    try {
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!response.ok) throw new Error("Failed to update user");
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
      fetchUsers();
    } catch {
      toast.error("Failed to update user");
    }
  }

  async function handleSaveRateCards(type: string, cardId: string) {
    try {
      const updated = { ...rateCards, [type]: cardId };
      const response = await fetch(`/api/v1/platform/clients/${clientId}/rate-cards`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateCards: updated }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setRateCards(updated);
      toast.success("Rate card updated");
    } catch {
      toast.error("Failed to save rate card");
    }
  }

  async function handleSaveSla(e: React.FormEvent) {
    e.preventDefault();
    try {
      const slaConfig: Record<string, number> = {};
      if (slaForm.targetDispatchHours) slaConfig.targetDispatchHours = parseFloat(slaForm.targetDispatchHours);
      if (slaForm.targetDeliveryDays) slaConfig.targetDeliveryDays = parseFloat(slaForm.targetDeliveryDays);
      if (slaForm.targetAccuracyRate) slaConfig.targetAccuracyRate = parseFloat(slaForm.targetAccuracyRate);
      if (slaForm.targetReturnRate) slaConfig.targetReturnRate = parseFloat(slaForm.targetReturnRate);

      const response = await fetch(`/api/v1/platform/clients/${clientId}/contract`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaConfig }),
      });
      if (!response.ok) throw new Error("Failed to save SLA config");
      toast.success("SLA targets saved");
      setEditingSla(false);
      fetchSlaCompliance();
      fetchContract();
    } catch {
      toast.error("Failed to save SLA targets");
    }
  }

  // Contract expiry warning
  const contractExpiryDays = contract?.contractEnd
    ? Math.ceil((new Date(contract.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiring = contractExpiryDays !== null && contractExpiryDays <= 30 && contractExpiryDays > 0;
  const isExpired = contractExpiryDays !== null && contractExpiryDays <= 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Client not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/settings/clients")}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings/clients")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground">
            {client.code} &middot; Onboarded {new Date(client.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={client.isActive ? "default" : "secondary"}>
          {client.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Expiry Warning Banner */}
      {(isExpiring || isExpired) && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${isExpired ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            {isExpired
              ? "Contract has expired. Please renew to continue services."
              : `Contract expires in ${contractExpiryDays} day${contractExpiryDays !== 1 ? "s" : ""}. Please review and renew.`}
          </p>
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="contract">
            <FileText className="mr-2 h-4 w-4" />
            Contract
          </TabsTrigger>
          <TabsTrigger value="rate-cards">
            <CreditCard className="mr-2 h-4 w-4" />
            Rate Cards
          </TabsTrigger>
          <TabsTrigger value="sla">
            <ShieldCheck className="mr-2 h-4 w-4" />
            SLA
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Company Name</p>
                    <p className="font-medium">{client.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Code</p>
                    <p className="font-medium">{client.code}</p>
                  </div>
                </div>
                {client.legalName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Legal Name</p>
                    <p className="font-medium">{client.legalName}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {client.gst && (
                    <div>
                      <p className="text-sm text-muted-foreground">GST</p>
                      <p className="font-medium">{client.gst}</p>
                    </div>
                  )}
                  {client.pan && (
                    <div>
                      <p className="text-sm text-muted-foreground">PAN</p>
                      <p className="font-medium">{client.pan}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contract Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contract ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={STATUS_COLORS[contract.status] || "outline"}>
                          {contract.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Service Model</p>
                        <p className="font-medium">{SERVICE_MODEL_LABELS[contract.serviceModel] || contract.serviceModel}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Billing</p>
                        <p className="font-medium">
                          {BILLING_TYPE_LABELS[contract.billingType || ""] || contract.billingType || "Not set"}
                          {contract.billingRate != null && ` — ₹${parseFloat(String(contract.billingRate)).toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Period</p>
                        <p className="font-medium">
                          {contract.contractStart ? new Date(contract.contractStart).toLocaleDateString() : "Open"}
                          {" — "}
                          {contract.contractEnd ? new Date(contract.contractEnd).toLocaleDateString() : "Ongoing"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contract configured</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Dashboard Tab (Feature 4) ──────────────────────────────── */}
        <TabsContent value="dashboard">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Performance Dashboard</h3>
              <Select value={dashboardPeriod} onValueChange={(v) => { setDashboardPeriod(v); fetchDashboard(v); }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dashboardLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : dashboard ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Orders</CardDescription>
                      <CardTitle className="text-3xl">{dashboard.totalOrders}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Revenue</CardDescription>
                      <CardTitle className="text-3xl">₹{dashboard.revenue.toLocaleString()}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Fulfillment Rate</CardDescription>
                      <CardTitle className="text-3xl">{dashboard.fulfillmentRate}%</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Warehouses</CardDescription>
                      <CardTitle className="text-3xl">{dashboard.inventorySummary.length}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {Object.keys(dashboard.statusCounts).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Orders by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(dashboard.statusCounts).map(([s, c]) => (
                          <Badge key={s} variant="outline" className="text-sm px-3 py-1">
                            {s}: {c}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {dashboard.orderTrend.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Order Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.orderTrend.slice(-10).map((t) => (
                            <TableRow key={t.date}>
                              <TableCell>{t.date}</TableCell>
                              <TableCell className="text-right">{t.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {dashboard.inventorySummary.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory by Warehouse</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Warehouse</TableHead>
                            <TableHead className="text-right">Total Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.inventorySummary.map((inv) => (
                            <TableRow key={inv.warehouseId}>
                              <TableCell>{inv.warehouseName}</TableCell>
                              <TableCell className="text-right">{inv.totalQty.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No data available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Users Tab (Feature 1) ──────────────────────────────────── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Client Users
                  </CardTitle>
                  <CardDescription>{users.length} user{users.length !== 1 ? "s" : ""}</CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add User to {client.name}</DialogTitle>
                        <DialogDescription>Create a new user account for this client company.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddUser} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Password</Label>
                          <Input type="password" required minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CLIENT">Client</SelectItem>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                              <SelectItem value="OPERATOR">Operator</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                          <Button type="submit" disabled={addingUser}>{addingUser ? "Creating..." : "Create User"}</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No users yet</p>
                  {isAdmin && <p className="text-sm mt-1">Click &quot;Add User&quot; to create the first user for this client.</p>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isActive ? "default" : "secondary"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUser(u.id, u.isActive)}
                              title={u.isActive ? "Deactivate" : "Activate"}
                            >
                              {u.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contract Tab ───────────────────────────────────────────── */}
        <TabsContent value="contract">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Service Contract
                </CardTitle>
                {isAdmin && !isEditingContract && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingContract(true)}>
                    <Pencil className="mr-2 h-3 w-3" />
                    {contract ? "Edit" : "Create"}
                  </Button>
                )}
              </div>
              {contract && (
                <CardDescription>
                  <Badge variant={STATUS_COLORS[contract.status] || "outline"}>{contract.status}</Badge>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {isEditingContract ? (
                <form onSubmit={handleSaveContract} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Service Model</Label>
                    <Select value={contractForm.serviceModel} onValueChange={(v) => setContractForm({ ...contractForm, serviceModel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL">Full (Warehousing + Logistics)</SelectItem>
                        <SelectItem value="WAREHOUSING">Warehousing Only</SelectItem>
                        <SelectItem value="LOGISTICS">Logistics Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contract Status</Label>
                    <Select value={contractForm.status} onValueChange={(v) => setContractForm({ ...contractForm, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Type</Label>
                    <Select value={contractForm.billingType} onValueChange={(v) => setContractForm({ ...contractForm, billingType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_order">Per Order</SelectItem>
                        <SelectItem value="per_sqft">Per Sq.Ft</SelectItem>
                        <SelectItem value="fixed">Fixed Monthly</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Rate</Label>
                    <Input type="number" step="0.01" min="0" value={contractForm.billingRate} onChange={(e) => setContractForm({ ...contractForm, billingRate: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={contractForm.contractStart} onChange={(e) => setContractForm({ ...contractForm, contractStart: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={contractForm.contractEnd} onChange={(e) => setContractForm({ ...contractForm, contractEnd: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Warehouses</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                      {warehouses.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No warehouses available</p>
                      ) : (
                        warehouses.map((wh) => (
                          <label key={wh.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={contractForm.warehouseIds.includes(wh.id)}
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...contractForm.warehouseIds, wh.id]
                                  : contractForm.warehouseIds.filter((id) => id !== wh.id);
                                setContractForm({ ...contractForm, warehouseIds: ids });
                              }}
                              className="rounded border-gray-300"
                            />
                            <span>{wh.name}</span>
                            {wh.city && <span className="text-muted-foreground">({wh.city})</span>}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? "Saving..." : "Save Contract"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditingContract(false)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : contract ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Service Model</p>
                      <p className="font-medium">{SERVICE_MODEL_LABELS[contract.serviceModel] || contract.serviceModel}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Type</p>
                      <p className="font-medium">{BILLING_TYPE_LABELS[contract.billingType || ""] || contract.billingType || "Not set"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Rate</p>
                      <p className="font-medium">{contract.billingRate != null ? `₹${parseFloat(String(contract.billingRate)).toFixed(2)}` : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Period</p>
                      <p className="font-medium">
                        {contract.contractStart ? new Date(contract.contractStart).toLocaleDateString() : "Open"}
                        {" — "}
                        {contract.contractEnd ? new Date(contract.contractEnd).toLocaleDateString() : "Ongoing"}
                      </p>
                    </div>
                  </div>
                  {contract.warehouseIds && contract.warehouseIds.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned Warehouses</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {contract.warehouseIds.map((id: string) => {
                          const wh = warehouses.find((w) => w.id === id);
                          return (
                            <Badge key={id} variant="outline">
                              <Warehouse className="mr-1 h-3 w-3" />
                              {wh ? wh.name : id.slice(0, 8) + "..."}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No contract configured</p>
                  {isAdmin && (
                    <Button variant="outline" className="mt-3" onClick={() => setIsEditingContract(true)}>
                      Create Contract
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rate Cards Tab (Feature 6) ─────────────────────────────── */}
        <TabsContent value="rate-cards">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Rate Card Assignments
              </CardTitle>
              <CardDescription>Associate shipping rate cards with this client</CardDescription>
            </CardHeader>
            <CardContent>
              {rateCardsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {["b2c", "ftl", "ptl"].map((type) => (
                    <div key={type} className="flex items-center justify-between border rounded-lg p-4">
                      <div>
                        <p className="font-medium">{type.toUpperCase()} Rate Card</p>
                        <p className="text-sm text-muted-foreground">
                          {rateCards[type] ? `Assigned: ${rateCards[type].slice(0, 12)}...` : "Not assigned"}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Rate card ID"
                            defaultValue={rateCards[type] || ""}
                            className="w-64"
                            onBlur={(e) => {
                              if (e.target.value !== (rateCards[type] || "")) {
                                handleSaveRateCards(type, e.target.value);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SLA Tab (Feature 8) ────────────────────────────────────── */}
        <TabsContent value="sla">
          <div className="grid gap-6 md:grid-cols-2">
            {/* SLA Config */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    SLA Targets
                  </CardTitle>
                  {isAdmin && !editingSla && (
                    <Button variant="outline" size="sm" onClick={() => setEditingSla(true)}>
                      <Pencil className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingSla ? (
                  <form onSubmit={handleSaveSla} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Target Dispatch (hours)</Label>
                      <Input type="number" step="1" min="0" value={slaForm.targetDispatchHours} onChange={(e) => setSlaForm({ ...slaForm, targetDispatchHours: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Delivery (days)</Label>
                      <Input type="number" step="1" min="0" value={slaForm.targetDeliveryDays} onChange={(e) => setSlaForm({ ...slaForm, targetDeliveryDays: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Accuracy Rate (%)</Label>
                      <Input type="number" step="0.1" min="0" max="100" value={slaForm.targetAccuracyRate} onChange={(e) => setSlaForm({ ...slaForm, targetAccuracyRate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Return Rate (%)</Label>
                      <Input type="number" step="0.1" min="0" max="100" value={slaForm.targetReturnRate} onChange={(e) => setSlaForm({ ...slaForm, targetReturnRate: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit"><Save className="mr-2 h-4 w-4" />Save</Button>
                      <Button type="button" variant="outline" onClick={() => setEditingSla(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Dispatch Target</p>
                        <p className="font-medium">{contract?.slaConfig?.targetDispatchHours ? `${contract.slaConfig.targetDispatchHours}h` : "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Delivery Target</p>
                        <p className="font-medium">{contract?.slaConfig?.targetDeliveryDays ? `${contract.slaConfig.targetDeliveryDays} days` : "Not set"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Accuracy Target</p>
                        <p className="font-medium">{contract?.slaConfig?.targetAccuracyRate ? `${contract.slaConfig.targetAccuracyRate}%` : "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Max Return Rate</p>
                        <p className="font-medium">{contract?.slaConfig?.targetReturnRate ? `${contract.slaConfig.targetReturnRate}%` : "Not set"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SLA Compliance */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {slaLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : slaCompliance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Dispatch Time</p>
                        <p className="text-2xl font-bold">{slaCompliance.avgDispatchHours}h</p>
                        {slaCompliance.compliance?.dispatchHours?.met !== null && (
                          <Badge variant={slaCompliance.compliance.dispatchHours.met ? "default" : "destructive"}>
                            {slaCompliance.compliance.dispatchHours.met ? "On Target" : "Breached"}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Accuracy Rate</p>
                        <p className="text-2xl font-bold">{slaCompliance.accuracyRate}%</p>
                        {slaCompliance.compliance?.accuracyRate?.met !== null && (
                          <Badge variant={slaCompliance.compliance.accuracyRate.met ? "default" : "destructive"}>
                            {slaCompliance.compliance.accuracyRate.met ? "On Target" : "Below Target"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Orders</p>
                        <p className="font-medium">{slaCompliance.totalOrders}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                        <p className="font-medium">{slaCompliance.deliveredOrders}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No compliance data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
