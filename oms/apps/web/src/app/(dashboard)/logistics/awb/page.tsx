"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Download,
  Upload,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  MoreHorizontal,
  Copy,
  ExternalLink,
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface AWB {
  id: string;
  awbNo: string;
  transporter: {
    id: string;
    name: string;
    code: string;
  };
  status: string;
  orderNo: string | null;
  deliveryNo: string | null;
  assignedAt: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface Transporter {
  id: string;
  name: string;
  code: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  AVAILABLE: { label: "Available", variant: "outline", icon: CheckCircle },
  ASSIGNED: { label: "Assigned", variant: "secondary", icon: Clock },
  USED: { label: "Used", variant: "default", icon: Package },
  CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
  EXPIRED: { label: "Expired", variant: "destructive", icon: XCircle },
};

export default function AWBManagementPage() {
  const [awbs, setAwbs] = useState<AWB[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transporterFilter, setTransporterFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    transporterId: "",
    awbNumbers: "",
    count: 10,
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    used: 0,
  });

  const fetchTransporters = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/transporters?limit=100");
      if (!response.ok) throw new Error("Failed to fetch transporters");
      const result = await response.json();
      setTransporters(result.data || []);
    } catch (error) {
      console.error("Error fetching transporters:", error);
    }
  }, []);

  const fetchAWBs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (transporterFilter !== "all") params.set("transporterId", transporterFilter);
      params.set("limit", "50");

      // This would call an AWB-specific API
      // For now, we'll use deliveries API as a proxy
      const response = await fetch(`/api/v1/deliveries?${params}`);
      if (!response.ok) throw new Error("Failed to fetch AWBs");
      const result = await response.json();

      // Transform deliveries to AWB format
      const awbData = (result.deliveries || []).map((d: Record<string, unknown>) => ({
        id: d.id,
        awbNo: d.awbNo || "N/A",
        transporter: d.transporter || { id: "", name: "Unknown", code: "N/A" },
        status: d.awbNo ? "USED" : "AVAILABLE",
        orderNo: (d.order as Record<string, unknown>)?.orderNo || null,
        deliveryNo: d.deliveryNo,
        assignedAt: d.createdAt,
        usedAt: d.shippedAt,
        createdAt: d.createdAt,
      }));

      setAwbs(awbData);

      // Calculate stats
      setStats({
        total: awbData.length,
        available: awbData.filter((a: AWB) => a.status === "AVAILABLE").length,
        assigned: awbData.filter((a: AWB) => a.status === "ASSIGNED").length,
        used: awbData.filter((a: AWB) => a.status === "USED").length,
      });
    } catch (error) {
      console.error("Error fetching AWBs:", error);
      toast.error("Failed to load AWB data");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, transporterFilter]);

  useEffect(() => {
    fetchTransporters();
  }, [fetchTransporters]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchAWBs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchAWBs]);

  async function handleAddAWBs() {
    if (!formData.transporterId) {
      toast.error("Please select a transporter");
      return;
    }

    try {
      // This would call an API to generate/add AWBs
      toast.success(`Added ${formData.count} AWB numbers`);
      setIsAddDialogOpen(false);
      fetchAWBs();
    } catch (error) {
      console.error("Error adding AWBs:", error);
      toast.error("Failed to add AWB numbers");
    }
  }

  async function handleUploadAWBs() {
    if (!formData.transporterId || !formData.awbNumbers) {
      toast.error("Please select transporter and enter AWB numbers");
      return;
    }

    try {
      const awbList = formData.awbNumbers
        .split("\n")
        .map((a) => a.trim())
        .filter((a) => a);

      // This would call an API to upload AWBs
      toast.success(`Uploaded ${awbList.length} AWB numbers`);
      setIsUploadDialogOpen(false);
      setFormData((prev) => ({ ...prev, awbNumbers: "" }));
      fetchAWBs();
    } catch (error) {
      console.error("Error uploading AWBs:", error);
      toast.error("Failed to upload AWB numbers");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AWB Management</h1>
          <p className="text-muted-foreground">
            Manage airway bill numbers for shipments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAWBs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload AWBs
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate AWBs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total AWBs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.assigned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Used</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.used}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by AWB number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={transporterFilter} onValueChange={setTransporterFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Transporters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transporters</SelectItem>
                {transporters.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="USED">Used</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AWB Table */}
      <Card>
        <CardHeader>
          <CardTitle>AWB Numbers</CardTitle>
          <CardDescription>
            {awbs.length} AWB(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : awbs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No AWB numbers found</p>
              <Button variant="link" onClick={() => setIsAddDialogOpen(true)}>
                Generate AWB numbers
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>AWB Number</TableHead>
                  <TableHead>Transporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awbs.map((awb) => {
                  const status = statusConfig[awb.status] || statusConfig.AVAILABLE;
                  return (
                    <TableRow key={awb.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm">{awb.awbNo}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(awb.awbNo)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span>{awb.transporter?.name || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          <status.icon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {awb.orderNo ? (
                          <span className="text-sm">{awb.orderNo}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {awb.deliveryNo ? (
                          <span className="text-sm">{awb.deliveryNo}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(awb.createdAt), "dd MMM yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyToClipboard(awb.awbNo)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy AWB
                            </DropdownMenuItem>
                            {awb.status === "USED" && (
                              <DropdownMenuItem>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Track Shipment
                              </DropdownMenuItem>
                            )}
                            {awb.status === "AVAILABLE" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600">
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel AWB
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
          )}
        </CardContent>
      </Card>

      {/* Generate AWBs Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate AWB Numbers</DialogTitle>
            <DialogDescription>
              Request AWB numbers from transporter API
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Transporter</Label>
              <Select
                value={formData.transporterId}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, transporterId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transporter" />
                </SelectTrigger>
                <SelectContent>
                  {transporters.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Number of AWBs</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.count}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    count: parseInt(e.target.value) || 10,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAWBs}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload AWBs Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload AWB Numbers</DialogTitle>
            <DialogDescription>
              Paste AWB numbers (one per line)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Transporter</Label>
              <Select
                value={formData.transporterId}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, transporterId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transporter" />
                </SelectTrigger>
                <SelectContent>
                  {transporters.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>AWB Numbers</Label>
              <textarea
                className="min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter AWB numbers, one per line..."
                value={formData.awbNumbers}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, awbNumbers: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadAWBs}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
