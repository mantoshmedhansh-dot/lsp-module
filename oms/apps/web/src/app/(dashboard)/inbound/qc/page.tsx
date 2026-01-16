"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Search,
  RefreshCw,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  MoreHorizontal,
  Eye,
  Play,
  Filter,
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface InboundQC {
  id: string;
  inboundNo: string;
  poNumber: string;
  vendor: {
    id: string;
    name: string;
  };
  status: string;
  totalItems: number;
  inspectedItems: number;
  passedItems: number;
  failedItems: number;
  qcStartedAt: string | null;
  qcCompletedAt: string | null;
  assignedTo: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  items: {
    id: string;
    sku: { code: string; name: string };
    receivedQty: number;
    inspectedQty: number;
    passedQty: number;
    failedQty: number;
    status: string;
  }[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "secondary", icon: ClipboardCheck },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle },
  PARTIAL: { label: "Partial Pass", variant: "secondary", icon: AlertTriangle },
};

const statusTabs = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

export default function InboundQCPage() {
  const [qcItems, setQcItems] = useState<InboundQC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isQCDialogOpen, setIsQCDialogOpen] = useState(false);
  const [selectedQC, setSelectedQC] = useState<InboundQC | null>(null);

  const [qcForm, setQcForm] = useState({
    inspectedQty: 0,
    passedQty: 0,
    failedQty: 0,
    remarks: "",
    defectType: "",
  });

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    passRate: 0,
  });

  const fetchQCItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeTab !== "all") params.set("status", activeTab);
      params.set("limit", "50");

      // Fetch from inbounds API
      const response = await fetch(`/api/v1/inbounds?${params}`);
      if (!response.ok) throw new Error("Failed to fetch QC items");
      const result = await response.json();

      // Transform inbounds to QC format
      const qcData: InboundQC[] = (result.inbounds || []).map((inbound: Record<string, unknown>) => ({
        id: inbound.id,
        inboundNo: inbound.inboundNo,
        poNumber: (inbound.purchaseOrder as Record<string, unknown>)?.poNumber || "N/A",
        vendor: inbound.vendor || { id: "", name: "Unknown" },
        status: inbound.qcStatus || "PENDING",
        totalItems: (inbound.items as unknown[])?.length || 0,
        inspectedItems: 0,
        passedItems: 0,
        failedItems: 0,
        qcStartedAt: null,
        qcCompletedAt: null,
        assignedTo: null,
        createdAt: inbound.createdAt as string,
        items: (inbound.items as Record<string, unknown>[])?.map((item: Record<string, unknown>) => ({
          id: item.id as string,
          sku: item.sku as { code: string; name: string },
          receivedQty: item.receivedQty as number,
          inspectedQty: 0,
          passedQty: 0,
          failedQty: 0,
          status: "PENDING",
        })) || [],
      }));

      setQcItems(qcData);

      // Calculate stats
      const pending = qcData.filter((q: InboundQC) => q.status === "PENDING").length;
      const inProgress = qcData.filter((q: InboundQC) => q.status === "IN_PROGRESS").length;
      const completed = qcData.filter((q: InboundQC) => q.status === "COMPLETED").length;
      const totalPassed = qcData.reduce((sum: number, q: InboundQC) => sum + q.passedItems, 0);
      const totalInspected = qcData.reduce((sum: number, q: InboundQC) => sum + q.inspectedItems, 0);

      setStats({
        total: qcData.length,
        pending,
        inProgress,
        completed,
        passRate: totalInspected > 0 ? Math.round((totalPassed / totalInspected) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching QC items:", error);
      toast.error("Failed to load QC items");
    } finally {
      setIsLoading(false);
    }
  }, [search, activeTab]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchQCItems();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchQCItems]);

  function openQCDialog(qc: InboundQC) {
    setSelectedQC(qc);
    setQcForm({
      inspectedQty: 0,
      passedQty: 0,
      failedQty: 0,
      remarks: "",
      defectType: "",
    });
    setIsQCDialogOpen(true);
  }

  async function handleStartQC(qcId: string) {
    try {
      // This would call an API to start QC
      toast.success("QC process started");
      fetchQCItems();
    } catch (error) {
      console.error("Error starting QC:", error);
      toast.error("Failed to start QC");
    }
  }

  async function handleSubmitQC() {
    if (!selectedQC) return;

    try {
      // This would call an API to submit QC results
      toast.success("QC results submitted");
      setIsQCDialogOpen(false);
      fetchQCItems();
    } catch (error) {
      console.error("Error submitting QC:", error);
      toast.error("Failed to submit QC results");
    }
  }

  const getTabCount = (tabValue: string) => {
    if (tabValue === "all") return qcItems.length;
    return qcItems.filter((q) => q.status === tabValue).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbound QC</h1>
          <p className="text-muted-foreground">
            Quality check for incoming shipments
          </p>
        </div>
        <Button variant="outline" onClick={fetchQCItems}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.passRate}%</div>
          </CardContent>
        </Card>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by inbound no, PO number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* QC Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>QC Queue</CardTitle>
          <CardDescription>
            {qcItems.length} inbound(s) pending quality check
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : qcItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No items pending QC</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inbound No</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qcItems.map((qc) => {
                  const statusInfo = statusConfig[qc.status] || statusConfig.PENDING;
                  const progress = qc.totalItems > 0
                    ? Math.round((qc.inspectedItems / qc.totalItems) * 100)
                    : 0;

                  return (
                    <TableRow key={qc.id}>
                      <TableCell>
                        <span className="font-medium">{qc.inboundNo}</span>
                      </TableCell>
                      <TableCell>{qc.poNumber}</TableCell>
                      <TableCell>{qc.vendor?.name || "N/A"}</TableCell>
                      <TableCell>
                        <span className="text-sm">{qc.totalItems} SKUs</span>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {progress}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {qc.passedItems} passed / {qc.failedItems} failed
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
                        <span className="text-sm">
                          {format(new Date(qc.createdAt), "dd MMM yyyy")}
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
                            <DropdownMenuItem onClick={() => openQCDialog(qc)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {qc.status === "PENDING" && (
                              <DropdownMenuItem onClick={() => handleStartQC(qc.id)}>
                                <Play className="mr-2 h-4 w-4" />
                                Start QC
                              </DropdownMenuItem>
                            )}
                            {qc.status === "IN_PROGRESS" && (
                              <DropdownMenuItem onClick={() => openQCDialog(qc)}>
                                <ClipboardCheck className="mr-2 h-4 w-4" />
                                Continue QC
                              </DropdownMenuItem>
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

      {/* QC Dialog */}
      <Dialog open={isQCDialogOpen} onOpenChange={setIsQCDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Quality Check - {selectedQC?.inboundNo}
            </DialogTitle>
            <DialogDescription>
              PO: {selectedQC?.poNumber} | Vendor: {selectedQC?.vendor?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedQC && (
            <div className="space-y-4 py-4">
              {/* Item List */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Inspected</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedQC.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.sku.code}</span>
                            <p className="text-xs text-muted-foreground">
                              {item.sku.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{item.receivedQty}</TableCell>
                        <TableCell>{item.inspectedQty}</TableCell>
                        <TableCell className="text-green-600">{item.passedQty}</TableCell>
                        <TableCell className="text-red-600">{item.failedQty}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* QC Form */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Record QC Result</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Inspected Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={qcForm.inspectedQty}
                      onChange={(e) =>
                        setQcForm((prev) => ({
                          ...prev,
                          inspectedQty: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Passed Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={qcForm.passedQty}
                      onChange={(e) =>
                        setQcForm((prev) => ({
                          ...prev,
                          passedQty: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Failed Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={qcForm.failedQty}
                      onChange={(e) =>
                        setQcForm((prev) => ({
                          ...prev,
                          failedQty: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2 mt-4">
                  <Label>Defect Type (if any)</Label>
                  <Select
                    value={qcForm.defectType}
                    onValueChange={(v) =>
                      setQcForm((prev) => ({ ...prev, defectType: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select defect type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="missing_parts">Missing Parts</SelectItem>
                      <SelectItem value="wrong_item">Wrong Item</SelectItem>
                      <SelectItem value="quality_issue">Quality Issue</SelectItem>
                      <SelectItem value="packaging_damaged">Packaging Damaged</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2 mt-4">
                  <Label>Remarks</Label>
                  <Textarea
                    value={qcForm.remarks}
                    onChange={(e) =>
                      setQcForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Enter any observations or notes..."
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQCDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitQC}>
              Submit QC Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
