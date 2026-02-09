"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Plus,
  Edit,
  Settings2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface QCParameter {
  id: string;
  name: string;
  category: string;
  dataType: string;
  required: boolean;
  applicableTo: string;
  isActive: boolean;
  createdAt: string;
}

interface QCParametersResponse {
  parameters: QCParameter[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  VISUAL: { label: "Visual", color: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  DIMENSIONAL: { label: "Dimensional", color: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  FUNCTIONAL: { label: "Functional", color: "bg-green-100 text-green-800 hover:bg-green-100" },
  PACKAGING: { label: "Packaging", color: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  WEIGHT: { label: "Weight", color: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100" },
  LABELLING: { label: "Labelling", color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
};

const dataTypeLabels: Record<string, string> = {
  BOOLEAN: "Yes/No",
  TEXT: "Text",
  NUMBER: "Number",
  SELECT: "Dropdown",
  IMAGE: "Image",
};

export default function QCParametersPage() {
  const [parameters, setParameters] = useState<QCParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      params.append("page", page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/v1/qc/parameters?${params}`);
      const data: QCParametersResponse = await response.json();

      setParameters(data.parameters || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error fetching QC parameters:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParameters();
  }, [page, categoryFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchParameters();
  };

  const handleCreateParameter = async () => {
    toast.info("Create parameter dialog coming soon");
  };

  const handleEditParameter = async (parameterId: string) => {
    toast.info("Edit parameter dialog coming soon");
  };

  const getCategoryBadge = (category: string) => {
    const config = categoryConfig[category] || { label: category, color: "bg-gray-100 text-gray-800" };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QC Parameters</h1>
          <p className="text-muted-foreground">
            Configure quality control parameters and mapping rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchParameters} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleCreateParameter}>
            <Plus className="mr-2 h-4 w-4" />
            Add Parameter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parameters</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {parameters.filter((p) => p.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Required</CardTitle>
            <Settings2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {parameters.filter((p) => p.required).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by parameter name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Parameters Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Applicable To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : parameters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No QC parameters found</p>
                      <Button variant="link" onClick={handleCreateParameter}>
                        Create your first parameter
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                parameters.map((param) => (
                  <TableRow key={param.id}>
                    <TableCell className="font-medium">
                      {param.name}
                    </TableCell>
                    <TableCell>{getCategoryBadge(param.category)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {dataTypeLabels[param.dataType] || param.dataType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {param.required ? (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Required</Badge>
                      ) : (
                        <span className="text-muted-foreground">Optional</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{param.applicableTo}</span>
                    </TableCell>
                    <TableCell>
                      {param.isActive ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditParameter(param.id)}
                      >
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {parameters.length} of {total} parameters
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
