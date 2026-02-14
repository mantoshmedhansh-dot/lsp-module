"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Building2,
  Search,
  Handshake,
  Eye,
  Upload,
  AlertTriangle,
  Clock,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Client {
  id: string;
  code: string;
  name: string;
  companyType: string;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ContractInfo {
  brandCompanyId: string;
  status: string;
  contractEnd: string | null;
}

export default function ClientsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";

  useEffect(() => {
    fetchClients();
    fetchContracts();
  }, [search]);

  async function fetchClients() {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const response = await fetch(`/api/v1/platform/clients?${params}`);
      if (!response.ok) throw new Error("Failed to fetch clients");
      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : data?.items || data?.data || [];
      setClients(items);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchContracts() {
    try {
      const response = await fetch("/api/v1/platform/clients/contracts/all");
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : data?.items || data?.data || [];
        setContracts(items);
      }
    } catch {
      // silent
    }
  }

  function getContractExpiry(clientId: string): { daysLeft: number | null; status: string | null } {
    const contract = contracts.find((c) => c.brandCompanyId === clientId);
    if (!contract) return { daysLeft: null, status: null };
    if (!contract.contractEnd) return { daysLeft: null, status: contract.status };
    const daysLeft = Math.ceil(
      (new Date(contract.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return { daysLeft, status: contract.status };
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove client "${name}"?`)) return;
    try {
      const response = await fetch(`/api/v1/platform/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!response.ok) throw new Error("Failed to deactivate client");
      toast.success(`Client "${name}" deactivated`);
      fetchClients();
    } catch {
      toast.error("Failed to deactivate client");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Client Management
          </h1>
          <p className="text-muted-foreground">
            Manage your brand clients and service contracts
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/settings/clients/import")}
            >
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </Button>
            <Button onClick={() => router.push("/settings/clients/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Onboard Client
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Brand Clients
          </CardTitle>
          <CardDescription>
            {clients.length} client{clients.length !== 1 ? "s" : ""} under your
            LSP
          </CardDescription>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No clients yet</p>
              <p className="text-sm">
                Onboard your first brand client to get started
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/settings/clients/new")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Onboard Client
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Onboarded</TableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const { daysLeft, status: contractStatus } = getContractExpiry(client.id);
                  const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
                  const isExpired = daysLeft !== null && daysLeft <= 0;

                  return (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/settings/clients/${client.id}`)
                      }
                    >
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.code}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            client.isActive ? "default" : "secondary"
                          }
                        >
                          {client.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {contractStatus && (
                            <Badge variant="outline" className="text-xs">
                              {contractStatus}
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Expired
                            </Badge>
                          )}
                          {isExpiring && (
                            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                              <Clock className="mr-1 h-3 w-3" />
                              {daysLeft}d left
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/settings/clients/${client.id}`);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(client.id, client.name);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
