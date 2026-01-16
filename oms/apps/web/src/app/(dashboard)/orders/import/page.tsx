"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  FAILED: "bg-red-100 text-red-800",
};

interface OrderImport {
  id: string;
  importNo: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors?: { row: number; field?: string; message: string }[];
  summary?: { totalOrders: number; createdOrders: number; failedOrders: number };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface CSVRow {
  order_no: string;
  order_date: string;
  channel?: string;
  payment_mode: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  discount?: number;
  shipping_charges?: number;
  cod_charges?: number;
  external_order_no?: string;
  remarks?: string;
  priority?: number;
}

export default function OrderImportPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch import history
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order-imports", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      const res = await fetch(`/api/v1/orders/import?${params}`);
      if (!res.ok) throw new Error("Failed to fetch imports");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { locationId: string; rows: CSVRow[]; fileName: string }) => {
      const res = await fetch("/api/v1/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import orders");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import completed",
        description: `${data.summary?.createdOrders || 0} orders created successfully`,
      });
      setIsImportOpen(false);
      setCsvFile(null);
      setParsedRows([]);
      queryClient.invalidateQueries({ queryKey: ["order-imports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setParseErrors([]);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);
        setParsedRows(rows);
      } catch (error) {
        setParseErrors([error instanceof Error ? error.message : "Failed to parse CSV"]);
      }
    };
    reader.readAsText(file);
  }, []);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const requiredHeaders = [
      "order_no",
      "customer_name",
      "customer_phone",
      "shipping_pincode",
      "sku_code",
      "quantity",
      "unit_price",
    ];

    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: Record<string, string | number> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || "";
      });

      rows.push({
        order_no: String(row.order_no || ""),
        order_date: String(row.order_date || new Date().toISOString()),
        channel: String(row.channel || "MANUAL"),
        payment_mode: String(row.payment_mode || "PREPAID"),
        customer_name: String(row.customer_name || ""),
        customer_phone: String(row.customer_phone || ""),
        customer_email: String(row.customer_email || ""),
        shipping_address_line1: String(row.shipping_address_line1 || ""),
        shipping_address_line2: String(row.shipping_address_line2 || ""),
        shipping_city: String(row.shipping_city || ""),
        shipping_state: String(row.shipping_state || ""),
        shipping_pincode: String(row.shipping_pincode || ""),
        sku_code: String(row.sku_code || ""),
        quantity: parseInt(String(row.quantity)) || 1,
        unit_price: parseFloat(String(row.unit_price)) || 0,
        tax_amount: parseFloat(String(row.tax_amount)) || 0,
        discount: parseFloat(String(row.discount)) || 0,
        shipping_charges: parseFloat(String(row.shipping_charges)) || 0,
        cod_charges: parseFloat(String(row.cod_charges)) || 0,
        external_order_no: String(row.external_order_no || ""),
        remarks: String(row.remarks || ""),
        priority: parseInt(String(row.priority)) || 0,
      });
    }

    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleImport = () => {
    if (!locationId || parsedRows.length === 0) return;

    importMutation.mutate({
      locationId,
      rows: parsedRows,
      fileName: csvFile?.name || "import.csv",
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "order_no",
      "order_date",
      "channel",
      "payment_mode",
      "customer_name",
      "customer_phone",
      "customer_email",
      "shipping_address_line1",
      "shipping_address_line2",
      "shipping_city",
      "shipping_state",
      "shipping_pincode",
      "sku_code",
      "quantity",
      "unit_price",
      "tax_amount",
      "discount",
      "shipping_charges",
      "cod_charges",
      "remarks",
    ].join(",");

    const sampleRow = [
      "ORD001",
      "2024-01-15",
      "MANUAL",
      "PREPAID",
      "John Doe",
      "9876543210",
      "john@example.com",
      "123 Main St",
      "Apt 4",
      "Mumbai",
      "Maharashtra",
      "400001",
      "SKU001",
      "2",
      "500",
      "90",
      "0",
      "50",
      "0",
      "Sample order",
    ].join(",");

    const csv = `${headers}\n${sampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const imports: OrderImport[] = data?.data || [];
  const locations: Location[] = locationsData?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Import</h1>
          <p className="text-muted-foreground">
            Bulk import orders from CSV files
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Orders
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Orders from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import orders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>CSV File *</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  {csvFile ? (
                    <span className="text-sm font-medium">{csvFile.name}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium">
                        Click to upload CSV file
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        or drag and drop
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800 mb-2">Parse Errors:</p>
                {parseErrors.map((error, i) => (
                  <p key={i} className="text-sm text-red-600">
                    {error}
                  </p>
                ))}
              </div>
            )}

            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {parsedRows.length} rows parsed successfully
                </p>
                <div className="max-h-48 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.order_no}</TableCell>
                          <TableCell>{row.customer_name}</TableCell>
                          <TableCell>{row.sku_code}</TableCell>
                          <TableCell>{row.quantity}</TableCell>
                          <TableCell>{row.unit_price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedRows.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ... and {parsedRows.length - 5} more rows
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                !locationId ||
                parsedRows.length === 0 ||
                importMutation.isPending
              }
            >
              {importMutation.isPending
                ? "Importing..."
                : `Import ${parsedRows.length} Rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>
            View past import jobs and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mb-4" />
              <p>No imports found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Import No</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Rows</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((imp) => (
                    <TableRow key={imp.id}>
                      <TableCell className="font-medium">
                        {imp.importNo}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {imp.fileName}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[imp.status] || ""}>
                          {imp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{imp.totalRows}</TableCell>
                      <TableCell className="text-green-600">
                        {imp.successCount}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {imp.errorCount}
                      </TableCell>
                      <TableCell>{formatDate(imp.createdAt)}</TableCell>
                      <TableCell>
                        {imp.status === "COMPLETED" && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {imp.status === "FAILED" && (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        {imp.status === "PARTIAL" && (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
