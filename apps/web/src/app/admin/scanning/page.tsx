"use client";

import { useState, useRef, useEffect } from "react";
import {
  ScanLine,
  Package,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Send,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";

type ScanType =
  | "PICKUP_SCAN"
  | "INSCAN"
  | "OUTSCAN"
  | "LOAD_SCAN"
  | "UNLOAD_SCAN"
  | "HANDOVER_SCAN"
  | "OFD_SCAN"
  | "DELIVERY_SCAN";

const SCAN_TYPES: { value: ScanType; label: string; description: string }[] = [
  { value: "PICKUP_SCAN", label: "Pickup Scan", description: "Pickup from shipper" },
  { value: "INSCAN", label: "In-Scan", description: "Arrived at hub" },
  { value: "OUTSCAN", label: "Out-Scan", description: "Dispatched from hub" },
  { value: "LOAD_SCAN", label: "Load Scan", description: "Loaded on vehicle" },
  { value: "UNLOAD_SCAN", label: "Unload Scan", description: "Unloaded at hub" },
  { value: "HANDOVER_SCAN", label: "Handover Scan", description: "Partner handover" },
  { value: "OFD_SCAN", label: "OFD Scan", description: "Out for delivery" },
  { value: "DELIVERY_SCAN", label: "Delivery Scan", description: "Delivered" },
];

interface ScanResult {
  awb: string;
  status: "success" | "error" | "pending";
  message?: string;
  newStatus?: string;
}

export default function AdminScanningPage() {
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [scanType, setScanType] = useState<ScanType>("INSCAN");
  const [consignmentId, setConsignmentId] = useState<string>("");
  const [awbInput, setAwbInput] = useState("");
  const [scannedItems, setScannedItems] = useState<ScanResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: hubsData } = useQuery({
    queryKey: ["hubs"],
    queryFn: async () => {
      const res = await fetch("/api/hubs?pageSize=100");
      return res.json();
    },
  });

  const { data: consignmentsData } = useQuery({
    queryKey: ["consignments", selectedHub],
    queryFn: async () => {
      const res = await fetch(
        `/api/consignments?originHubId=${selectedHub}&status=OPEN&pageSize=50`
      );
      return res.json();
    },
    enabled: !!selectedHub && (scanType === "LOAD_SCAN" || scanType === "OUTSCAN"),
  });

  const hubs = hubsData?.data?.items || [];
  const consignments = consignmentsData?.data?.items || [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (awb: string) => {
    if (!awb.trim() || !selectedHub) return;

    const trimmedAwb = awb.trim().toUpperCase();

    if (scannedItems.find((item) => item.awb === trimmedAwb)) {
      setAwbInput("");
      return;
    }

    setScannedItems((prev) => [
      { awb: trimmedAwb, status: "pending" },
      ...prev,
    ]);
    setAwbInput("");

    try {
      const res = await fetch(`/api/shipments/${trimmedAwb}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanType,
          hubId: selectedHub,
          consignmentId: consignmentId || undefined,
          scannedBy: "ADMIN",
        }),
      });

      const data = await res.json();

      setScannedItems((prev) =>
        prev.map((item) =>
          item.awb === trimmedAwb
            ? {
                ...item,
                status: data.success ? "success" : "error",
                message: data.success ? data.data.message : data.error,
                newStatus: data.data?.newStatus,
              }
            : item
        )
      );
    } catch (error) {
      setScannedItems((prev) =>
        prev.map((item) =>
          item.awb === trimmedAwb
            ? { ...item, status: "error", message: "Network error" }
            : item
        )
      );
    }

    inputRef.current?.focus();
  };

  const handleBulkProcess = async () => {
    if (!selectedHub || scannedItems.length === 0) return;

    setIsProcessing(true);

    const pendingItems = scannedItems.filter(
      (item) => item.status === "pending" || item.status === "error"
    );
    const awbNumbers = pendingItems.map((item) => item.awb);

    try {
      const res = await fetch("/api/shipments/bulk-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awbNumbers,
          scanType,
          hubId: selectedHub,
          consignmentId: consignmentId || undefined,
          scannedBy: "ADMIN",
        }),
      });

      const data = await res.json();

      if (data.success) {
        const successAwbs = new Set(
          data.data.results.success.map((r: any) => r.awb)
        );
        const failedAwbs = new Map(
          data.data.results.failed.map((r: any) => [r.awb, r.reason])
        );

        setScannedItems((prev) =>
          prev.map((item) => {
            if (successAwbs.has(item.awb)) {
              return { ...item, status: "success", message: "Scan recorded" };
            }
            if (failedAwbs.has(item.awb)) {
              return { ...item, status: "error", message: failedAwbs.get(item.awb) };
            }
            return item;
          })
        );
      }
    } catch (error) {
      console.error("Bulk process error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearScans = () => {
    setScannedItems([]);
    inputRef.current?.focus();
  };

  const removeScan = (awb: string) => {
    setScannedItems((prev) => prev.filter((item) => item.awb !== awb));
  };

  const successCount = scannedItems.filter((i) => i.status === "success").length;
  const errorCount = scannedItems.filter((i) => i.status === "error").length;
  const pendingCount = scannedItems.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub Scanning</h1>
          <p className="text-gray-500">Scan shipments for hub operations</p>
        </div>
        <div className="flex items-center gap-3">
          {scannedItems.length > 0 && (
            <>
              <Badge variant="success">{successCount} Success</Badge>
              {errorCount > 0 && <Badge variant="danger">{errorCount} Failed</Badge>}
              {pendingCount > 0 && <Badge variant="warning">{pendingCount} Pending</Badge>}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <div className="p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Scan Settings</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hub *</label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Hub</option>
                {hubs.map((hub: any) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.code} - {hub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scan Type *</label>
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value as ScanType)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {SCAN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {(scanType === "LOAD_SCAN" || scanType === "OUTSCAN") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consignment (Optional)
                </label>
                <select
                  value={consignmentId}
                  onChange={(e) => setConsignmentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">No Consignment</option>
                  {consignments.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.consignmentNumber} ({c._count?.shipments || 0} pkgs)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Scanned</span>
                <span className="font-medium">{scannedItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Successful</span>
                <span className="font-medium text-green-600">{successCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Failed</span>
                <span className="font-medium text-red-600">{errorCount}</span>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              {pendingCount > 0 && (
                <Button onClick={handleBulkProcess} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Process {pendingCount} Pending
                    </>
                  )}
                </Button>
              )}
              {scannedItems.length > 0 && (
                <Button variant="outline" onClick={clearScans} className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="p-5">
            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                <ScanLine className="h-8 w-8 text-primary-600" />
                <input
                  ref={inputRef}
                  type="text"
                  value={awbInput}
                  onChange={(e) => setAwbInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScan(awbInput);
                  }}
                  placeholder="Scan AWB or enter manually..."
                  disabled={!selectedHub}
                  className="flex-1 text-xl font-mono bg-transparent border-none focus:outline-none placeholder-primary-400"
                />
                <Button onClick={() => handleScan(awbInput)} disabled={!awbInput.trim() || !selectedHub}>
                  Scan
                </Button>
              </div>
              {!selectedHub && (
                <p className="text-sm text-amber-600 mt-2">Please select a hub to start scanning</p>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {scannedItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No items scanned yet</p>
                </div>
              ) : (
                scannedItems.map((item, index) => (
                  <div
                    key={`${item.awb}-${index}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      item.status === "success"
                        ? "bg-green-50 border-green-200"
                        : item.status === "error"
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : item.status === "error" ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                      )}
                      <div>
                        <p className="font-mono font-medium">{item.awb}</p>
                        {item.message && (
                          <p className={`text-sm ${item.status === "error" ? "text-red-600" : "text-green-600"}`}>
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.newStatus && <Badge variant="success" size="sm">{item.newStatus}</Badge>}
                      <button onClick={() => removeScan(item.awb)} className="p-1 text-gray-400 hover:text-gray-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
