"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Truck,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react";

interface ChannelConfig {
  id: string;
  channel: string;
  name: string;
  isActive: boolean;
  apiSyncStatus?: string;
  syncFrequency?: string;
  webhookUrl?: string;
  location?: { id: string; name: string };
}

interface TransporterConfig {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  apiEndpoint?: string;
  hasCredentials: boolean;
}

interface Location {
  id: string;
  name: string;
  code: string;
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("channels");
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [isTransporterDialogOpen, setIsTransporterDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);
  const [editingTransporter, setEditingTransporter] = useState<TransporterConfig | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Channel form state
  const [channelForm, setChannelForm] = useState({
    channel: "SHOPIFY",
    name: "",
    locationId: "",
    syncFrequency: "HOURLY",
    credentials: {
      shopDomain: "",
      accessToken: "",
      apiKey: "",
      apiSecret: "",
    },
  });

  // Transporter form state
  const [transporterForm, setTransporterForm] = useState({
    name: "",
    code: "",
    apiEndpoint: "",
    credentials: {
      email: "",
      password: "",
      apiKey: "",
      clientId: "",
    },
  });

  // Fetch channel configs
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ["channel-configs"],
    queryFn: async () => {
      const res = await fetch("/api/v1/channels?limit=50");
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
  });

  // Fetch transporters
  const { data: transportersData, isLoading: transportersLoading } = useQuery({
    queryKey: ["transporters"],
    queryFn: async () => {
      const res = await fetch("/api/v1/transporters?limit=50");
      if (!res.ok) throw new Error("Failed to fetch transporters");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Save channel mutation
  const saveChannelMutation = useMutation({
    mutationFn: async (data: typeof channelForm & { id?: string }) => {
      const url = data.id ? `/api/v1/channels/${data.id}` : "/api/v1/channels";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save channel");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Channel configuration saved" });
      setIsChannelDialogOpen(false);
      setEditingChannel(null);
      queryClient.invalidateQueries({ queryKey: ["channel-configs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save transporter mutation
  const saveTransporterMutation = useMutation({
    mutationFn: async (data: typeof transporterForm & { id?: string }) => {
      const url = data.id ? `/api/v1/transporters/${data.id}` : "/api/v1/transporters";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          apiCredentials: data.credentials,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save transporter");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Transporter configuration saved" });
      setIsTransporterDialogOpen(false);
      setEditingTransporter(null);
      queryClient.invalidateQueries({ queryKey: ["transporters"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (channelConfigId: string) => {
      const res = await fetch("/api/v1/integrations/channels/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelConfigId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync completed",
        description: `${data.synced} orders synced`,
      });
      queryClient.invalidateQueries({ queryKey: ["channel-configs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const channels: ChannelConfig[] = channelsData?.data || [];
  const transporters: TransporterConfig[] = transportersData?.data || [];
  const locations: Location[] = locationsData?.data || [];

  const channelIcons: Record<string, string> = {
    SHOPIFY: "🛒",
    AMAZON: "📦",
    FLIPKART: "🏪",
    MYNTRA: "👔",
    AJIO: "👗",
    MEESHO: "🎁",
    WEBSITE: "🌐",
  };

  const transporterIcons: Record<string, string> = {
    SHIPROCKET: "🚀",
    DELHIVERY: "📮",
    BLUEDART: "💙",
    DTDC: "📬",
    ECOM: "📦",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect marketplaces and shipping partners
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="channels">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Sales Channels
          </TabsTrigger>
          <TabsTrigger value="transporters">
            <Truck className="h-4 w-4 mr-2" />
            Transporters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsChannelDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </div>

          {channelsLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : channels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No channels configured</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((channel) => (
                <Card key={channel.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {channelIcons[channel.channel] || "🔗"}
                      </span>
                      <div>
                        <CardTitle className="text-lg">{channel.name}</CardTitle>
                        <CardDescription>{channel.channel}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={
                        channel.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {channel.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{channel.location?.name || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sync</span>
                        <span>{channel.syncFrequency || "Manual"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Sync</span>
                        <span className="flex items-center gap-1">
                          {channel.apiSyncStatus === "SUCCESS" ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : channel.apiSyncStatus === "FAILED" ? (
                            <XCircle className="h-3 w-3 text-red-600" />
                          ) : null}
                          {channel.apiSyncStatus || "Never"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingChannel(channel);
                          setIsChannelDialogOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate(channel.id)}
                        disabled={!channel.isActive || syncMutation.isPending}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Sync Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transporters" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsTransporterDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transporter
            </Button>
          </div>

          {transportersLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : transporters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transporters configured</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transporters.map((transporter) => (
                <Card key={transporter.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {transporterIcons[transporter.code.toUpperCase()] || "🚚"}
                      </span>
                      <div>
                        <CardTitle className="text-lg">{transporter.name}</CardTitle>
                        <CardDescription>{transporter.code}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={
                        transporter.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {transporter.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">API</span>
                        <span>
                          {transporter.apiEndpoint ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credentials</span>
                        <span>
                          {transporter.hasCredentials ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingTransporter(transporter);
                          setIsTransporterDialogOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Channel Dialog */}
      <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "Configure Channel" : "Add Channel"}
            </DialogTitle>
            <DialogDescription>
              Connect a marketplace or sales channel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Channel Type</Label>
              <Select
                value={channelForm.channel}
                onValueChange={(v) =>
                  setChannelForm((p) => ({ ...p, channel: v }))
                }
                disabled={!!editingChannel}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHOPIFY">Shopify</SelectItem>
                  <SelectItem value="AMAZON">Amazon</SelectItem>
                  <SelectItem value="FLIPKART">Flipkart</SelectItem>
                  <SelectItem value="MYNTRA">Myntra</SelectItem>
                  <SelectItem value="MEESHO">Meesho</SelectItem>
                  <SelectItem value="WEBSITE">Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={channelForm.name}
                onChange={(e) =>
                  setChannelForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g., My Shopify Store"
              />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Select
                value={channelForm.locationId}
                onValueChange={(v) =>
                  setChannelForm((p) => ({ ...p, locationId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sync Frequency</Label>
              <Select
                value={channelForm.syncFrequency}
                onValueChange={(v) =>
                  setChannelForm((p) => ({ ...p, syncFrequency: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="REALTIME">Real-time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {channelForm.channel === "SHOPIFY" && (
              <>
                <div className="grid gap-2">
                  <Label>Shop Domain</Label>
                  <Input
                    value={channelForm.credentials.shopDomain}
                    onChange={(e) =>
                      setChannelForm((p) => ({
                        ...p,
                        credentials: { ...p.credentials, shopDomain: e.target.value },
                      }))
                    }
                    placeholder="mystore.myshopify.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Access Token</Label>
                  <Input
                    type="password"
                    value={channelForm.credentials.accessToken}
                    onChange={(e) =>
                      setChannelForm((p) => ({
                        ...p,
                        credentials: { ...p.credentials, accessToken: e.target.value },
                      }))
                    }
                    placeholder="shpat_xxxxx"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsChannelDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                saveChannelMutation.mutate({
                  ...channelForm,
                  id: editingChannel?.id,
                })
              }
              disabled={!channelForm.name || saveChannelMutation.isPending}
            >
              {saveChannelMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transporter Dialog */}
      <Dialog
        open={isTransporterDialogOpen}
        onOpenChange={setIsTransporterDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTransporter ? "Configure Transporter" : "Add Transporter"}
            </DialogTitle>
            <DialogDescription>
              Connect a shipping partner API
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={transporterForm.name}
                  onChange={(e) =>
                    setTransporterForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g., Shiprocket"
                />
              </div>
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input
                  value={transporterForm.code}
                  onChange={(e) =>
                    setTransporterForm((p) => ({
                      ...p,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g., SHIPROCKET"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>API Endpoint</Label>
              <Input
                value={transporterForm.apiEndpoint}
                onChange={(e) =>
                  setTransporterForm((p) => ({
                    ...p,
                    apiEndpoint: e.target.value,
                  }))
                }
                placeholder="https://apiv2.shiprocket.in/v1/external"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email / Client ID</Label>
                <Input
                  value={transporterForm.credentials.email}
                  onChange={(e) =>
                    setTransporterForm((p) => ({
                      ...p,
                      credentials: { ...p.credentials, email: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Password / Secret</Label>
                <Input
                  type="password"
                  value={transporterForm.credentials.password}
                  onChange={(e) =>
                    setTransporterForm((p) => ({
                      ...p,
                      credentials: { ...p.credentials, password: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>API Key (if applicable)</Label>
              <Input
                type="password"
                value={transporterForm.credentials.apiKey}
                onChange={(e) =>
                  setTransporterForm((p) => ({
                    ...p,
                    credentials: { ...p.credentials, apiKey: e.target.value },
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTransporterDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                saveTransporterMutation.mutate({
                  ...transporterForm,
                  id: editingTransporter?.id,
                })
              }
              disabled={
                !transporterForm.name ||
                !transporterForm.code ||
                saveTransporterMutation.isPending
              }
            >
              {saveTransporterMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
