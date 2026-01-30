"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  Truck,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  FileText,
  Clock,
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
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Location {
  id: string;
  code: string;
  name: string;
}

interface UploadHistory {
  id: string;
  batchNo: string;
  type: "EXTERNAL_PO" | "ASN";
  status: "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED";
  totalRecords: number;
  successCount: number;
  errorCount: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadType, setUploadType] = useState<"EXTERNAL_PO" | "ASN" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch locations on mount
  useState(() => {
    fetchLocations();
    fetchUploadHistory();
  });

  async function fetchLocations() {
    try {
      const response = await fetch("/api/v1/locations?type=WAREHOUSE");
      if (response.ok) {
        const data = await response.json();
        const locationList = Array.isArray(data) ? data : data.items || [];
        setLocations(locationList);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  }

  async function fetchUploadHistory() {
    // This would fetch from an API that tracks upload batches
    // For now, we'll use mock data
    setUploadHistory([]);
  }

  function openUploadDialog(type: "EXTERNAL_PO" | "ASN") {
    setUploadType(type);
    setSelectedFile(null);
    setUploadError(null);
    setShowUploadDialog(true);
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        setUploadError("Please select a CSV file");
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !selectedLocation || !uploadType) {
      toast.error("Please select a file and location");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("location_id", selectedLocation);

      const endpoint = uploadType === "EXTERNAL_PO"
        ? "/api/v1/external-pos/upload"
        : "/api/v1/asns/upload";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const result = await response.json();
      toast.success(`Successfully uploaded ${result.successCount || 0} records`);
      setShowUploadDialog(false);
      fetchUploadHistory();
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate(type: "EXTERNAL_PO" | "ASN") {
    const templates = {
      EXTERNAL_PO: `external_po_number,external_vendor_code,external_vendor_name,po_date,expected_delivery_date,external_sku_code,external_sku_name,ordered_qty,unit_price
EXT-PO-001,VND-001,Vendor Name,2026-01-30,2026-02-15,SKU-001,Product Name,100,50.00
EXT-PO-001,VND-001,Vendor Name,2026-01-30,2026-02-15,SKU-002,Another Product,50,75.00`,
      ASN: `asn_no,external_asn_no,external_po_number,external_vendor_code,external_vendor_name,carrier,tracking_number,vehicle_number,driver_name,ship_date,expected_arrival,external_sku_code,external_sku_name,expected_qty,cartons,units_per_carton,batch_no,lot_no
ASN-001,EXT-ASN-001,EXT-PO-001,VND-001,Vendor Name,Yamato Transport,YMT-123456,TK-1234,Driver Name,2026-01-28,2026-01-30,SKU-001,Product Name,100,10,10,BATCH-001,LOT-001`,
    };

    const content = templates[type];
    const filename = type === "EXTERNAL_PO" ? "external_po_template.csv" : "asn_template.csv";

    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getStatusBadge(status: UploadHistory["status"]) {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case "PARTIAL":
        return <Badge className="bg-orange-500 text-white">Partial</Badge>;
      case "FAILED":
        return <Badge className="bg-red-500 text-white">Failed</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-500 text-white">Processing</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/inbound/goods-receipt")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Upload Center</h1>
          <p className="text-muted-foreground">
            Upload External POs and ASNs in bulk from CSV files
          </p>
        </div>
      </div>

      {/* Upload Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* External PO Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-100">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>External Purchase Orders</CardTitle>
                <CardDescription>
                  Upload POs from your ERP/SAP system
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file containing purchase order data. Each row can include
              multiple line items for the same PO.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("EXTERNAL_PO")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button onClick={() => openUploadDialog("EXTERNAL_PO")}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ASN Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-purple-100">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Advance Shipping Notices</CardTitle>
                <CardDescription>
                  Upload ASNs from vendors or carriers
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file containing shipping notice data with carrier
              and item details.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => downloadTemplate("ASN")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button onClick={() => openUploadDialog("ASN")}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CSV Format Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV Format Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">External PO CSV Columns:</h4>
            <code className="block p-3 bg-muted rounded-md text-sm overflow-x-auto">
              external_po_number, external_vendor_code, external_vendor_name,
              po_date, expected_delivery_date, external_sku_code, external_sku_name,
              ordered_qty, unit_price
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">ASN CSV Columns:</h4>
            <code className="block p-3 bg-muted rounded-md text-sm overflow-x-auto">
              asn_no, external_asn_no, external_po_number, external_vendor_code,
              external_vendor_name, carrier, tracking_number, vehicle_number,
              driver_name, ship_date, expected_arrival, external_sku_code,
              external_sku_name, expected_qty, cartons, units_per_carton,
              batch_no, lot_no
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Upload History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle className="text-base">Recent Uploads</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {uploadHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No upload history yet</p>
              <p className="text-sm text-muted-foreground">
                Your upload history will appear here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch No</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadHistory.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium">{upload.batchNo}</TableCell>
                    <TableCell>
                      {upload.type === "EXTERNAL_PO" ? (
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                          <span>External PO</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Truck className="h-4 w-4 text-purple-600" />
                          <span>ASN</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(upload.status)}</TableCell>
                    <TableCell className="text-right">{upload.totalRecords}</TableCell>
                    <TableCell className="text-right">
                      {upload.errorCount > 0 ? (
                        <span className="text-red-500">{upload.errorCount}</span>
                      ) : (
                        <span className="text-green-500">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(upload.uploadedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadType === "EXTERNAL_PO" ? (
                <>
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Upload External Purchase Orders
                </>
              ) : (
                <>
                  <Truck className="h-5 w-5 text-purple-600" />
                  Upload Advance Shipping Notices
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Select a location and CSV file to upload
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Location Selection */}
            <div className="space-y-2">
              <Label>Destination Location *</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse location" />
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

            {/* File Upload */}
            <div className="space-y-2">
              <Label>CSV File *</Label>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors
                  ${selectedFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400"}
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop your CSV file here or click to browse
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{uploadError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedLocation || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
