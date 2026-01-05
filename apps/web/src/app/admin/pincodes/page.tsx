"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Search,
  RefreshCw,
  Building2,
  Package,
  Truck,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, Button, Badge } from "@cjdquick/ui";
import { useHubFilter } from "@/contexts/HubFilterContext";

type TabType = "coverage" | "sla";
type ServiceFilter = "ALL" | "PICKUP" | "DELIVERY" | "BOTH";

interface HubWithPincodes {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  servicedPincodes: {
    id: string;
    pincode: string;
    type: string;
    priority: number;
  }[];
}

interface SlaEntry {
  id: string;
  originPincode: string;
  destinationPincode: string;
  serviceType: string;
  tatDays: number;
  minDays: number;
  maxDays: number;
  routeType: string | null;
  codAvailable: boolean;
  reverseAvailable: boolean;
  slaPercentage: number;
}

// CSV Upload Component
function CSVUploader({
  endpoint,
  templateEndpoint,
  title,
  onSuccess,
  noCard = false,
}: {
  endpoint: string;
  templateEndpoint: string;
  title: string;
  onSuccess: () => void;
  noCard?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
  }, [mode]);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setResult({ success: false, error: "Please upload a CSV file" });
      return;
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        onSuccess();
      }
    } catch (error) {
      setResult({ success: false, error: "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch(templateEndpoint);
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([data.data.sampleCSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download template:", error);
    }
  };

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "merge" | "replace")}
            className="px-3 py-1.5 text-sm border rounded-lg"
          >
            <option value="merge">Merge (Add/Update)</option>
            <option value="replace">Replace All</option>
          </select>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" />
            Template
          </Button>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-8 w-8 text-primary-500 animate-spin" />
            <p className="text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-gray-600">
              Drag & drop CSV file here, or click to browse
            </p>
            <p className="text-sm text-gray-400">Supports .csv files only</p>
          </div>
        )}
      </div>

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}
        >
          {result.success ? (
            <div>
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <CheckCircle2 className="h-5 w-5" />
                Upload Successful
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total:</span>{" "}
                  <span className="font-medium">{result.data.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Success:</span>{" "}
                  <span className="font-medium text-green-600">{result.data.success}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>{" "}
                  <span className="font-medium text-blue-600">{result.data.created}</span>
                </div>
                <div>
                  <span className="text-gray-500">Updated:</span>{" "}
                  <span className="font-medium text-amber-600">{result.data.updated}</span>
                </div>
              </div>
              {result.data.failed > 0 && (
                <div className="mt-2">
                  <span className="text-red-600 font-medium">{result.data.failed} failed</span>
                  {result.data.errors?.length > 0 && (
                    <ul className="mt-1 text-sm text-red-600 list-disc list-inside max-h-24 overflow-y-auto">
                      {result.data.errors.map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              {result.error}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (noCard) return <div>{content}</div>;
  return <Card className="p-5">{content}</Card>;
}

// Coverage Tab Component
function CoverageTab() {
  const queryClient = useQueryClient();
  const { selectedHubId } = useHubFilter();
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("ALL");
  const [searchPincode, setSearchPincode] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const hubCoverageRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hubs-pincodes", selectedHubId],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "100", includePincodes: "true" });
      if (selectedHubId) params.set("hubId", selectedHubId);
      const res = await fetch(`/api/hubs?${params}`);
      return res.json();
    },
  });

  const hubs = data?.data?.items || [];

  // Calculate stats
  const allPincodes = new Set<string>();
  const pickupPincodes = new Set<string>();
  const deliveryPincodes = new Set<string>();
  const pincodeDetails: { pincode: string; hubCode: string; hubName: string; type: string }[] = [];

  hubs.forEach((hub: HubWithPincodes) => {
    hub.servicedPincodes?.forEach((p) => {
      allPincodes.add(p.pincode);
      if (p.type === "PICKUP" || p.type === "BOTH") pickupPincodes.add(p.pincode);
      if (p.type === "DELIVERY" || p.type === "BOTH") deliveryPincodes.add(p.pincode);
      pincodeDetails.push({
        pincode: p.pincode,
        hubCode: hub.code,
        hubName: hub.name,
        type: p.type,
      });
    });
  });

  const handleSearch = async () => {
    if (!searchPincode || searchPincode.length !== 6) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/hubs/nearest?pincode=${searchPincode}`);
      setSearchResult(await res.json());
    } catch {
      setSearchResult({ success: false, error: "Failed to check" });
    }
    setSearching(false);
  };

  const handleCardClick = (filter: ServiceFilter) => {
    setServiceFilter(filter);
    // Scroll to hub coverage section
    setTimeout(() => {
      hubCoverageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const downloadExistingData = () => {
    // Generate CSV from current data
    const csvHeader = "pincode,hub_code,hub_name,service_type\n";
    const csvRows = pincodeDetails
      .map((p) => `${p.pincode},${p.hubCode},${p.hubName},${p.type}`)
      .join("\n");
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pincode_coverage_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHubs = hubs.map((hub: HubWithPincodes) => ({
    ...hub,
    servicedPincodes:
      serviceFilter === "ALL"
        ? hub.servicedPincodes
        : hub.servicedPincodes?.filter((p) =>
            serviceFilter === "BOTH" ? p.type === "BOTH" : p.type === serviceFilter || p.type === "BOTH"
          ),
  }));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div
          className="cursor-pointer hover:ring-2 ring-blue-500 transition-all rounded-lg"
          onClick={() => handleCardClick("ALL")}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allPincodes.size}</p>
                <p className="text-sm text-gray-500">Total Pincodes</p>
              </div>
            </div>
          </Card>
        </div>
        <div
          className={`cursor-pointer hover:ring-2 ring-green-500 transition-all rounded-lg ${serviceFilter === "PICKUP" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => handleCardClick("PICKUP")}
        >
          <Card className={`p-4 ${serviceFilter === "PICKUP" ? "bg-green-50" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pickupPincodes.size}</p>
                <p className="text-sm text-gray-500">First Mile (Pickup)</p>
              </div>
            </div>
          </Card>
        </div>
        <div
          className={`cursor-pointer hover:ring-2 ring-purple-500 transition-all rounded-lg ${serviceFilter === "DELIVERY" ? "ring-2 ring-purple-500" : ""}`}
          onClick={() => handleCardClick("DELIVERY")}
        >
          <Card className={`p-4 ${serviceFilter === "DELIVERY" ? "bg-purple-50" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deliveryPincodes.size}</p>
                <p className="text-sm text-gray-500">Last Mile (Delivery)</p>
              </div>
            </div>
          </Card>
        </div>
        <div
          className="cursor-pointer hover:ring-2 ring-orange-500 transition-all rounded-lg"
          onClick={() => window.location.href = "/admin/hubs"}
        >
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{hubs.length}</p>
                <p className="text-sm text-gray-500">Active Hubs</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* CSV Upload & Download */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Pincode Coverage Data</h3>
          <Button variant="outline" onClick={downloadExistingData} disabled={pincodeDetails.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download Existing Data ({pincodeDetails.length} records)
          </Button>
        </div>
        <CSVUploader
          endpoint="/api/pincodes/upload"
          templateEndpoint="/api/pincodes/upload"
          title="Upload Pincode Coverage CSV"
          noCard={true}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["admin-hubs-pincodes"] });
          }}
        />
      </Card>

      {/* Pincode Checker */}
      <Card>
        <div className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Check Pincode Serviceability</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter 6-digit pincode"
                value={searchPincode}
                onChange={(e) => {
                  setSearchPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setSearchResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Check"}
            </Button>
          </div>

          {searchResult && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50">
              {searchResult.success && searchResult.data ? (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-3">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Pincode {searchPincode} is serviceable!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                        <Package className="h-4 w-4" />
                        First Mile (Pickup)
                      </div>
                      {searchResult.data.pickup ? (
                        <p className="text-sm text-green-600">
                          {searchResult.data.pickup.name} ({searchResult.data.pickup.code})
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Not available</p>
                      )}
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 text-purple-700 font-medium mb-1">
                        <Truck className="h-4 w-4" />
                        Last Mile (Delivery)
                      </div>
                      {searchResult.data.delivery ? (
                        <p className="text-sm text-purple-600">
                          {searchResult.data.delivery.name} ({searchResult.data.delivery.code})
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Not available</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span>Pincode {searchPincode} is not currently serviceable</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Service Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500">Filter by service:</span>
        {(["ALL", "PICKUP", "DELIVERY", "BOTH"] as ServiceFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setServiceFilter(filter)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              serviceFilter === filter
                ? filter === "PICKUP"
                  ? "bg-green-100 text-green-700"
                  : filter === "DELIVERY"
                  ? "bg-purple-100 text-purple-700"
                  : filter === "BOTH"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter === "PICKUP" ? "First Mile" : filter === "DELIVERY" ? "Last Mile" : filter === "BOTH" ? "Both" : "All"}
          </button>
        ))}
      </div>

      {/* Hub Coverage Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div ref={hubCoverageRef}>
          <Card>
            <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Hub Coverage
                {serviceFilter !== "ALL" && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({serviceFilter === "PICKUP" ? "First Mile" : serviceFilter === "DELIVERY" ? "Last Mile" : "Both"})
                  </span>
                )}
              </h2>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {filteredHubs.map((hub: HubWithPincodes) => (
                <div key={hub.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {hub.code} - {hub.name}
                      </h3>
                      <p className="text-sm text-gray-500">{hub.city}, {hub.state}</p>
                    </div>
                    <span className="text-sm font-medium text-primary-600">
                      {hub.servicedPincodes?.length || 0} pincodes
                    </span>
                  </div>
                  {hub.servicedPincodes && hub.servicedPincodes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {hub.servicedPincodes.slice(0, 25).map((p) => (
                        <span
                          key={p.id}
                          className={`px-2 py-1 text-xs rounded ${
                            p.type === "BOTH"
                              ? "bg-blue-100 text-blue-700"
                              : p.type === "PICKUP"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {p.pincode}
                          <span className="text-xs opacity-70 ml-1">
                            ({p.type === "BOTH" ? "FM+LM" : p.type === "PICKUP" ? "FM" : "LM"})
                          </span>
                        </span>
                      ))}
                      {hub.servicedPincodes.length > 25 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{hub.servicedPincodes.length - 25} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {hubs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No hubs configured yet</p>
                </div>
              )}
            </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// SLA Tab Component
function SlaTab() {
  const queryClient = useQueryClient();
  const [originFilter, setOriginFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const slaTableRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-pincode-sla", originFilter, destFilter, serviceTypeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (originFilter) params.set("originPincode", originFilter);
      if (destFilter) params.set("destinationPincode", destFilter);
      if (serviceTypeFilter) params.set("serviceType", serviceTypeFilter);
      const res = await fetch(`/api/pincodes/sla?${params}`);
      return res.json();
    },
  });

  const items: SlaEntry[] = data?.data?.items || [];
  const stats = data?.data?.stats || {};
  const totalPages = data?.data?.totalPages || 1;
  const total = data?.data?.total || 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pincodes/sla?id=${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pincode-sla"] });
    },
  });

  const handleCardClick = () => {
    setTimeout(() => {
      slaTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const downloadExistingSlaData = async () => {
    // Fetch all SLA data for export
    const res = await fetch(`/api/pincodes/sla?pageSize=10000`);
    const result = await res.json();
    if (!result.success) return;

    const allItems: SlaEntry[] = result.data.items || [];
    const csvHeader = "origin_pincode,destination_pincode,service_type,tat_days,min_days,max_days,route_type,cod_available,reverse_available,sla_percentage\n";
    const csvRows = allItems
      .map((sla) => `${sla.originPincode},${sla.destinationPincode},${sla.serviceType},${sla.tatDays},${sla.minDays},${sla.maxDays},${sla.routeType || ""},${sla.codAvailable},${sla.reverseAvailable},${sla.slaPercentage}`)
      .join("\n");
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pincode_sla_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="cursor-pointer hover:ring-2 ring-blue-500 transition-all rounded-lg" onClick={handleCardClick}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowRight className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalLanes || 0}</p>
                <p className="text-sm text-gray-500">Total Lanes</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="cursor-pointer hover:ring-2 ring-green-500 transition-all rounded-lg" onClick={handleCardClick}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueOrigins || 0}</p>
                <p className="text-sm text-gray-500">Origin Pincodes</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="cursor-pointer hover:ring-2 ring-purple-500 transition-all rounded-lg" onClick={handleCardClick}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueDestinations || 0}</p>
                <p className="text-sm text-gray-500">Destination Pincodes</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="cursor-pointer hover:ring-2 ring-orange-500 transition-all rounded-lg" onClick={handleCardClick}>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byServiceType?.STANDARD || 0}</p>
                <p className="text-sm text-gray-500">Standard SLAs</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* CSV Upload & Download */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Pincode-to-Pincode SLA Data</h3>
          <Button variant="outline" onClick={downloadExistingSlaData} disabled={total === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download Existing Data ({total} records)
          </Button>
        </div>
        <CSVUploader
          endpoint="/api/pincodes/sla/upload"
          templateEndpoint="/api/pincodes/sla/upload"
          title="Upload Pincode-to-Pincode SLA CSV"
          noCard={true}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["admin-pincode-sla"] });
          }}
        />
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Origin Pincode</label>
            <input
              type="text"
              placeholder="e.g. 110001"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Destination Pincode</label>
            <input
              type="text"
              placeholder="e.g. 400001"
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Service Type</label>
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="EXPRESS">Express</option>
              <option value="STANDARD">Standard</option>
              <option value="ECONOMY">Economy</option>
            </select>
          </div>
          <div className="pt-5">
            <Button
              variant="outline"
              onClick={() => {
                setOriginFilter("");
                setDestFilter("");
                setServiceTypeFilter("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* SLA Table */}
      <div ref={slaTableRef}>
        <Card>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 font-medium text-gray-600">Origin</th>
                <th className="text-left p-4 font-medium text-gray-600">Destination</th>
                <th className="text-left p-4 font-medium text-gray-600">Service</th>
                <th className="text-left p-4 font-medium text-gray-600">TAT (Days)</th>
                <th className="text-left p-4 font-medium text-gray-600">Route Type</th>
                <th className="text-left p-4 font-medium text-gray-600">COD</th>
                <th className="text-left p-4 font-medium text-gray-600">SLA %</th>
                <th className="text-right p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <Clock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p>No SLA entries found</p>
                    <p className="text-sm">Upload a CSV to add pincode-to-pincode SLAs</p>
                  </td>
                </tr>
              ) : (
                items.map((sla: SlaEntry) => (
                  <tr key={sla.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono font-medium text-green-600">{sla.originPincode}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="font-mono font-medium text-purple-600">{sla.destinationPincode}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          sla.serviceType === "EXPRESS"
                            ? "danger"
                            : sla.serviceType === "ECONOMY"
                            ? "default"
                            : "primary"
                        }
                        size="sm"
                      >
                        {sla.serviceType}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{sla.tatDays}</span>
                        <span className="text-xs text-gray-500">
                          ({sla.minDays}-{sla.maxDays})
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-600">{sla.routeType || "-"}</span>
                    </td>
                    <td className="p-4">
                      {sla.codAvailable ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium">{sla.slaPercentage}%</span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this SLA entry?")) {
                            deleteMutation.mutate(sla.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
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
        )}
        </Card>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminPincodesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("coverage");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pincode Management</h1>
        <p className="text-gray-500">
          Manage pincode serviceability and lane-level SLAs
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("coverage")}
            className={`pb-3 px-1 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "coverage"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Pincode Coverage
            </div>
          </button>
          <button
            onClick={() => setActiveTab("sla")}
            className={`pb-3 px-1 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "sla"
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pincode-to-Pincode SLA
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "coverage" ? <CoverageTab /> : <SlaTab />}
    </div>
  );
}
