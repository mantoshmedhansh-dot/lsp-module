"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  MapPin,
  Users,
  Eye,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  gst: string | null;
  pan: string | null;
  cin: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    locations: number;
    users: number;
  };
}

export default function CompaniesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    legalName: "",
    gst: "",
    pan: "",
    cin: "",
  });
  const [previewCode, setPreviewCode] = useState<string>("");

  const canManageCompanies = session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      setIsLoading(true);
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

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: "Total Companies", value: companies.length.toString(), icon: Building2, color: "blue" },
    { label: "Active Companies", value: companies.filter(c => c.isActive !== false).length.toString(), icon: Building2, color: "green" },
    { label: "Total Warehouses", value: companies.reduce((acc, c) => acc + (c._count?.locations || 0), 0).toString(), icon: MapPin, color: "purple" },
    { label: "Total Users", value: companies.reduce((acc, c) => acc + (c._count?.users || 0), 0).toString(), icon: Users, color: "orange" },
  ];

  // Generate company code preview from name (client-side)
  function generateCodePreview(name: string): string {
    if (!name || name.length < 2) return "";

    // Common words to exclude
    const stopWords = new Set(['the', 'and', 'of', 'for', 'in', 'a', 'an', 'pvt', 'ltd', 'private', 'limited',
      'llp', 'inc', 'corp', 'corporation', 'company', 'co', 'llc']);

    // Clean and split the name
    const words = name.replace(/[^a-zA-Z\s]/g, '').toLowerCase().split(/\s+/).filter(w => w);
    const meaningfulWords = words.filter(w => !stopWords.has(w));

    // Use meaningful words, or original if none
    const wordsToUse = meaningfulWords.length > 0 ? meaningfulWords : words;

    let prefix: string;
    if (wordsToUse.length >= 3) {
      // Use first letter of first 3 words
      prefix = wordsToUse.slice(0, 3).map(w => w[0]).join('').toUpperCase();
    } else if (wordsToUse.length === 2) {
      // Use first letter of first word + first 2 letters of second word
      prefix = (wordsToUse[0][0] + wordsToUse[1].slice(0, 2)).toUpperCase();
    } else if (wordsToUse.length === 1) {
      // Use first 3 letters of the word
      prefix = wordsToUse[0].slice(0, 3).toUpperCase();
    } else {
      prefix = 'CMP';
    }

    // Ensure prefix is exactly 3 characters
    prefix = prefix.slice(0, 3).padEnd(3, 'X');

    // Show preview with placeholder sequence (actual number assigned on create)
    return `${prefix}-0001`;
  }

  function handleNameChange(name: string) {
    setFormData({ ...formData, name });
    // Generate preview code when creating new company
    if (!editingCompany) {
      const code = generateCodePreview(name);
      setPreviewCode(code);
    }
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
    setPreviewCode("");
    setIsDialogOpen(true);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Company name is required");
      return;
    }
    // Code is only required when editing
    if (editingCompany && !formData.code) {
      toast.error("Company code is required");
      return;
    }

    try {
      setIsSaving(true);
      const url = editingCompany ? `/api/v1/companies/${editingCompany.id}` : "/api/v1/companies";
      const method = editingCompany ? "PATCH" : "POST";

      // When creating, don't send code - let backend auto-generate it
      const payload = editingCompany ? formData : { ...formData, code: undefined };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save company");
      }

      toast.success(editingCompany ? "Company updated" : "Company created");
      setIsDialogOpen(false);
      fetchCompanies();
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save company");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(company: Company) {
    try {
      const response = await fetch(`/api/v1/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: company.isActive === false }),
      });

      if (!response.ok) throw new Error("Failed to update company");

      toast.success(company.isActive !== false ? "Company deactivated" : "Company activated");
      fetchCompanies();
    } catch (error) {
      console.error("Error toggling company status:", error);
      toast.error("Failed to update company status");
    }
  }

  async function handleDelete(company: Company) {
    if (!confirm(`Are you sure you want to delete ${company.name}?`)) return;

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
      toast.error(error instanceof Error ? error.message : "Failed to delete company");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Companies Management
          </h1>
          <p className="text-muted-foreground">
            Manage all registered companies in the OMS Master Panel
          </p>
        </div>
        {canManageCompanies && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        )}
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
                    stat.color === "blue"
                      ? "#dbeafe"
                      : stat.color === "green"
                        ? "#dcfce7"
                        : stat.color === "purple"
                          ? "#f3e8ff"
                          : "#ffedd5",
                }}
              >
                <stat.icon
                  className="h-5 w-5"
                  style={{
                    color:
                      stat.color === "blue"
                        ? "#2563eb"
                        : stat.color === "green"
                          ? "#16a34a"
                          : stat.color === "purple"
                            ? "#9333ea"
                            : "#ea580c",
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

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Companies</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No companies found</p>
              {canManageCompanies && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first company
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="text-center">Locations</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {company.legalName || "-"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{company.code}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {company.gst || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {company._count?.locations || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {company._count?.users || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={company.isActive !== false ? "default" : "secondary"}
                        className={company.isActive !== false ? "bg-green-100 text-green-700" : ""}
                      >
                        {company.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/master/companies/${company.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {canManageCompanies && (
                            <>
                              <DropdownMenuItem onClick={() => openEditDialog(company)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Company
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/settings/users?companyId=${company.id}`)}>
                                <Users className="mr-2 h-4 w-4" />
                                Manage Users
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/settings/locations?companyId=${company.id}`)}>
                                <MapPin className="mr-2 h-4 w-4" />
                                Manage Locations
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(company)}>
                                {company.isActive !== false ? (
                                  <>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(company)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Company
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        <DialogContent className="max-w-lg">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Company Code *</Label>
                  <Input
                    id="code"
                    value={editingCompany ? formData.code : previewCode}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    readOnly={!editingCompany}
                    className={!editingCompany ? "bg-muted font-mono" : "font-mono"}
                    placeholder={editingCompany ? "Company code" : "Auto-generated from name"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    placeholder="Enter company name"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Registered legal name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gst">GST Number</Label>
                  <Input
                    id="gst"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                    placeholder="27AABCU9603R1ZM"
                    maxLength={15}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="AABCU9603R"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cin">CIN (Company Identification Number)</Label>
                <Input
                  id="cin"
                  value={formData.cin}
                  onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                  placeholder="U74999MH2021PTC123456"
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingCompany ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
