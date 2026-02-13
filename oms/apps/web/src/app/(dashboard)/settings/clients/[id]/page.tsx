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
import { Separator } from "@/components/ui/separator";
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
  createdAt: string;
  updatedAt: string;
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
  const [warehouses, setWarehouses] = useState<{id: string; name: string; code: string | null; city: string | null}[]>([]);
  const [contractForm, setContractForm] = useState({
    serviceModel: "FULL",
    status: "active",
    billingType: "per_order",
    billingRate: "0",
    contractStart: "",
    contractEnd: "",
    warehouseIds: [] as string[],
  });

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
    } catch (error) {
      toast.error("Failed to load client");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchContract() {
    try {
      const response = await fetch(
        `/api/v1/platform/clients/${clientId}/contract`
      );
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
      }
    } catch {
      // No contract yet — that's fine
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
      toast.error("Could not load available warehouses");
    }
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
      const response = await fetch(
        `/api/v1/platform/clients/${clientId}/contract`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            contract
              ? payload
              : {
                  ...payload,
                  lspCompanyId: "",
                  brandCompanyId: clientId,
                }
          ),
        }
      );

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
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/settings/clients")}
        >
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/settings/clients")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground">
            {client.code} &middot; Onboarded{" "}
            {new Date(client.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={client.isActive ? "default" : "secondary"}>
          {client.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Info */}
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

        {/* Service Contract */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Service Contract
              </CardTitle>
              {isAdmin && !isEditingContract && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingContract(true)}
                >
                  <Pencil className="mr-2 h-3 w-3" />
                  {contract ? "Edit" : "Create"}
                </Button>
              )}
            </div>
            {contract && (
              <CardDescription>
                <Badge variant={STATUS_COLORS[contract.status] || "outline"}>
                  {contract.status}
                </Badge>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isEditingContract ? (
              <form onSubmit={handleSaveContract} className="space-y-4">
                <div className="space-y-2">
                  <Label>Service Model</Label>
                  <Select
                    value={contractForm.serviceModel}
                    onValueChange={(v) =>
                      setContractForm({ ...contractForm, serviceModel: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL">
                        Full (Warehousing + Logistics)
                      </SelectItem>
                      <SelectItem value="WAREHOUSING">
                        Warehousing Only
                      </SelectItem>
                      <SelectItem value="LOGISTICS">
                        Logistics Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contract Status</Label>
                  <Select
                    value={contractForm.status}
                    onValueChange={(v) =>
                      setContractForm({ ...contractForm, status: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Select
                    value={contractForm.billingType}
                    onValueChange={(v) =>
                      setContractForm({ ...contractForm, billingType: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={contractForm.billingRate}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        billingRate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={contractForm.contractStart}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          contractStart: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={contractForm.contractEnd}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          contractEnd: e.target.value,
                        })
                      }
                    />
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingContract(false)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </form>
            ) : contract ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Service Model
                    </p>
                    <p className="font-medium">
                      {SERVICE_MODEL_LABELS[contract.serviceModel] ||
                        contract.serviceModel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Billing Type
                    </p>
                    <p className="font-medium">
                      {BILLING_TYPE_LABELS[contract.billingType || ""] ||
                        contract.billingType ||
                        "Not set"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Billing Rate
                    </p>
                    <p className="font-medium">
                      {contract.billingRate != null
                        ? `₹${parseFloat(String(contract.billingRate)).toFixed(2)}`
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Period</p>
                    <p className="font-medium">
                      {contract.contractStart
                        ? new Date(contract.contractStart).toLocaleDateString()
                        : "Open"}
                      {" — "}
                      {contract.contractEnd
                        ? new Date(contract.contractEnd).toLocaleDateString()
                        : "Ongoing"}
                    </p>
                  </div>
                </div>
                {contract.warehouseIds && contract.warehouseIds.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Assigned Warehouses
                    </p>
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
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setIsEditingContract(true)}
                  >
                    Create Contract
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
