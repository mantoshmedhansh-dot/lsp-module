"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface SkuMappingDetail {
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
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
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

const statusOptions = ["ACTIVE", "INACTIVE", "BLOCKED", "PENDING"];

export default function EditSkuMappingPage() {
  const router = useRouter();
  const params = useParams();
  const mappingId = params.id as string;

  const [mapping, setMapping] = useState<SkuMappingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    marketplaceSku: "",
    marketplaceSkuName: "",
    listingStatus: "ACTIVE",
    syncEnabled: true,
  });

  const fetchMapping = useCallback(async () => {
    if (!mappingId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/sku-mappings/${mappingId}`);
      if (response.ok) {
        const data = await response.json();
        setMapping(data);
        setFormData({
          marketplaceSku: data.marketplaceSku || "",
          marketplaceSkuName: data.marketplaceSkuName || "",
          listingStatus: data.listingStatus || "ACTIVE",
          syncEnabled: data.syncEnabled ?? true,
        });
      } else if (response.status === 404) {
        toast.error("Mapping not found");
        router.push("/channels/sku-mapping");
      }
    } catch (error) {
      console.error("Error fetching mapping:", error);
      toast.error("Failed to load mapping");
    } finally {
      setIsLoading(false);
    }
  }, [mappingId, router]);

  useEffect(() => {
    fetchMapping();
  }, [fetchMapping]);

  const handleSave = async () => {
    if (!formData.marketplaceSku) {
      toast.error("Marketplace SKU is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/sku-mappings/${mappingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplaceSku: formData.marketplaceSku,
          marketplaceSkuName: formData.marketplaceSkuName || null,
          listingStatus: formData.listingStatus,
          syncEnabled: formData.syncEnabled,
        }),
      });

      if (response.ok) {
        toast.success("Mapping updated successfully");
        fetchMapping();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update mapping");
      }
    } catch (error) {
      toast.error("Failed to update mapping");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/sku-mappings/${mappingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Mapping deleted successfully");
        router.push("/channels/sku-mapping");
      } else {
        toast.error("Failed to delete mapping");
      }
    } catch (error) {
      toast.error("Failed to delete mapping");
    } finally {
      setIsSaving(false);
      setShowDeleteDialog(false);
    }
  };

  const getChannelBadge = (channel: string) => {
    return (
      <Badge className={channelColors[channel] || "bg-gray-100 text-gray-800"}>
        {channel}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Mapping not found</p>
        <Button className="mt-4" onClick={() => router.push("/channels/sku-mapping")}>
          Back to Mappings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/channels/sku-mapping")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit SKU Mapping</h1>
            <p className="text-muted-foreground">
              {mapping.skuCode} to {mapping.channel}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Internal SKU Info (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Internal SKU</CardTitle>
            <CardDescription>Read-only information about the source SKU</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">SKU Code</Label>
              <p className="font-medium text-lg">{mapping.skuCode}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">SKU Name</Label>
              <p className="text-sm">{mapping.skuName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">SKU ID</Label>
              <p className="font-mono text-xs text-muted-foreground">{mapping.skuId}</p>
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Connection Info (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Marketplace Connection</CardTitle>
            <CardDescription>Target marketplace for this mapping</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Channel</Label>
              <div>{getChannelBadge(mapping.channel)}</div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Connection Name</Label>
              <p className="font-medium">{mapping.connectionName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Connection ID</Label>
              <p className="font-mono text-xs text-muted-foreground">{mapping.connectionId}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editable Mapping Details */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Configuration</CardTitle>
          <CardDescription>Configure the marketplace SKU mapping and sync settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="marketplaceSku">Marketplace SKU *</Label>
              <Input
                id="marketplaceSku"
                placeholder="ASIN, FSN, Style ID, etc."
                value={formData.marketplaceSku}
                onChange={(e) => setFormData({ ...formData, marketplaceSku: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The product identifier used on the marketplace (e.g., Amazon ASIN, Flipkart FSN)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketplaceSkuName">Marketplace Product Name</Label>
              <Input
                id="marketplaceSkuName"
                placeholder="Product title on marketplace"
                value={formData.marketplaceSkuName}
                onChange={(e) => setFormData({ ...formData, marketplaceSkuName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Optional: The product name as it appears on the marketplace
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="listingStatus">Listing Status</Label>
              <Select
                value={formData.listingStatus}
                onValueChange={(value) => setFormData({ ...formData, listingStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Current status of the listing on the marketplace
              </p>
            </div>

            <div className="space-y-2">
              <Label>Inventory Sync</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="syncEnabled"
                  checked={formData.syncEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, syncEnabled: checked })}
                />
                <Label htmlFor="syncEnabled" className="cursor-pointer">
                  {formData.syncEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable to automatically sync inventory to this marketplace
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sync Status
          </CardTitle>
          <CardDescription>Last synchronization information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Synced</Label>
              <p className="font-medium">
                {mapping.lastSyncedAt
                  ? new Date(mapping.lastSyncedAt).toLocaleString()
                  : "Never"
                }
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Sync Status</Label>
              <div className="flex items-center gap-2">
                {mapping.lastSyncStatus === "SUCCESS" ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Success</span>
                  </>
                ) : mapping.lastSyncStatus === "FAILED" ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">Failed</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Error</Label>
              <p className="text-sm text-red-600">
                {mapping.lastSyncError || "-"}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Created At</Label>
              <p className="text-sm">{new Date(mapping.createdAt).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Last Updated</Label>
              <p className="text-sm">{new Date(mapping.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SKU Mapping</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this mapping? This will stop inventory sync for this product on {mapping.channel}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Internal SKU</span>
              <span className="font-medium">{mapping.skuCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Channel</span>
              {getChannelBadge(mapping.channel)}
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Marketplace SKU</span>
              <span className="font-mono text-sm">{mapping.marketplaceSku}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? "Deleting..." : "Delete Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
