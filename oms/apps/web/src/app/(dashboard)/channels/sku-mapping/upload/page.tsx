"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface ParsedRow {
  row: number;
  skuCode: string;
  marketplaceSku: string;
  marketplaceSkuName?: string;
  status: "pending" | "success" | "error";
  errorMessage?: string;
}

interface UploadResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  status: string;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [step, setStep] = useState<"select" | "preview" | "result">("select");

  // Fetch connections on mount
  useState(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch("/api/v1/marketplaces");
        if (response.ok) {
          const data = await response.json();
          setConnections(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching connections:", error);
      }
    };
    fetchConnections();
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error("CSV file must have a header row and at least one data row");
        return;
      }

      // Parse header
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const skuCodeIndex = header.findIndex((h) => h === "sku_code" || h === "skucode" || h === "sku");
      const marketplaceSkuIndex = header.findIndex((h) => h === "marketplace_sku" || h === "marketplacesku" || h === "asin" || h === "fsn");
      const nameIndex = header.findIndex((h) => h === "marketplace_sku_name" || h === "name" || h === "product_name");

      if (skuCodeIndex === -1 || marketplaceSkuIndex === -1) {
        toast.error("CSV must have 'sku_code' and 'marketplace_sku' columns");
        return;
      }

      // Parse data rows
      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const skuCode = values[skuCodeIndex];
        const marketplaceSku = values[marketplaceSkuIndex];

        if (!skuCode || !marketplaceSku) continue;

        rows.push({
          row: i + 1,
          skuCode,
          marketplaceSku,
          marketplaceSkuName: nameIndex !== -1 ? values[nameIndex] : undefined,
          status: "pending",
        });
      }

      if (rows.length === 0) {
        toast.error("No valid data rows found in CSV");
        return;
      }

      setParsedRows(rows);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedConnectionId) {
      toast.error("Please select a marketplace connection");
      return;
    }

    if (parsedRows.length === 0) {
      toast.error("No data to upload");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Prepare data for bulk upload
      const mappings = parsedRows.map((row) => ({
        skuCode: row.skuCode,
        connectionId: selectedConnectionId,
        marketplaceSku: row.marketplaceSku,
        marketplaceSkuName: row.marketplaceSkuName,
      }));

      const response = await fetch("/api/v1/sku-mappings/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });

      if (response.ok) {
        const result = await response.json();
        setUploadResult(result);

        // Update parsed rows with results
        const updatedRows = parsedRows.map((row) => {
          const error = result.errors?.find((e: { row: number }) => e.row === row.row);
          return {
            ...row,
            status: error ? "error" : "success",
            errorMessage: error?.error,
          } as ParsedRow;
        });
        setParsedRows(updatedRows);

        setStep("result");
        toast.success(`Successfully created ${result.successCount} mappings`);
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to upload mappings");
      }
    } catch (error) {
      toast.error("Failed to upload mappings");
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const downloadTemplate = () => {
    const template = "sku_code,marketplace_sku,marketplace_sku_name\nSKU001,B0XXXXX,Product Name on Marketplace\nSKU002,B0YYYYY,Another Product Name";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sku_mapping_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setFile(null);
    setParsedRows([]);
    setUploadResult(null);
    setStep("select");
    setUploadProgress(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/channels/sku-mapping")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Upload SKU Mappings</h1>
          <p className="text-muted-foreground">
            Import multiple SKU mappings from a CSV file
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === "select" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "select" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            1
          </div>
          <span className="font-medium">Select File</span>
        </div>
        <div className="h-px w-12 bg-muted" />
        <div className={`flex items-center gap-2 ${step === "preview" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            2
          </div>
          <span className="font-medium">Preview & Upload</span>
        </div>
        <div className="h-px w-12 bg-muted" />
        <div className={`flex items-center gap-2 ${step === "result" ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "result" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            3
          </div>
          <span className="font-medium">Results</span>
        </div>
      </div>

      {step === "select" && (
        <>
          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>CSV Format Requirements</CardTitle>
              <CardDescription>
                Your CSV file must contain the following columns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column Name</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">sku_code</TableCell>
                      <TableCell><Badge variant="destructive">Required</Badge></TableCell>
                      <TableCell>Your internal SKU code</TableCell>
                      <TableCell className="font-mono">SKU001</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">marketplace_sku</TableCell>
                      <TableCell><Badge variant="destructive">Required</Badge></TableCell>
                      <TableCell>Marketplace identifier (ASIN, FSN, etc.)</TableCell>
                      <TableCell className="font-mono">B0XXXXXXXX</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">marketplace_sku_name</TableCell>
                      <TableCell><Badge variant="outline">Optional</Badge></TableCell>
                      <TableCell>Product name on marketplace</TableCell>
                      <TableCell>Product Title Here</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select the marketplace connection and upload your CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Marketplace Connection *</Label>
                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                  <SelectTrigger className="w-full md:w-[400px]">
                    <SelectValue placeholder="Select marketplace connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.connectionName} ({conn.marketplace})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All mappings will be created for this marketplace connection
                </p>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Drop your CSV file here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports .csv files only
                  </p>
                </label>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preview: {file?.name}
                </CardTitle>
                <CardDescription>
                  {parsedRows.length} mappings found in file
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetUpload}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={isUploading || !selectedConnectionId}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? "Uploading..." : "Upload Mappings"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedConnectionId && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Required</AlertTitle>
                <AlertDescription>
                  Please select a marketplace connection before uploading.
                </AlertDescription>
              </Alert>
            )}

            {isUploading && (
              <div className="mb-4 space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Row</TableHead>
                    <TableHead>SKU Code</TableHead>
                    <TableHead>Marketplace SKU</TableHead>
                    <TableHead>Marketplace SKU Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="font-mono text-sm">{row.row}</TableCell>
                      <TableCell className="font-medium">{row.skuCode}</TableCell>
                      <TableCell className="font-mono">{row.marketplaceSku}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.marketplaceSkuName || "-"}
                      </TableCell>
                      <TableCell>
                        {row.status === "pending" && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {row.status === "success" && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Success
                          </Badge>
                        )}
                        {row.status === "error" && (
                          <div>
                            <Badge variant="destructive">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              Error
                            </Badge>
                            {row.errorMessage && (
                              <p className="text-xs text-red-600 mt-1">{row.errorMessage}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedRows.length > 100 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing first 100 rows of {parsedRows.length}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === "result" && uploadResult && (
        <>
          <Alert className={uploadResult.errorCount > 0 ? "border-yellow-500" : "border-green-500"}>
            {uploadResult.errorCount > 0 ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {uploadResult.errorCount === 0
                ? "Upload Complete"
                : "Upload Complete with Errors"
              }
            </AlertTitle>
            <AlertDescription>
              Successfully created {uploadResult.successCount} of {uploadResult.totalRows} mappings.
              {uploadResult.errorCount > 0 && ` ${uploadResult.errorCount} rows had errors.`}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Upload Results</CardTitle>
              <CardDescription>
                Summary of the bulk upload operation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-3xl font-bold">{uploadResult.totalRows}</p>
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-600">{uploadResult.successCount}</p>
                  <p className="text-sm text-green-600">Successful</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-red-600">{uploadResult.errorCount}</p>
                  <p className="text-sm text-red-600">Errors</p>
                </div>
              </div>

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Error Details</h4>
                  <div className="max-h-[200px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Row</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadResult.errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{error.row}</TableCell>
                            <TableCell className="text-red-600">{error.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={resetUpload}>
                  Upload Another File
                </Button>
                <Button onClick={() => router.push("/channels/sku-mapping")}>
                  View All Mappings
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
