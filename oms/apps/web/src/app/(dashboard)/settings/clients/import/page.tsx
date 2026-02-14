"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
import { toast } from "sonner";

interface ParsedRow {
  company_name: string;
  code: string;
  legal_name: string;
  gst: string;
  pan: string;
  service_model: string;
  billing_type: string;
  billing_rate: string;
}

interface ImportResult {
  total: number;
  created: number;
  errors: { row: number; message: string }[];
}

const TEMPLATE_COLUMNS = [
  "company_name",
  "code",
  "legal_name",
  "gst",
  "pan",
  "service_model",
  "billing_type",
  "billing_rate",
];

export default function BulkImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleDownloadTemplate() {
    const csv = TEMPLATE_COLUMNS.join(",") + "\n" +
      "Acme Corp,ACME,Acme Corporation Pvt Ltd,29ABCDE1234F1Z5,ABCDE1234F,FULL,per_order,15.00\n" +
      "Beta Inc,BETA,Beta Industries Ltd,27FGHIJ5678G2Y3,FGHIJ5678G,WAREHOUSING,per_sqft,8.50\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) {
        toast.error("CSV file must have a header row and at least one data row");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/["\s]/g, ""));
      const parsed: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });
        if (row.company_name && row.code) {
          parsed.push(row as ParsedRow);
        }
      }

      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("No valid rows found in CSV");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const response = await fetch("/api/v1/platform/clients/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Import failed");
      }
      const data = await response.json();
      setResult(data);
      if (data.created > 0) {
        toast.success(`${data.created} client${data.created !== 1 ? "s" : ""} imported successfully`);
      }
      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} row${data.errors.length !== 1 ? "s" : ""} had errors`);
      }
    } catch (error: any) {
      toast.error(error.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings/clients")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Import Clients</h1>
          <p className="text-muted-foreground">Import multiple clients from a CSV file</p>
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1: Download Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              Download Template
            </CardTitle>
            <CardDescription>Get the CSV template with required columns</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Required: company_name, code. Optional: legal_name, gst, pan, service_model, billing_type, billing_rate
            </p>
          </CardContent>
        </Card>

        {/* Step 2: Upload File */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Upload CSV
            </CardTitle>
            <CardDescription>Upload your filled CSV file</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {fileName ? (
                <p className="text-sm font-medium">{fileName}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Click to upload CSV file</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Table */}
      {rows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview ({rows.length} rows)</CardTitle>
                <CardDescription>Review the data before importing</CardDescription>
              </div>
              <Button onClick={handleImport} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importing..." : `Import ${rows.length} Client${rows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Legal Name</TableHead>
                    <TableHead>GST</TableHead>
                    <TableHead>Service Model</TableHead>
                    <TableHead>Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{row.company_name}</TableCell>
                      <TableCell>{row.code}</TableCell>
                      <TableCell className="text-muted-foreground">{row.legal_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.gst || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.service_model || "FULL"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.billing_type || "per_order"} {row.billing_rate ? `@ ₹${row.billing_rate}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-sm text-green-600">Created</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                <p className="text-sm text-red-600">Errors</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Errors:</p>
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Row {err.row}: {err.message}</span>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={() => router.push("/settings/clients")}>
              Back to Client List
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
