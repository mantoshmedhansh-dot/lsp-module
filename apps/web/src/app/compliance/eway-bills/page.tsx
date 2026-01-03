"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import { Truck, Plus, RefreshCw, Search, FileText, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";

interface EwayBill {
  id: string;
  ewayBillNumber?: string;
  docNumber: string;
  docDate: string;
  supplierGstin: string;
  recipientName?: string;
  recipientState?: string;
  goodsValue: number;
  status: string;
  validUpto?: string;
  vehicleNo?: string;
  createdAt: string;
}

interface Summary {
  draft: number;
  generated: number;
  active: number;
  cancelled: number;
  expired: number;
  expiringSoon: number;
}

export default function EwayBillsPage() {
  const [ewayBills, setEwayBills] = useState<EwayBill[]>([]);
  const [summary, setSummary] = useState<Summary>({ draft: 0, generated: 0, active: 0, cancelled: 0, expired: 0, expiringSoon: 0 });
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
      const response = await fetch(`/api/compliance/eway-bill?${params}`);
      const data = await response.json();
      if (data.success) {
        setEwayBills(data.data.items || []);
        setSummary(data.data.summary || {});
      }
    } catch (error) {
      console.error("Failed to fetch e-way bills:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateEwayBill(id: string) {
    try {
      await fetch("/api/compliance/eway-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE", id }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to generate e-way bill:", error);
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === "ACTIVE" || status === "GENERATED" ? "success" :
                   status === "DRAFT" ? "warning" : "danger";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const filteredBills = ewayBills.filter(
    (bill) => bill.docNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.ewayBillNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.recipientName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">E-way Bills</h1>
          <p className="text-muted-foreground">GST E-way Bill management for goods movement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Create E-way Bill</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        {[
          { label: "All", value: Object.values(summary).reduce((a, b) => a + b, 0) - summary.expiringSoon, filter: null },
          { label: "Draft", value: summary.draft, filter: "DRAFT" },
          { label: "Active", value: summary.active, filter: "ACTIVE", color: "text-green-600" },
          { label: "Expired", value: summary.expired, filter: "EXPIRED", color: "text-amber-600" },
          { label: "Cancelled", value: summary.cancelled, filter: "CANCELLED", color: "text-red-600" },
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
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary.expiringSoon}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by document number, e-way bill number, or recipient..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* E-way Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle>E-way Bills</CardTitle>
          <p className="text-sm text-muted-foreground">Manage GST e-way bills for goods transportation</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredBills.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No e-way bills found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">E-way Bill No</th>
                    <th className="px-4 py-2 text-left font-medium">Document</th>
                    <th className="px-4 py-2 text-left font-medium">Recipient</th>
                    <th className="px-4 py-2 text-left font-medium">Value</th>
                    <th className="px-4 py-2 text-left font-medium">Vehicle</th>
                    <th className="px-4 py-2 text-left font-medium">Valid Until</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="border-b">
                      <td className="px-4 py-2 font-medium">{bill.ewayBillNumber || "-"}</td>
                      <td className="px-4 py-2">
                        <div>{bill.docNumber}</div>
                        <div className="text-xs text-muted-foreground">{new Date(bill.docDate).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div>{bill.recipientName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{bill.recipientState}</div>
                      </td>
                      <td className="px-4 py-2">Rs. {bill.goodsValue?.toLocaleString()}</td>
                      <td className="px-4 py-2">{bill.vehicleNo || "-"}</td>
                      <td className="px-4 py-2">{bill.validUpto ? new Date(bill.validUpto).toLocaleDateString() : "-"}</td>
                      <td className="px-4 py-2">{getStatusBadge(bill.status)}</td>
                      <td className="px-4 py-2">
                        {bill.status === "DRAFT" && (
                          <Button size="sm" variant="outline" onClick={() => generateEwayBill(bill.id)}>
                            Generate
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
          <CardTitle>E-way Bill Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium">Validity Based on Distance</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Up to 100 km: 1 day</li>
                <li>100-300 km: 3 days</li>
                <li>300-500 km: 5 days</li>
                <li>500-1000 km: 10 days</li>
                <li>Above 1000 km: 15 days</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Key Requirements</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Mandatory for goods value above Rs. 50,000</li>
                <li>Part-B update allowed for vehicle changes</li>
                <li>Extension allowed within 8 hours of expiry</li>
                <li>Cancellation within 24 hours of generation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
