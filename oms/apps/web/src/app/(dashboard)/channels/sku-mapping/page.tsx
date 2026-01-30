"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Link2,
  Package,
  AlertTriangle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface SkuMapping {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  connectionId: string;
  connectionName: string;
  channel: string;
  marketplaceSku: string;
  marketplaceSkuName: string | null;
  listingStatus: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UnmappedSku {
  skuId: string;
  skuCode: string;
  skuName: string;
}

interface MappingSummary {
  totalMappings: number;
  activeMappings: number;
  inactiveMappings: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
}

interface MarketplaceConnection {
  id: string;
  marketplace: string;
  connectionName: string;
  status: string;
}

const channelColors: Record<string, string> = {
  AMAZON: "bg-orange-100 text-orange-800",
  FLIPKART: "bg-blue-100 text-blue-800",
  SHOPIFY: "bg-green-100 text-green-800",
  MYNTRA: "bg-pink-100 text-pink-800",
  AJIO: "bg-purple-100 text-purple-800",
  MEESHO: "bg-yellow-100 text-yellow-800",
  NYKAA: "bg-rose-100 text-rose-800",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  BLOCKED: "bg-red-100 text-red-800",
  PENDING: "bg-yellow-100 text-yellow-800",
};

export default function SkuMappingPage() {
  const router = useRouter();
  const [mappings, setMappings] = useState<SkuMapping[]>([]);
  const [unmappedSkus, setUnmappedSkus] = useState<UnmappedSku[]>([]);
  const [summary, setSummary] = useState<MappingSummary | null>(null);
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [connectionFilter, setConnectionFilter] = useState<string>("all");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<SkuMapping | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for new mapping
  const [newMapping, setNewMapping] = useState({
    skuId: "",
    connectionId: "",
    marketplaceSku: "",
    marketplaceSkuName: "",
  });

  const fetchMappings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (channelFilter && channelFilter !== "all") params.append("channel", channelFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      if (searchQuery) params.append("search", searchQuery);
      params.append("limit", "100");

      const response = await fetch(`/api/v1/sku-mappings?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMappings(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching mappings:", error);
    }
  }, [channelFilter, statusFilter, connectionFilter, searchQuery]);

  const fetchUnmappedSkus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (connectionFilter && connectionFilter !== "all") params.append("connection_id", connectionFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/sku-mappings/unmapped?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setUnmappedSkus(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching unmapped SKUs:", error);
    }
  }, [connectionFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/sku-mappings/summary");
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/marketplaces");
      if (response.ok) {
        const data = await response.json();
        setConnections(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchMappings(),
      fetchUnmappedSkus(),
      fetchSummary(),
      fetchConnections(),
    ]);
    setIsLoading(false);
  }, [fetchMappings, fetchUnmappedSkus, fetchSummary, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    // Refetch when filters change
    const timer = setTimeout(() => {
      fetchMappings();
      fetchUnmappedSkus();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, channelFilter, statusFilter, connectionFilter, fetchMappings, fetchUnmappedSkus]);

  const handleCreateMapping = async () => {
    if (!newMapping.skuId || !newMapping.connectionId || !newMapping.marketplaceSku) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/sku-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMapping),
      });

      if (response.ok) {
        toast.success("SKU mapping created successfully");
        setShowCreateDialog(false);
        setNewMapping({ skuId: "", connectionId: "", marketplaceSku: "", marketplaceSkuName: "" });
        fetchAll();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to create mapping");
      }
    } catch (error) {
      toast.error("Failed to create mapping");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!selectedMapping) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/sku-mappings/${selectedMapping.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("SKU mapping deleted successfully");
        setShowDeleteDialog(false);
        setSelectedMapping(null);
        fetchAll();
      } else {
        toast.error("Failed to delete mapping");
      }
    } catch (error) {
      toast.error("Failed to delete mapping");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSyncEnabled = async (mapping: SkuMapping) => {
    try {
      const response = await fetch(`/api/v1/sku-mappings/${mapping.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: !mapping.syncEnabled }),
      });

      if (response.ok) {
        toast.success(`Sync ${mapping.syncEnabled ? "disabled" : "enabled"} for ${mapping.skuCode}`);
        fetchMappings();
      } else {
        toast.error("Failed to update sync status");
      }
    } catch (error) {
      toast.error("Failed to update sync status");
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-800"}>
        {status}
      </Badge>
    );
  };

  const getChannelBadge = (channel: string) => {
    return (
      <Badge className={channelColors[channel] || "bg-gray-100 text-gray-800"}>
        {channel}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SKU Mapping</h1>
          <p className="text-muted-foreground">
            Map internal SKUs to marketplace-specific identifiers (ASIN, FSN, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => router.push("/channels/sku-mapping/upload")}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalMappings || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.activeMappings || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sync enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unmapped</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{unmappedSkus.length}</div>
            <p className="text-xs text-muted-foreground">
              SKUs without mapping
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Channels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(summary?.byChannel || {}).length}</div>
            <p className="text-xs text-muted-foreground">
              Connected marketplaces
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel breakdown */}
      {summary?.byChannel && Object.keys(summary.byChannel).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Mappings by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(summary.byChannel).map(([channel, count]) => (
                <div key={channel} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  {getChannelBadge(channel)}
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Mappings</TabsTrigger>
            <TabsTrigger value="unmapped">
              Unmapped SKUs
              {unmappedSkus.length > 0 && (
                <Badge variant="destructive" className="ml-2">{unmappedSkus.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="AMAZON">Amazon</SelectItem>
                <SelectItem value="FLIPKART">Flipkart</SelectItem>
                <SelectItem value="SHOPIFY">Shopify</SelectItem>
                <SelectItem value="MYNTRA">Myntra</SelectItem>
                <SelectItem value="AJIO">Ajio</SelectItem>
                <SelectItem value="MEESHO">Meesho</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SKU Mappings</CardTitle>
              <CardDescription>
                Map your internal SKUs to marketplace-specific product identifiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : mappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No mappings found</p>
                  <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Mapping
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Internal SKU</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Marketplace SKU</TableHead>
                      <TableHead>Connection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sync</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{mapping.skuCode}</p>
                            <p className="text-sm text-muted-foreground">{mapping.skuName}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getChannelBadge(mapping.channel)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm">{mapping.marketplaceSku}</p>
                            {mapping.marketplaceSkuName && (
                              <p className="text-sm text-muted-foreground">{mapping.marketplaceSkuName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{mapping.connectionName}</TableCell>
                        <TableCell>{getStatusBadge(mapping.listingStatus)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSyncEnabled(mapping)}
                            className={mapping.syncEnabled ? "text-green-600" : "text-gray-400"}
                          >
                            {mapping.syncEnabled ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mapping.lastSyncedAt
                            ? new Date(mapping.lastSyncedAt).toLocaleString()
                            : "Never"
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                ...
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/channels/sku-mapping/${mapping.id}`)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedMapping(mapping);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unmapped" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Unmapped SKUs
              </CardTitle>
              <CardDescription>
                These SKUs do not have marketplace mappings and cannot be synced
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : unmappedSkus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">All SKUs are mapped</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Code</TableHead>
                      <TableHead>SKU Name</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmappedSkus.map((sku) => (
                      <TableRow key={sku.skuId}>
                        <TableCell className="font-medium">{sku.skuCode}</TableCell>
                        <TableCell className="text-muted-foreground">{sku.skuName}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setNewMapping({ ...newMapping, skuId: sku.skuId });
                              setShowCreateDialog(true);
                            }}
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Map
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Mapping Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SKU Mapping</DialogTitle>
            <DialogDescription>
              Map an internal SKU to a marketplace product identifier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Internal SKU ID *</Label>
              <Input
                placeholder="Enter SKU ID or search"
                value={newMapping.skuId}
                onChange={(e) => setNewMapping({ ...newMapping, skuId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Marketplace Connection *</Label>
              <Select
                value={newMapping.connectionId}
                onValueChange={(value) => setNewMapping({ ...newMapping, connectionId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.connectionName} ({conn.marketplace})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marketplace SKU *</Label>
              <Input
                placeholder="ASIN, FSN, Style ID, etc."
                value={newMapping.marketplaceSku}
                onChange={(e) => setNewMapping({ ...newMapping, marketplaceSku: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Marketplace SKU Name (Optional)</Label>
              <Input
                placeholder="Product name on marketplace"
                value={newMapping.marketplaceSkuName}
                onChange={(e) => setNewMapping({ ...newMapping, marketplaceSkuName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMapping} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SKU Mapping</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this mapping? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedMapping && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Internal SKU</span>
                <span className="font-medium">{selectedMapping.skuCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Channel</span>
                {getChannelBadge(selectedMapping.channel)}
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Marketplace SKU</span>
                <span className="font-mono text-sm">{selectedMapping.marketplaceSku}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMapping} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
