"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Search,
  Filter,
  X,
  MoreHorizontal,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Package,
  Clock,
  ClipboardList,
  UserPlus,
  RefreshCw,
  ScanLine,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface PicklistItem {
  id: string;
  requiredQty: number;
  pickedQty: number;
  sku: {
    id: string;
    code: string;
    name: string;
  };
  bin: {
    id: string;
    code: string;
    zone: {
      code: string;
      name: string;
    };
  };
}

interface Picklist {
  id: string;
  picklistNo: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  order: {
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
    location: {
      id: string;
      code: string;
      name: string;
    };
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  items: PicklistItem[];
  _count: {
    items: number;
  };
}

interface PicklistsResponse {
  picklists: Picklist[];
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
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  PROCESSING: { label: "Processing", variant: "secondary", icon: ScanLine },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PicklistPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<PicklistsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPicklists, setSelectedPicklists] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  const fetchPicklists = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (assignedToMe) params.set("assignedToMe", "true");
      params.set("page", page.toString());
      params.set("limit", "25");

      // Add status filter based on active tab
      if (activeTab !== "all") {
        params.set("status", activeTab);
      }

      const response = await fetch(`/api/v1/picklists?${params}`);
      if (!response.ok) throw new Error("Failed to fetch picklists");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching picklists:", error);
      toast.error("Failed to load picklists");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, assignedToMe, activeTab, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPicklists();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchPicklists]);

  async function handleAction(picklistId: string, action: string) {
    try {
      const response = await fetch(`/api/v1/picklists/${picklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Picklist ${action}ed successfully`);
        fetchPicklists();
      } else {
        toast.error(result.error || `Failed to ${action} picklist`);
      }
    } catch (error) {
      console.error(`Error ${action}ing picklist:`, error);
      toast.error(`Failed to ${action} picklist`);
    }
  }

  async function handleAssignToMe(picklistId: string) {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/v1/picklists/${picklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", assignedToId: session.user.id }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Picklist assigned to you");
        fetchPicklists();
      } else {
        toast.error(result.error || "Failed to assign picklist");
      }
    } catch (error) {
      console.error("Error assigning picklist:", error);
      toast.error("Failed to assign picklist");
    }
  }

  function togglePicklistSelection(picklistId: string) {
    setSelectedPicklists((prev) =>
      prev.includes(picklistId)
        ? prev.filter((id) => id !== picklistId)
        : [...prev, picklistId]
    );
  }

  function toggleAllPicklists() {
    if (!data?.picklists) return;

    if (selectedPicklists.length === data.picklists.length) {
      setSelectedPicklists([]);
    } else {
      setSelectedPicklists(data.picklists.map((p) => p.id));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setAssignedToMe(false);
    setActiveTab("all");
    setPage(1);
  }

  function getPickProgress(picklist: Picklist) {
    const totalRequired = picklist.items.reduce((sum, item) => sum + item.requiredQty, 0);
    const totalPicked = picklist.items.reduce((sum, item) => sum + item.pickedQty, 0);
    return totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0;
  }

  const hasFilters = search || statusFilter || assignedToMe;

  const getTabCount = (tabValue: string) => {
    if (!data?.statusCounts) return 0;
    if (tabValue === "all") return data.total;
    return data.statusCounts[tabValue] || 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Picklists</h1>
          <p className="text-muted-foreground">
            Manage picking tasks for orders
          </p>
        </div>
        <Button variant="outline" onClick={fetchPicklists}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
                placeholder="Search by picklist no or order no..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={assignedToMe ? "default" : "outline"}
                size="sm"
                onClick={() => setAssignedToMe(!assignedToMe)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assigned to Me
              </Button>

              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Picklists Table */}
      <Card>
        <CardHeader>
          <CardTitle>Picklist Queue</CardTitle>
          <CardDescription>
            {data?.total || 0} picklists found
            {hasFilters && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : !data?.picklists.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? "No picklists match your filters" : "No picklists found"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Generate picklists from allocated orders
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
                          data.picklists.length > 0 &&
                          selectedPicklists.length === data.picklists.length
                        }
                        onCheckedChange={toggleAllPicklists}
                      />
                    </TableHead>
                    <TableHead>Picklist</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.picklists.map((picklist) => {
                    const statusInfo = statusConfig[picklist.status] || {
                      label: picklist.status,
                      variant: "outline" as const,
                      icon: Clock,
                    };
                    const progress = getPickProgress(picklist);

                    return (
                      <TableRow key={picklist.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPicklists.includes(picklist.id)}
                            onCheckedChange={() => togglePicklistSelection(picklist.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => router.push(`/wms/picklist/${picklist.id}`)}
                            className="font-medium text-primary hover:underline"
                          >
                            {picklist.picklistNo}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <button
                              onClick={() => router.push(`/orders/${picklist.order.id}`)}
                              className="font-medium hover:underline"
                            >
                              {picklist.order.orderNo}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {picklist.order.customerName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {picklist._count.items} items
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {picklist.items.reduce((s, i) => s + i.requiredQty, 0)} units
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
                          {picklist.assignedTo ? (
                            <span className="text-sm">{picklist.assignedTo.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            <statusInfo.icon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(picklist.createdAt), "dd MMM yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(picklist.createdAt), "HH:mm")}
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
                                onClick={() => router.push(`/wms/picklist/${picklist.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>

                              {picklist.status === "PENDING" && (
                                <>
                                  {!picklist.assignedTo && (
                                    <DropdownMenuItem
                                      onClick={() => handleAssignToMe(picklist.id)}
                                    >
                                      <UserPlus className="mr-2 h-4 w-4" />
                                      Assign to Me
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleAction(picklist.id, "start")}
                                  >
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Picking
                                  </DropdownMenuItem>
                                </>
                              )}

                              {picklist.status === "PROCESSING" && (
                                <DropdownMenuItem
                                  onClick={() => router.push(`/wms/picklist/${picklist.id}`)}
                                >
                                  <ScanLine className="mr-2 h-4 w-4" />
                                  Continue Picking
                                </DropdownMenuItem>
                              )}

                              {["PENDING", "PROCESSING"].includes(picklist.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleAction(picklist.id, "cancel")}
                                    className="text-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel Picklist
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
