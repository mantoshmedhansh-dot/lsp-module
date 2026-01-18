"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  gst: string | null;
  pan: string | null;
  cin: string | null;
  createdAt: string;
  _count: {
    locations: number;
    users: number;
  };
}

export default function CompanyPage() {
  const { data: session } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    legalName: "",
    gst: "",
    pan: "",
    cin: "",
  });

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      const response = await fetch("/api/v1/companies");
      if (!response.ok) throw new Error("Failed to fetch companies");
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingCompany
        ? `/api/v1/companies/${editingCompany.id}`
        : "/api/v1/companies";
      const method = editingCompany ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save company");
      }

      toast.success(editingCompany ? "Company updated" : "Company created");
      setIsDialogOpen(false);
      setEditingCompany(null);
      setFormData({
        code: "",
        name: "",
        legalName: "",
        gst: "",
        pan: "",
        cin: "",
      });
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save company"
      );
    }
  }

  async function handleDelete(company: Company) {
    if (
      !confirm(
        `Are you sure you want to delete ${company.name}? This will also delete all associated data.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/v1/companies/${company.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete company");
      }

      toast.success("Company deleted");
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete company"
      );
    }
  }

  function openEditDialog(company: Company) {
    setEditingCompany(company);
    setFormData({
      code: company.code,
      name: company.name,
      legalName: company.legalName || "",
      gst: company.gst || "",
      pan: company.pan || "",
      cin: company.cin || "",
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingCompany(null);
    setFormData({
      code: "",
      name: "",
      legalName: "",
      gst: "",
      pan: "",
      cin: "",
    });
    setIsDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Company Management
          </h1>
          <p className="text-muted-foreground">
            Manage companies and their settings
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            A list of all companies in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No companies found</p>
              {isSuperAdmin && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first company
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Badge variant="outline">{company.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {company.name}
                      {company.legalName && (
                        <p className="text-xs text-muted-foreground">
                          {company.legalName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{company.gst || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {company._count.locations}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {company._count.users}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isSuperAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(company)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(company)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Company Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Create Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company details below."
                : "Fill in the details to create a new company."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Company Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., ACME"
                  disabled={!!editingCompany}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Acme Corporation"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) =>
                    setFormData({ ...formData, legalName: e.target.value })
                  }
                  placeholder="e.g., Acme Corporation Pvt. Ltd."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={formData.gst}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gst: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., 27AABCU9603R1ZM"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pan: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., AABCU9603R"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cin">CIN</Label>
                <Input
                  id="cin"
                  value={formData.cin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cin: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g., U74999MH2020PTC123456"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingCompany ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
