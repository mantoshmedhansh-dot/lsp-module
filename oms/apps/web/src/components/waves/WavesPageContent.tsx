"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Plus,
  Search,
  X,
  MoreHorizontal,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Layers,
  Package,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Wave {
  id: string;
  waveNo: string;
  name: string;
  status: string;
  type?: string;
  waveType?: string;
  priority: number;
  createdAt: string;
  releasedAt: string | null;
  completedAt: string | null;
  location?: {
    id: string;
    code: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  _count?: {
    orders: number;
    items: number;
  };
  stats?: {
    totalOrders: number;
    totalItems: number;
    pickedItems: number;
    completionPercentage: number;
  };
}

interface WavesResponse {
  waves: Wave[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<string, number>;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  DRAFT: { label: "Draft", variant: "outline", icon: Clock },
  PLANNED: { label: "Planned", variant: "secondary", icon: Layers },
  RELEASED: { label: "Released", variant: "secondary", icon: Play },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Zap },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const waveTypeConfig: Record<string, { label: string; description: string }> = {
  BATCH_PICK: { label: "Batch Pick", description: "Pick multiple orders together" },
  ZONE_PICK: { label: "Zone Pick", description: "Pick by warehouse zone" },
  CLUSTER_PICK: { label: "Cluster Pick", description: "Pick by geographic cluster" },
  PRIORITY_PICK: { label: "Priority Pick", description: "Pick by order priority" },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PLANNED", label: "Planned" },
  { value: "RELEASED", label: "Released" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
];

export interface WavesPageConfig {
  title: string;
  description: string;
  basePath: string;
}

interface WavesPageContentProps {
  config: WavesPageConfig;
}

export default function WavesPageContent({ config }: WavesPageContentProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<WavesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWaves, setSelectedWaves] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  // Create wave form - use 'type' to match backend model
  const [newWave, setNewWave] = useState({
    name: "",
    type: "BATCH_PICK",
    priority: 1,
  });

  const fetchWaves = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("page", page.toString());
      params.set("limit", "25");

      const response = await fetch(`/api/v1/waves?${params}`);
      if (!response.ok) throw new Error("Failed to fetch waves");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching waves:", error);
      toast.error("Failed to load waves");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchWaves();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchWaves]);

  async function handleCreateWave() {
    try {
      const response = await fetch("/api/v1/waves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWave),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Wave created successfully");
        setIsCreateDialogOpen(false);
        setNewWave({ name: "", type: "BATCH_PICK", priority: 1 });
        fetchWaves();
      } else {
        const errorMsg = result.detail
          ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
          : result.error || "Failed to create wave";
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Error creating wave:", error);
      toast.error("Failed to create wave");
    }
  }

  async function handleAction(waveId: string, action: string) {
    try {
      const response = await fetch(`/api/v1/waves/${waveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Wave ${action}d successfully`);
        fetchWaves();
      } else {
        toast.error(result.error || `Failed to ${action} wave`);
      }
    } catch (error) {
      console.error(`Error ${action}ing wave:`, error);
      toast.error(`Failed to ${action} wave`);
    }
  }

  function toggleWaveSelection(waveId: string) {
    setSelectedWaves((prev) =>
      prev.includes(waveId)
        ? prev.filter((id) => id !== waveId)
        : [...prev, waveId]
    );
  }

  function toggleAllWaves() {
    if (!data?.waves) return;

    if (selectedWaves.length === data.waves.length) {
      setSelectedWaves([]);
    } else {
      setSelectedWaves(data.waves.map((w) => w.id));
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveTab("all");
    setPage(1);
  }

  const hasFilters = search || activeTab !== "all";

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  // Helper to get wave type - handle both field names
  const getWaveType = (wave: Wave): string => {
    return wave.waveType || wave.type || "BATCH_PICK";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchWaves}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Wave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Wave</DialogTitle>
                <DialogDescription>
                  Create a new picking wave to batch orders together
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Wave Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Morning Batch - Zone A"
                    value={newWave.name}
                    onChange={(e) =>
                      setNewWave((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Wave Type</Label>
                  <Select
                    value={newWave.type}
                    onValueChange={(value) =>
                      setNewWave((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(waveTypeConfig).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <div>
                            <div>{cfg.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {cfg.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority (1-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={1}
                    max={10}
                    value={newWave.priority}
                    onChange={(e) =>
                      setNewWave((prev) => ({
                        ...prev,
                        priority: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateWave}>Create Wave</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
              {tab.label}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {getTabCount(tab.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by wave no or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Waves Table */}
      <Card>
        <CardHeader>
          <CardTitle>Wave List</CardTitle>
          <CardDescription>
            {data?.total || 0} waves found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.waves?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No waves match your filters" : "No waves found"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a wave to batch orders for picking
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          data.waves.length > 0 &&
                          selectedWaves.length === data.waves.length
                        }
                        onCheckedChange={toggleAllWaves}
                      />
                    </TableHead>
                    <TableHead>Wave</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.waves.map((wave) => {
                    const statusInfo = statusConfig[wave.status] || {
                      label: wave.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const waveTypeValue = getWaveType(wave);
                    const waveTypeCfg = waveTypeConfig[waveTypeValue] || {
                      label: waveTypeValue,
                      description: "",
                    };
                    const progress = wave.stats?.completionPercentage || 0;

                    return (
                      <TableRow key={wave.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedWaves.includes(wave.id)}
                            onCheckedChange={() => toggleWaveSelection(wave.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <button
                              onClick={() => router.push(`${config.basePath}/${wave.id}`)}
                              className="font-medium text-primary hover:underline"
                            >
                              {wave.waveNo}
                            </button>
                            {wave.name && (
                              <p className="text-xs text-muted-foreground">
                                {wave.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{waveTypeCfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {wave._count?.orders || wave.stats?.totalOrders || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {wave._count?.items || wave.stats?.totalItems || 0} items
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">
                                {progress}%
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(wave.createdAt), "dd MMM yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {wave.createdBy?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`${config.basePath}/${wave.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>

                              {wave.status === "DRAFT" && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(wave.id, "plan")}
                                >
                                  <Layers className="mr-2 h-4 w-4" />
                                  Plan Wave
                                </DropdownMenuItem>
                              )}

                              {wave.status === "PLANNED" && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(wave.id, "release")}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Release Wave
                                </DropdownMenuItem>
                              )}

                              {wave.status === "RELEASED" && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(wave.id, "start")}
                                >
                                  <Zap className="mr-2 h-4 w-4" />
                                  Start Picking
                                </DropdownMenuItem>
                              )}

                              {["DRAFT", "PLANNED"].includes(wave.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleAction(wave.id, "cancel")}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Wave
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
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
                      onClick={() =>
                        setPage((p) => Math.min(data.totalPages, p + 1))
                      }
                      disabled={page === data.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
