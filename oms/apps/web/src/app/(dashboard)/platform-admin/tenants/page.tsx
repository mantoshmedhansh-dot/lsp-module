"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Eye, MoreHorizontal, Building2, Users, CreditCard, TrendingUp, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  company: { id: string; name: string; code: string; createdAt: string };
  subscription: { planName: string; status: string; trialEndsAt: string } | null;
}

export default function TenantsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", gst: "", pan: "" });
  const [isSaving, setIsSaving] = useState(false);

  function openEditDialog(t: Tenant) {
    setEditingTenant(t);
    setEditForm({ name: t.company.name, gst: "", pan: "" });
    // Fetch full company details for GST/PAN
    fetch(`/api/v1/companies/${t.company.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setEditForm({ name: data.name, gst: data.gst || "", pan: data.pan || "" });
      });
    setEditDialogOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTenant) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/v1/companies/${editingTenant.company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Company updated");
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    } catch {
      toast.error("Failed to update company");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(t: Tenant) {
    if (!confirm(`Are you sure you want to delete ${t.company.name}?`)) return;
    try {
      const res = await fetch(`/api/v1/companies/${t.company.id}`, { method: "DELETE" });
      if (res.status === 204 || res.ok) {
        toast.success("Company deleted");
        queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete company");
    }
  }

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");
      const res = await fetch(`/api/v1/platform/admin/tenants?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const tenantList: Tenant[] = Array.isArray(tenants) ? tenants : tenants?.items || [];

  const filteredTenants = statusFilter === "all"
    ? tenantList
    : tenantList.filter((t) => t.subscription?.status === statusFilter);

  const activeCount = tenantList.filter((t) => t.subscription?.status === "active").length;
  const trialingCount = tenantList.filter((t) => t.subscription?.status === "trialing").length;

  const stats = [
    { label: "Total Tenants", value: tenantList.length, icon: Building2, color: "blue" },
    { label: "Active", value: activeCount, icon: CreditCard, color: "green" },
    { label: "Trialing", value: trialingCount, icon: TrendingUp, color: "amber" },
    { label: "Unique Plans", value: new Set(tenantList.map((t) => t.subscription?.planName).filter(Boolean)).size, icon: Users, color: "purple" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Tenants</h1>
          <p className="text-muted-foreground">Manage tenant companies and subscriptions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className="rounded-lg p-3"
                style={{
                  backgroundColor:
                    stat.color === "blue" ? "#dbeafe"
                      : stat.color === "green" ? "#dcfce7"
                        : stat.color === "amber" ? "#fef3c7"
                          : "#f3e8ff",
                }}
              >
                <stat.icon
                  className="h-5 w-5"
                  style={{
                    color:
                      stat.color === "blue" ? "#2563eb"
                        : stat.color === "green" ? "#16a34a"
                          : stat.color === "amber" ? "#d97706"
                            : "#9333ea",
                  }}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Tenants</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name or code..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((t) => (
                  <TableRow key={t.company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium">{t.company.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.company.code}</Badge>
                    </TableCell>
                    <TableCell>{t.subscription?.planName || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.subscription?.status === "active"
                            ? "default"
                            : t.subscription?.status === "trialing"
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          t.subscription?.status === "active"
                            ? "bg-green-100 text-green-700"
                            : t.subscription?.status === "trialing"
                              ? "bg-amber-100 text-amber-700"
                              : ""
                        }
                      >
                        {t.subscription?.status || "none"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.subscription?.trialEndsAt
                        ? new Date(t.subscription.trialEndsAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(t.company.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/platform-admin/tenants/${t.company.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(t)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Company
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/settings/users?companyId=${t.company.id}`)}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Users
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/settings/locations?companyId=${t.company.id}`)}>
                            <MapPin className="mr-2 h-4 w-4" />
                            Manage Locations
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(t)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tenants found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company details for {editingTenant?.company.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Company Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>GST Number</Label>
                  <Input
                    value={editForm.gst}
                    onChange={(e) => setEditForm({ ...editForm, gst: e.target.value.toUpperCase() })}
                    placeholder="27AABCU9603R1ZM"
                    maxLength={15}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>PAN Number</Label>
                  <Input
                    value={editForm.pan}
                    onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                    placeholder="AABCU9603R"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
