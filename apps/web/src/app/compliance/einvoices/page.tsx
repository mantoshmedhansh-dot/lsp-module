"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import { Receipt, Plus, RefreshCw, Search, CheckCircle, XCircle, AlertTriangle, Copy, QrCode } from "lucide-react";

interface EInvoice {
  id: string;
  irn?: string;
  docNumber: string;
  docDate: string;
  docType: string;
  buyerGstin: string;
  buyerLegalName?: string;
  totalInvoiceValue: number;
  totalCgstValue: number;
  totalSgstValue: number;
  totalIgstValue: number;
  status: string;
  createdAt: string;
}

interface Summary {
  draft: number;
  pending: number;
  generated: number;
  cancelled: number;
  failed: number;
}

export default function EInvoicesPage() {
  const [einvoices, setEInvoices] = useState<EInvoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ draft: 0, pending: 0, generated: 0, cancelled: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  async function fetchData() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/compliance/einvoice?${params}`);
      const data = await response.json();
      if (data.success) {
        setEInvoices(data.data.items || []);
        setSummary(data.data.summary || {});
      }
    } catch (error) {
      console.error("Failed to fetch e-invoices:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateIRN(id: string) {
    try {
      await fetch("/api/compliance/einvoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_IRN", id }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to generate IRN:", error);
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === "GENERATED" ? "success" :
                   status === "DRAFT" || status === "PENDING" ? "warning" : "danger";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getDocTypeBadge = (docType: string) => {
    const types: Record<string, string> = { INV: "Invoice", CRN: "Credit Note", DBN: "Debit Note" };
    return <Badge variant="info">{types[docType] || docType}</Badge>;
  };

  const filteredInvoices = einvoices.filter(
    (inv) => inv.docNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.irn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.buyerLegalName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-Invoices</h1>
          <p className="text-muted-foreground">GST E-Invoice generation via IRP Portal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Create E-Invoice</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: "All", value: summary.draft + summary.pending + summary.generated + summary.cancelled + summary.failed, filter: null },
          { label: "Draft", value: summary.draft, filter: "DRAFT" },
          { label: "Pending", value: summary.pending, filter: "PENDING", color: "text-yellow-600" },
          { label: "Generated", value: summary.generated, filter: "GENERATED", color: "text-green-600" },
          { label: "Failed", value: summary.failed, filter: "FAILED", color: "text-red-600" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`cursor-pointer ${statusFilter === stat.filter ? "ring-2 ring-primary rounded-lg" : ""}`}
            onClick={() => setStatusFilter(stat.filter)}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color || ""}`}>{stat.value}</div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by document number, IRN, or buyer..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* E-Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>E-Invoices</CardTitle>
          <p className="text-sm text-muted-foreground">GST e-invoices with IRN from IRP Portal</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No e-invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Document</th>
                    <th className="px-4 py-2 text-left font-medium">IRN</th>
                    <th className="px-4 py-2 text-left font-medium">Buyer</th>
                    <th className="px-4 py-2 text-left font-medium">Invoice Value</th>
                    <th className="px-4 py-2 text-left font-medium">GST</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {getDocTypeBadge(inv.docType)}
                          <div>
                            <div className="font-medium">{inv.docNumber}</div>
                            <div className="text-xs text-muted-foreground">{new Date(inv.docDate).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {inv.irn ? (
                          <div className="flex items-center gap-1">
                            <span className="max-w-[120px] truncate text-xs font-mono">{inv.irn}</span>
                            <button
                              className="p-1 hover:bg-muted rounded"
                              onClick={() => navigator.clipboard.writeText(inv.irn!)}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{inv.buyerLegalName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{inv.buyerGstin}</div>
                      </td>
                      <td className="px-4 py-2">Rs. {inv.totalInvoiceValue?.toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs">
                        {inv.totalCgstValue > 0 && <div>CGST: Rs. {inv.totalCgstValue?.toLocaleString()}</div>}
                        {inv.totalSgstValue > 0 && <div>SGST: Rs. {inv.totalSgstValue?.toLocaleString()}</div>}
                        {inv.totalIgstValue > 0 && <div>IGST: Rs. {inv.totalIgstValue?.toLocaleString()}</div>}
                      </td>
                      <td className="px-4 py-2">{getStatusBadge(inv.status)}</td>
                      <td className="px-4 py-2">
                        {(inv.status === "DRAFT" || inv.status === "PENDING") && (
                          <Button size="sm" variant="outline" onClick={() => generateIRN(inv.id)}>
                            Generate IRN
                          </Button>
                        )}
                        {inv.irn && (
                          <Button size="sm" variant="outline">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>E-Invoice Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium">Applicability</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Mandatory for B2B transactions</li>
                <li>Annual turnover above Rs. 5 Crore</li>
                <li>Exports and SEZ supplies</li>
                <li>Invoice, Credit Note, Debit Note</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Key Features</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>IRN (Invoice Reference Number) generation</li>
                <li>Signed QR Code with digital signature</li>
                <li>Auto-populated in GSTR-1</li>
                <li>Cancellation allowed within 24 hours</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
