"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  FileText,
  Eye,
  Trash2,
} from "lucide-react";

interface UploadResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  shipments: { awb: string; orderNumber: string; consignee: string }[];
}

export default function BulkShipmentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv") && !selectedFile.name.endsWith(".xlsx")) {
      setError("Please upload a CSV or Excel file");
      return;
    }

    setFile(selectedFile);
    setError("");
    setUploadResult(null);

    // Preview first few rows
    if (selectedFile.name.endsWith(".csv")) {
      const text = await selectedFile.text();
      const lines = text.split("\n").slice(0, 6);
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",");
        const row: any = {};
        headers.forEach((h, i) => {
          row[h] = values[i]?.trim() || "";
        });
        return row;
      });
      setPreviewData(rows.filter((r) => Object.values(r).some((v) => v)));
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/v1/deliveries/bulk-import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadResult({
          success: true,
          totalRows: data.totalRows || data.total || 0,
          successCount: data.successCount || data.created || 0,
          errorCount: data.errorCount || data.errors?.length || 0,
          errors: data.errors || [],
          shipments: data.shipments || data.created_shipments || [],
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Upload failed. Please check your file format.");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "order_number",
      "consignee_name",
      "consignee_phone",
      "consignee_email",
      "address_line_1",
      "address_line_2",
      "city",
      "state",
      "pincode",
      "weight_kg",
      "length_cm",
      "width_cm",
      "height_cm",
      "payment_mode",
      "cod_amount",
      "product_description",
    ];

    const sampleData = [
      [
        "ORD-001",
        "John Doe",
        "9876543210",
        "john@example.com",
        "123 Main Street",
        "Near Park",
        "Mumbai",
        "Maharashtra",
        "400001",
        "0.5",
        "10",
        "10",
        "5",
        "COD",
        "999",
        "T-Shirt Cotton",
      ],
      [
        "ORD-002",
        "Jane Smith",
        "9876543211",
        "",
        "456 Oak Avenue",
        "",
        "Delhi",
        "Delhi",
        "110001",
        "1.0",
        "20",
        "15",
        "10",
        "PREPAID",
        "0",
        "Electronics",
      ],
    ];

    const csvContent = [headers.join(","), ...sampleData.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shipment_upload_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
    setPreviewData([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Shipment Upload</h1>
          <p className="text-gray-500">Upload multiple shipments via CSV file</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">How to upload shipments</h3>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
          <li>Download the CSV template with required columns</li>
          <li>Fill in your shipment details (one shipment per row)</li>
          <li>Save the file and upload it here</li>
          <li>Review the preview and confirm upload</li>
        </ol>
        <button
          onClick={downloadTemplate}
          className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white rounded-lg border border-blue-200 hover:bg-blue-50"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className={`rounded-lg border p-6 ${uploadResult.errorCount === 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
          <div className="flex items-center gap-3 mb-4">
            {uploadResult.errorCount === 0 ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            )}
            <div>
              <h3 className="font-semibold text-lg">Upload Complete</h3>
              <p className="text-sm text-gray-600">
                {uploadResult.successCount} of {uploadResult.totalRows} shipments created successfully
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{uploadResult.totalRows}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{uploadResult.successCount}</p>
              <p className="text-xs text-gray-500">Successful</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{uploadResult.errorCount}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>

          {uploadResult.errors.length > 0 && (
            <div className="bg-white rounded-lg border p-3 mb-4">
              <p className="font-medium text-sm text-red-700 mb-2">Errors:</p>
              <div className="max-h-32 overflow-y-auto">
                {uploadResult.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-gray-600">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/client/b2c/shipments")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              View Shipments
            </button>
            <button
              onClick={resetUpload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              Upload More
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!uploadResult && (
        <div className="bg-white rounded-lg border p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700">Drop your file here or click to browse</p>
              <p className="text-sm text-gray-500 mt-1">Supports CSV and Excel files</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-10 w-10 text-green-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetUpload}
                  className="p-2 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview (first {previewData.length} rows)
                  </h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(previewData[0] || {}).slice(0, 6).map((key) => (
                            <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {key.replace(/_/g, " ")}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">...</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {previewData.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).slice(0, 6).map((value: any, i) => (
                              <td key={i} className="px-3 py-2 text-gray-600 truncate max-w-[150px]">
                                {value || "-"}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-gray-400">...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload and Create Shipments
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Column Reference */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" />
          Column Reference
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { col: "order_number", req: "Yes", desc: "Your order reference", ex: "ORD-001" },
                { col: "consignee_name", req: "Yes", desc: "Customer full name", ex: "John Doe" },
                { col: "consignee_phone", req: "Yes", desc: "10-digit mobile number", ex: "9876543210" },
                { col: "consignee_email", req: "No", desc: "Email address", ex: "john@example.com" },
                { col: "address_line_1", req: "Yes", desc: "Full address", ex: "123 Main Street" },
                { col: "address_line_2", req: "No", desc: "Landmark", ex: "Near Park" },
                { col: "city", req: "Yes", desc: "City name", ex: "Mumbai" },
                { col: "state", req: "Yes", desc: "State name", ex: "Maharashtra" },
                { col: "pincode", req: "Yes", desc: "6-digit pincode", ex: "400001" },
                { col: "weight_kg", req: "Yes", desc: "Weight in kilograms", ex: "0.5" },
                { col: "payment_mode", req: "Yes", desc: "COD or PREPAID", ex: "COD" },
                { col: "cod_amount", req: "If COD", desc: "Amount to collect", ex: "999" },
                { col: "product_description", req: "Yes", desc: "Product description", ex: "T-Shirt" },
              ].map((item) => (
                <tr key={item.col}>
                  <td className="px-4 py-2 font-mono text-xs">{item.col}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${item.req === "Yes" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {item.req}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{item.desc}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
