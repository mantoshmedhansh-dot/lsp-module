"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { exportToCSV, type ExportColumn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Search,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Report type configuration: label, API endpoint, and CSV columns
const REPORT_TYPES = {
  orders: {
    label: "Orders",
    endpoint: "/api/v1/orders",
    columns: [
      { key: "id", header: "Order ID" },
      { key: "orderNumber", header: "Order Number" },
      { key: "status", header: "Status" },
      { key: "channelName", header: "Channel" },
      { key: "customerName", header: "Customer" },
      { key: "totalAmount", header: "Total Amount" },
      { key: "createdAt", header: "Created At" },
    ] as ExportColumn[],
  },
  inventory: {
    label: "Inventory",
    endpoint: "/api/v1/inventory",
    columns: [
      { key: "id", header: "ID" },
      { key: "skuCode", header: "SKU Code" },
      { key: "productName", header: "Product" },
      { key: "warehouseName", header: "Warehouse" },
      { key: "availableQuantity", header: "Available Qty" },
      { key: "reservedQuantity", header: "Reserved Qty" },
      { key: "totalQuantity", header: "Total Qty" },
    ] as ExportColumn[],
  },
  shipments: {
    label: "Shipments",
    endpoint: "/api/v1/shipments",
    columns: [
      { key: "id", header: "Shipment ID" },
      { key: "awbNumber", header: "AWB Number" },
      { key: "transporterName", header: "Transporter" },
      { key: "status", header: "Status" },
      { key: "weight", header: "Weight" },
      { key: "shippedAt", header: "Shipped At" },
      { key: "deliveredAt", header: "Delivered At" },
    ] as ExportColumn[],
  },
  returns: {
    label: "Returns",
    endpoint: "/api/v1/returns",
    columns: [
      { key: "id", header: "Return ID" },
      { key: "orderNumber", header: "Order Number" },
      { key: "reason", header: "Reason" },
      { key: "status", header: "Status" },
      { key: "returnType", header: "Type" },
      { key: "refundAmount", header: "Refund Amount" },
      { key: "createdAt", header: "Created At" },
    ] as ExportColumn[],
  },
  finance: {
    label: "Finance",
    endpoint: "/api/v1/finance/cod-reconciliations",
    columns: [
      { key: "id", header: "ID" },
      { key: "awbNumber", header: "AWB Number" },
      { key: "transporterName", header: "Transporter" },
      { key: "codAmount", header: "COD Amount" },
      { key: "remittedAmount", header: "Remitted Amount" },
      { key: "status", header: "Status" },
      { key: "createdAt", header: "Created At" },
    ] as ExportColumn[],
  },
} as const;

type ReportType = keyof typeof REPORT_TYPES;

export default function CustomReportsPage() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>("orders");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const config = REPORT_TYPES[reportType];

  // useQuery with enabled: false -- triggered manually via refetch
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["custom-report", reportType, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        fromDate: dateRange.from,
        toDate: dateRange.to,
        limit: "1000",
      });
      const res = await fetch(`${config.endpoint}?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch ${config.label} report`);
      const json = await res.json();
      // Normalize response: handle array, { items: [] }, or { data: [] }
      return Array.isArray(json) ? json : json?.items || json?.data || [];
    },
    enabled: false,
  });

  const rows: Record<string, any>[] = data || [];

  // Derive table column keys from the first row, falling back to config columns
  const tableColumns =
    rows.length > 0
      ? config.columns.filter((col) => col.key in rows[0])
      : config.columns;

  const handleGenerate = () => {
    refetch();
  };

  const handleExportCSV = () => {
    if (!rows.length) return;
    exportToCSV(rows, config.columns, `${reportType}_report`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/reports")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Custom Report Builder</h1>
            <p className="text-muted-foreground">
              Select a report type, set your date range, and generate reports from live data
            </p>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>
            Choose the data source and date range for your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Report Type Selector */}
            <div className="grid gap-2">
              <Label>Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPES).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </div>

            {/* End Date */}
            <div className="grid gap-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </div>

            {/* Generate Button */}
            <Button onClick={handleGenerate} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-800">Failed to generate report</h3>
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {config.label} Report Results
              </CardTitle>
              <CardDescription>
                {rows.length > 0
                  ? `${rows.length} record${rows.length !== 1 ? "s" : ""} found`
                  : "Generate a report to see results"}
              </CardDescription>
            </div>
            {rows.length > 0 && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Generating report...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Data</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Select a report type, choose your date range, and click &quot;Generate Report&quot;
                to fetch data from the API.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {tableColumns.map((col) => (
                      <TableHead key={col.key}>{col.header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.id || idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      {tableColumns.map((col) => {
                        const value = row[col.key];
                        // Render status fields as badges
                        if (col.key === "status" && typeof value === "string") {
                          return (
                            <TableCell key={col.key}>
                              <Badge variant="outline">{value}</Badge>
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={col.key}>
                            {value !== null && value !== undefined
                              ? String(value)
                              : "-"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
