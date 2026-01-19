"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ClipboardCheck,
  Search,
  RefreshCw,
  Upload,
  Eye,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileImage,
  X,
} from "lucide-react";

interface PODItem {
  id: string;
  lrNumber: string;
  consigneeName: string;
  destination: string;
  deliveredAt: string;
  status: "PENDING" | "UPLOADED" | "VERIFIED" | "DISPUTED";
  podUrl: string | null;
  receiverName: string | null;
  remarks: string | null;
}

export default function PODManagementPage() {
  const router = useRouter();
  const [pods, setPods] = useState<PODItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPod, setSelectedPod] = useState<PODItem | null>(null);

  const fetchPODs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/b2b-logistics/pod");
      if (response.ok) {
        const data = await response.json();
        setPods(Array.isArray(data) ? data : data.items || []);
      } else {
        // Demo data
        setPods([
          { id: "1", lrNumber: "LR-2026-0001", consigneeName: "ABC Distributors", destination: "Mumbai", deliveredAt: new Date().toISOString(), status: "PENDING", podUrl: null, receiverName: null, remarks: null },
          { id: "2", lrNumber: "LR-2026-0002", consigneeName: "XYZ Retailers", destination: "Pune", deliveredAt: new Date().toISOString(), status: "UPLOADED", podUrl: "/sample-pod.jpg", receiverName: "Rajesh Kumar", remarks: "Received in good condition" },
          { id: "3", lrNumber: "LR-2026-0003", consigneeName: "PQR Traders", destination: "Nagpur", deliveredAt: new Date().toISOString(), status: "VERIFIED", podUrl: "/sample-pod.jpg", receiverName: "Amit Singh", remarks: null },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch PODs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPODs();
  }, [fetchPODs]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-700",
      UPLOADED: "bg-blue-100 text-blue-700",
      VERIFIED: "bg-green-100 text-green-700",
      DISPUTED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <CheckCircle className="h-4 w-4" />;
      case "PENDING":
        return <Clock className="h-4 w-4" />;
      case "DISPUTED":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileImage className="h-4 w-4" />;
    }
  };

  const filteredPods = pods.filter((pod) => {
    const matchesStatus = statusFilter === "all" || pod.status === statusFilter;
    const matchesSearch = !searchQuery ||
      pod.lrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.consigneeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    pending: pods.filter((p) => p.status === "PENDING").length,
    uploaded: pods.filter((p) => p.status === "UPLOADED").length,
    verified: pods.filter((p) => p.status === "VERIFIED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">POD Management</h1>
          <p className="text-gray-500">Manage Proof of Delivery for your shipments</p>
        </div>
        <button
          onClick={fetchPODs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700">Pending Upload</p>
              <p className="text-2xl font-bold text-amber-800">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Awaiting Verification</p>
              <p className="text-2xl font-bold text-blue-800">{stats.uploaded}</p>
            </div>
            <FileImage className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Verified</p>
              <p className="text-2xl font-bold text-green-800">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by LR Number or Consignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="VERIFIED">Verified</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>
      </div>

      {/* POD List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LR Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receiver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : filteredPods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No PODs found</p>
                  </td>
                </tr>
              ) : (
                filteredPods.map((pod) => (
                  <tr key={pod.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm text-blue-600">{pod.lrNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{pod.consigneeName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{pod.destination}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{format(new Date(pod.deliveredAt), "dd MMM yyyy")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{pod.receiverName || "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(pod.status)}`}>
                        {getStatusIcon(pod.status)}
                        {pod.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pod.status === "PENDING" && (
                          <button
                            onClick={() => {
                              setSelectedPod(pod);
                              setShowUploadModal(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                          >
                            <Upload className="h-3 w-3" />
                            Upload
                          </button>
                        )}
                        {pod.podUrl && (
                          <>
                            <button
                              onClick={() => {/* View POD */}}
                              className="p-1 text-gray-500 hover:text-blue-600"
                              title="View POD"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {/* Download POD */}}
                              className="p-1 text-gray-500 hover:text-blue-600"
                              title="Download POD"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && selectedPod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Upload POD - {selectedPod.lrNumber}</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Person who received the delivery"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POD Image</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any delivery notes"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  fetchPODs();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Upload POD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
