"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Truck,
  Package,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

interface AllocationAudit {
  id: string;
  orderId: string;
  orderNumber: string;
  shipmentType: string;
  allocatedCarrierId: string | null;
  allocatedCarrierName: string | null;
  allocationMode: string;
  decisionReason: string;
  csrScore: number | null;
  costScore: number | null;
  speedScore: number | null;
  reliabilityScore: number | null;
  alternativeCarriers: Record<string, any>[] | null;
  ruleId: string | null;
  ruleName: string | null;
  createdAt: string;
  createdBy: string | null;
}

const ALLOCATION_MODES = [
  { value: "AUTO", label: "Auto", color: "bg-green-100 text-green-800" },
  { value: "MANUAL", label: "Manual", color: "bg-blue-100 text-blue-800" },
  { value: "HYBRID", label: "Hybrid", color: "bg-purple-100 text-purple-800" },
  { value: "FALLBACK", label: "Fallback", color: "bg-orange-100 text-orange-800" },
];

const DECISION_REASONS = [
  { value: "BEST_CSR_SCORE", label: "Best CSR Score" },
  { value: "RULE_MATCH", label: "Rule Match" },
  { value: "MANUAL_SELECTION", label: "Manual Selection" },
  { value: "FORCED_ALLOCATION", label: "Forced Allocation" },
  { value: "FALLBACK_DEFAULT", label: "Fallback Default" },
  { value: "NO_SERVICEABLE_CARRIER", label: "No Serviceable Carrier" },
  { value: "COST_OPTIMIZED", label: "Cost Optimized" },
  { value: "SPEED_OPTIMIZED", label: "Speed Optimized" },
];

const SHIPMENT_TYPES = [
  { value: "FTL", label: "FTL" },
  { value: "B2B_PTL", label: "B2B/PTL" },
  { value: "B2C", label: "B2C" },
];

export default function AllocationAuditPage() {
  const [audits, setAudits] = useState<AllocationAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedAudit, setSelectedAudit] = useState<AllocationAudit | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const fetchAudits = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (typeFilter) params.set("shipment_type", typeFilter);
      if (modeFilter) params.set("allocation_mode", modeFilter);
      if (dateFilter) params.set("date", dateFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/allocation-config/audit?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      const result = await response.json();
      setAudits(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching audits:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter, modeFilter, dateFilter]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  function openDetailDialog(audit: AllocationAudit) {
    setSelectedAudit(audit);
    setIsDetailDialogOpen(true);
  }

  function getModeBadge(mode: string) {
    const config = ALLOCATION_MODES.find((m) => m.value === mode);
    return (
      <Badge className={config?.color || "bg-gray-100 text-gray-800"}>
        {config?.label || mode}
      </Badge>
    );
  }

  function getShipmentTypeBadge(type: string) {
    const colors: Record<string, string> = {
      FTL: "bg-blue-100 text-blue-800",
      B2B_PTL: "bg-purple-100 text-purple-800",
      B2C: "bg-green-100 text-green-800",
    };
    return (
      <Badge className={colors[type] || "bg-gray-100 text-gray-800"}>
        {type}
      </Badge>
    );
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getDecisionReasonLabel(reason: string): string {
    const config = DECISION_REASONS.find((r) => r.value === reason);
    return config?.label || reason;
  }

  // Stats
  const stats = {
    total: audits.length,
    auto: audits.filter((a) => a.allocationMode === "AUTO").length,
    manual: audits.filter((a) => a.allocationMode === "MANUAL").length,
    failed: audits.filter((a) => !a.allocatedCarrierId).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocation Audit</h1>
          <p className="text-muted-foreground">
            View complete history of carrier allocation decisions
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Allocations</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto Allocated</p>
                <p className="text-2xl font-bold">{stats.auto}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manual Allocated</p>
                <p className="text-2xl font-bold">{stats.manual}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {SHIPMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Modes</SelectItem>
                {ALLOCATION_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle>Allocation History</CardTitle>
          <CardDescription>
            {audits.length} allocation(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>CSR Score</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[80px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : audits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No audit logs found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                audits.map((audit) => (
                  <TableRow key={audit.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatDateTime(audit.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{audit.orderNumber}</div>
                    </TableCell>
                    <TableCell>
                      {getShipmentTypeBadge(audit.shipmentType)}
                    </TableCell>
                    <TableCell>
                      {audit.allocatedCarrierName ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span>{audit.allocatedCarrierName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-muted-foreground">Not Allocated</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getModeBadge(audit.allocationMode)}</TableCell>
                    <TableCell>
                      {audit.csrScore !== null ? (
                        <Badge variant="outline">{audit.csrScore.toFixed(1)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {getDecisionReasonLabel(audit.decisionReason)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetailDialog(audit)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Allocation Details</DialogTitle>
            <DialogDescription>
              Order: {selectedAudit?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedAudit && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Shipment Type</p>
                  {getShipmentTypeBadge(selectedAudit.shipmentType)}
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Allocation Mode</p>
                  {getModeBadge(selectedAudit.allocationMode)}
                </div>
              </div>

              {/* Allocated Carrier */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Allocated Carrier</p>
                {selectedAudit.allocatedCarrierName ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedAudit.allocatedCarrierName}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {selectedAudit.allocatedCarrierId}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-red-600">
                    <XCircle className="h-5 w-5" />
                    <span>No carrier allocated</span>
                  </div>
                )}
              </div>

              {/* CSR Scores */}
              {selectedAudit.csrScore !== null && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">CSR Scores</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {selectedAudit.csrScore?.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Score</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold">
                        {selectedAudit.costScore?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Cost</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold">
                        {selectedAudit.speedScore?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Speed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold">
                        {selectedAudit.reliabilityScore?.toFixed(1) || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">Reliability</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision Reason */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Decision Reason</p>
                <p className="font-medium">
                  {getDecisionReasonLabel(selectedAudit.decisionReason)}
                </p>
                {selectedAudit.ruleName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Matched Rule: {selectedAudit.ruleName}
                  </p>
                )}
              </div>

              {/* Alternative Carriers */}
              {selectedAudit.alternativeCarriers &&
                selectedAudit.alternativeCarriers.length > 0 && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-3">
                      Alternative Carriers Considered
                    </p>
                    <div className="space-y-2">
                      {selectedAudit.alternativeCarriers.map((carrier: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded"
                        >
                          <span>{carrier.name || carrier.carrierId}</span>
                          <Badge variant="outline">
                            Score: {carrier.score?.toFixed(1) || "-"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Timestamp */}
              <div className="text-sm text-muted-foreground">
                Allocated at: {formatDateTime(selectedAudit.createdAt)}
                {selectedAudit.createdBy && ` by ${selectedAudit.createdBy}`}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
