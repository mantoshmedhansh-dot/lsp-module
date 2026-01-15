"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  expiresAt: string;
  validDays: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: FileText },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-600", icon: Clock },
  CONVERTED: { label: "Converted to Order", color: "bg-blue-100 text-blue-800", icon: ArrowRight },
};

export default function B2BQuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  const fetchQuotations = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/b2b/quotations?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setQuotations(result.quotations || []);
      }
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const mockQuotations: Quotation[] = quotations.length > 0 ? quotations : [
    {
      id: "1",
      quotationNumber: "QT-2024-0089",
      status: "APPROVED",
      totalAmount: 125000,
      itemCount: 15,
      createdAt: "2024-01-12",
      expiresAt: "2024-01-20",
      validDays: 6,
    },
    {
      id: "2",
      quotationNumber: "QT-2024-0088",
      status: "PENDING_APPROVAL",
      totalAmount: 85000,
      itemCount: 10,
      createdAt: "2024-01-10",
      expiresAt: "2024-01-18",
      validDays: 4,
    },
    {
      id: "3",
      quotationNumber: "QT-2024-0087",
      status: "CONVERTED",
      totalAmount: 200000,
      itemCount: 25,
      createdAt: "2024-01-05",
      expiresAt: "2024-01-15",
      validDays: 0,
    },
    {
      id: "4",
      quotationNumber: "QT-2024-0086",
      status: "EXPIRED",
      totalAmount: 45000,
      itemCount: 5,
      createdAt: "2024-01-01",
      expiresAt: "2024-01-10",
      validDays: 0,
    },
  ];

  const filteredQuotations = mockQuotations.filter((quote) => {
    const matchesSearch = quote.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.DRAFT;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const pendingCount = mockQuotations.filter((q) => q.status === "PENDING_APPROVAL").length;
  const approvedCount = mockQuotations.filter((q) => q.status === "APPROVED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-gray-500">View and manage your quotation requests</p>
        </div>
        <Button asChild>
          <Link href="/portal/quotations/new">
            <Plus className="h-4 w-4 mr-2" />
            Request Quote
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Quotations</p>
                <p className="text-2xl font-bold">{mockQuotations.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Approval</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={approvedCount > 0 ? "border-green-200 bg-green-50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ready to Order</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Converted</p>
                <p className="text-2xl font-bold">
                  {mockQuotations.filter((q) => q.status === "CONVERTED").length}
                </p>
              </div>
              <ArrowRight className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by quotation number..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quotations Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredQuotations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotations.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/portal/quotations/${quote.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {quote.quotationNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{quote.createdAt}</TableCell>
                    <TableCell>{quote.itemCount} items</TableCell>
                    <TableCell>
                      {quote.totalAmount.toLocaleString("en-IN", {
                        style: "currency",
                        currency: "INR",
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell>
                      {quote.validDays > 0 ? (
                        <span className={quote.validDays <= 3 ? "text-amber-600" : ""}>
                          {quote.validDays} days left
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/portal/quotations/${quote.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {quote.status === "APPROVED" && (
                          <Button size="sm" asChild>
                            <Link href={`/portal/quotations/${quote.id}/convert`}>
                              Convert to Order
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No quotations found</h3>
              <p className="text-gray-500 mt-1">
                {searchQuery
                  ? "Try adjusting your search criteria"
                  : "Request your first quote to get started"}
              </p>
              <Button className="mt-4" asChild>
                <Link href="/portal/quotations/new">Request Quote</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
