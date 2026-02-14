"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Package,
  Truck,
  RefreshCw,
  FileText,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface UnmanifestedDelivery {
  id: string;
  deliveryNo: string;
  awbNo: string | null;
  orderNo: string | null;
  customerName: string | null;
  status: string;
  carrierCode: string | null;
  carrierName: string | null;
  weight: number | null;
  shipDate: string | null;
  labelUrl: string | null;
}

interface ManifestItem {
  id: string;
  manifestNo: string;
  status: string;
  transporterName: string | null;
  transporterCode: string | null;
  deliveryCount: number;
  vehicleNo: string | null;
  driverName: string | null;
  driverPhone: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
}

const manifestStatusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-800" },
  CLOSED: { label: "Closed", color: "bg-yellow-100 text-yellow-800" },
  HANDED_OVER: { label: "Handed Over", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
};

export default function ManifestPage() {
  const [tab, setTab] = useState("unmanifested");
  const [unmanifested, setUnmanifested] = useState<UnmanifestedDelivery[]>([]);
  const [manifests, setManifests] = useState<ManifestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [carriers, setCarriers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [carrierFilter, setCarrierFilter] = useState("all");

  useEffect(() => {
    fetchCarriers();
  }, []);

  useEffect(() => {
    if (tab === "unmanifested") fetchUnmanifested();
    else fetchManifests();
  }, [tab, carrierFilter]);

  async function fetchCarriers() {
    try {
      const res = await fetch("/api/v1/transporters?limit=50");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.items || data?.data || [];
      setCarriers(items.map((t: { id: string; code: string; name: string }) => ({
        id: t.id, code: t.code, name: t.name,
      })));
    } catch {
      // ignore
    }
  }

  async function fetchUnmanifested() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (carrierFilter && carrierFilter !== "all") params.append("carrier_code", carrierFilter);
      params.append("limit", "200");
      const res = await fetch(`/api/v1/shipping/unmanifested?${params}`);
      const data = await res.json();
      setUnmanifested(data.deliveries || []);
    } catch {
      toast.error("Failed to fetch unmanifested deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function fetchManifests() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/shipping/manifests?limit=50");
      const data = await res.json();
      setManifests(data.manifests || []);
    } catch {
      toast.error("Failed to fetch manifests");
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unmanifested.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unmanifested.map((d) => d.id)));
    }
  };

  // Group selected deliveries by carrier for manifest creation
  async function handleCreateManifest() {
    if (selectedIds.size === 0) {
      toast.error("Select deliveries to manifest");
      return;
    }

    // Get the carrier of selected deliveries
    const selectedDeliveries = unmanifested.filter((d) => selectedIds.has(d.id));
    const carrierCodes = new Set(selectedDeliveries.map((d) => d.carrierCode).filter(Boolean));

    if (carrierCodes.size === 0) {
      toast.error("Selected deliveries have no carrier assigned");
      return;
    }

    if (carrierCodes.size > 1) {
      toast.error("Select deliveries from a single carrier to create a manifest");
      return;
    }

    const carrierCode = Array.from(carrierCodes)[0]!;
    const transporter = carriers.find((c) => c.code === carrierCode);

    if (!transporter) {
      toast.error("Carrier not found");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/v1/shipping/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryIds: Array.from(selectedIds),
          transporterId: transporter.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Manifest ${data.manifestNo} created with ${data.deliveriesAssigned} deliveries`);
        setSelectedIds(new Set());
        fetchUnmanifested();
      } else {
        toast.error(data.detail || "Failed to create manifest");
      }
    } catch {
      toast.error("Failed to create manifest");
    } finally {
      setCreating(false);
    }
  }

  async function handleCloseManifest(manifestId: string) {
    setClosingId(manifestId);
    try {
      const res = await fetch(`/api/v1/shipping/manifest/${manifestId}/close`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Manifest closed");
        fetchManifests();
      } else {
        const data = await res.json();
        toast.error(data.detail || "Failed to close manifest");
      }
    } catch {
      toast.error("Failed to close manifest");
    } finally {
      setClosingId(null);
    }
  }

  async function handleRequestPickup(manifestId: string) {
    try {
      const res = await fetch("/api/v1/shipping/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifestId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Pickup requested for ${data.awbCount} AWBs`);
        fetchManifests();
      } else {
        toast.error(data.detail || "Pickup request failed");
      }
    } catch {
      toast.error("Pickup request failed");
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manifest Management</h1>
          <p className="text-muted-foreground">
            Group deliveries into manifests for carrier handover
          </p>
        </div>
        <Button
          onClick={() => tab === "unmanifested" ? fetchUnmanifested() : fetchManifests()}
          variant="outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unmanifested">
            <Package className="mr-2 h-4 w-4" />
            Unmanifested ({unmanifested.length})
          </TabsTrigger>
          <TabsTrigger value="manifests">
            <FileText className="mr-2 h-4 w-4" />
            Manifests ({manifests.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Unmanifested Deliveries */}
        <TabsContent value="unmanifested" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Deliveries Ready for Manifest</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Carriers</SelectItem>
                    {carriers.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleCreateManifest}
                  disabled={selectedIds.size === 0 || creating}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Manifest ({selectedIds.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={unmanifested.length > 0 && selectedIds.size === unmanifested.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Delivery No</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Ship Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : unmanifested.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="h-8 w-8 text-green-500" />
                          <p className="text-muted-foreground">All deliveries are manifested</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    unmanifested.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(d.id)}
                            onCheckedChange={() => toggleSelect(d.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{d.deliveryNo}</TableCell>
                        <TableCell className="font-mono text-sm">{d.awbNo || "-"}</TableCell>
                        <TableCell>{d.orderNo || "-"}</TableCell>
                        <TableCell className="text-sm">{d.customerName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {d.carrierName || d.carrierCode || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.weight ? `${d.weight} kg` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(d.shipDate)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Manifests */}
        <TabsContent value="manifests" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manifest No</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead className="text-center">Deliveries</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : manifests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No manifests yet</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    manifests.map((m) => {
                      const statusConf = manifestStatusConfig[m.status] || {
                        label: m.status,
                        color: "bg-gray-100 text-gray-800",
                      };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {m.manifestNo}
                          </TableCell>
                          <TableCell>{m.transporterName || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{m.deliveryCount}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConf.color}>{statusConf.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.vehicleNo || "-"}
                            {m.driverName && (
                              <p className="text-xs text-muted-foreground">{m.driverName}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(m.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {m.status === "OPEN" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCloseManifest(m.id)}
                                  disabled={closingId === m.id}
                                >
                                  {closingId === m.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                  )}
                                  Close
                                </Button>
                              )}
                              {m.status === "CLOSED" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleRequestPickup(m.id)}
                                >
                                  <Truck className="mr-1 h-3 w-3" />
                                  Request Pickup
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
