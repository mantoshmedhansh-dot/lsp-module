"use client";

import { useState, useEffect } from "react";
import { Building2, FileText, Warehouse, Package } from "lucide-react";
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
import { toast } from "sonner";

interface ContractData {
  company: { id: string; name: string; code: string; companyType: string };
  lsp: { id: string; name: string; code: string } | null;
  contract: {
    id: string;
    serviceModel: string;
    status: string;
    contractStart: string | null;
    contractEnd: string | null;
    billingType: string | null;
    billingRate: number | null;
    modules: string[];
    config: Record<string, any>;
  } | null;
  warehouses: { id: string; name: string; code: string | null; city: string | null; state: string | null }[];
}

const SERVICE_MODEL_LABELS: Record<string, string> = {
  FULL: "Full (Warehousing + Logistics)",
  WAREHOUSING: "Warehousing Only",
  LOGISTICS: "Logistics Only",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  onboarding: "outline",
  suspended: "destructive",
  terminated: "secondary",
};

export default function MyContractPage() {
  const [data, setData] = useState<ContractData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await fetch("/api/v1/platform/brand-portal/my-contract");
      if (!response.ok) throw new Error("Failed to load contract");
      setData(await response.json());
    } catch {
      toast.error("Failed to load contract information");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load contract information</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Contract</h1>
        <p className="text-muted-foreground">
          View your service contract and LSP details
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LSP Info */}
        {data.lsp && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Logistics Service Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Company Name</p>
                <p className="font-medium">{data.lsp.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Company Code</p>
                <p className="font-medium">{data.lsp.code}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contract Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Service Contract
            </CardTitle>
            {data.contract && (
              <CardDescription>
                <Badge variant={STATUS_COLORS[data.contract.status] || "outline"}>
                  {data.contract.status}
                </Badge>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {data.contract ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Service Model</p>
                    <p className="font-medium">
                      {SERVICE_MODEL_LABELS[data.contract.serviceModel] || data.contract.serviceModel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing</p>
                    <p className="font-medium">
                      {data.contract.billingType || "Not specified"}
                      {data.contract.billingRate != null && ` — ₹${data.contract.billingRate}`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {data.contract.contractStart
                        ? new Date(data.contract.contractStart).toLocaleDateString()
                        : "Open"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {data.contract.contractEnd
                        ? new Date(data.contract.contractEnd).toLocaleDateString()
                        : "Ongoing"}
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

      {/* Assigned Warehouses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Assigned Warehouses
          </CardTitle>
          <CardDescription>
            {data.warehouses.length} warehouse{data.warehouses.length !== 1 ? "s" : ""} assigned to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No warehouses assigned yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.warehouses.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell className="text-muted-foreground">{wh.code || "—"}</TableCell>
                    <TableCell>{wh.city || "—"}</TableCell>
                    <TableCell>{wh.state || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Enabled Modules */}
      {data.contract?.modules && data.contract.modules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Enabled Modules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.contract.modules.map((mod) => (
                <Badge key={mod} variant="outline">
                  {mod}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
