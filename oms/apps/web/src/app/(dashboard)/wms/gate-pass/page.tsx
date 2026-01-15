"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/utils";
import {
  Plus,
  Eye,
  LogIn,
  LogOut,
  RefreshCw,
  UserCheck,
  Truck,
  Package,
  Users,
} from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  APPROVED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-green-100 text-green-800",
  CHECKED_OUT: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-orange-100 text-orange-800",
};

const typeColors: Record<string, string> = {
  VISITOR: "bg-blue-500",
  DELIVERY_IN: "bg-green-500",
  DELIVERY_OUT: "bg-purple-500",
  MATERIAL_IN: "bg-cyan-500",
  MATERIAL_OUT: "bg-orange-500",
  VEHICLE: "bg-yellow-500",
};

interface GatePass {
  id: string;
  gatePassNo: string;
  type: string;
  status: string;
  visitorName?: string;
  visitorPhone?: string;
  companyName?: string;
  purpose?: string;
  vehicleNumber?: string;
  driverName?: string;
  awbNo?: string;
  entryTime: string;
  exitTime?: string;
  _count: { items: number };
}

interface Location {
  id: string;
  name: string;
  code: string;
}

export default function GatePassPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    type: "VISITOR",
    locationId: "",
    visitorName: "",
    visitorPhone: "",
    visitorIdType: "",
    visitorIdNo: "",
    companyName: "",
    purpose: "",
    vehicleNumber: "",
    vehicleType: "",
    driverName: "",
    driverPhone: "",
    awbNo: "",
    poNo: "",
    invoiceNo: "",
  });

  // Fetch gate passes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["gate-passes", type, status, date, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (type) params.append("type", type);
      if (status) params.append("status", status);
      if (date) params.append("date", date);

      const res = await fetch(`/api/gate-passes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch gate passes");
      return res.json();
    },
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations?limit=100");
      if (!res.ok) throw new Error("Failed to fetch locations");
      return res.json();
    },
  });

  // Create gate pass mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/gate-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create gate pass");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Gate pass created",
        description: `Gate pass ${data.gatePassNo} created successfully`,
      });
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["gate-passes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check in/out mutation
  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch(`/api/gate-passes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update gate pass");
      }
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: "Success",
        description: `Gate pass ${action.replace("_", " ")} completed`,
      });
      queryClient.invalidateQueries({ queryKey: ["gate-passes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      type: "VISITOR",
      locationId: "",
      visitorName: "",
      visitorPhone: "",
      visitorIdType: "",
      visitorIdNo: "",
      companyName: "",
      purpose: "",
      vehicleNumber: "",
      vehicleType: "",
      driverName: "",
      driverPhone: "",
      awbNo: "",
      poNo: "",
      invoiceNo: "",
    });
  };

  const gatePasses: GatePass[] = data?.data || [];
  const locations: Location[] = locationsData?.data || [];
  const stats = data?.stats || {};
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gate Pass</h1>
          <p className="text-muted-foreground">
            Visitor and delivery entry/exit tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Gate Pass
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Gate Pass</DialogTitle>
                <DialogDescription>
                  Register a new visitor or delivery entry
                </DialogDescription>
              </DialogHeader>
              <Tabs
                value={formData.type}
                onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="VISITOR">
                    <Users className="h-4 w-4 mr-2" />
                    Visitor
                  </TabsTrigger>
                  <TabsTrigger value="DELIVERY_IN">
                    <Package className="h-4 w-4 mr-2" />
                    Delivery In
                  </TabsTrigger>
                  <TabsTrigger value="VEHICLE">
                    <Truck className="h-4 w-4 mr-2" />
                    Vehicle
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="VISITOR" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Location *</Label>
                      <Select
                        value={formData.locationId}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, locationId: v }))
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
                      <Label>Visitor Name *</Label>
                      <Input
                        value={formData.visitorName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            visitorName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.visitorPhone}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            visitorPhone: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Company</Label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            companyName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>ID Type</Label>
                      <Select
                        value={formData.visitorIdType}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, visitorIdType: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AADHAR">Aadhar Card</SelectItem>
                          <SelectItem value="PAN">PAN Card</SelectItem>
                          <SelectItem value="DL">Driving License</SelectItem>
                          <SelectItem value="PASSPORT">Passport</SelectItem>
                          <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>ID Number</Label>
                      <Input
                        value={formData.visitorIdNo}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            visitorIdNo: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="col-span-2 grid gap-2">
                      <Label>Purpose *</Label>
                      <Textarea
                        value={formData.purpose}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, purpose: e.target.value }))
                        }
                        placeholder="Purpose of visit..."
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="DELIVERY_IN" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Location *</Label>
                      <Select
                        value={formData.locationId}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, locationId: v }))
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
                      <Label>AWB / Tracking No</Label>
                      <Input
                        value={formData.awbNo}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, awbNo: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>PO Number</Label>
                      <Input
                        value={formData.poNo}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, poNo: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Invoice Number</Label>
                      <Input
                        value={formData.invoiceNo}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            invoiceNo: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Delivery Person Name</Label>
                      <Input
                        value={formData.visitorName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            visitorName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Company</Label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            companyName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Vehicle Number</Label>
                      <Input
                        value={formData.vehicleNumber}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            vehicleNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Purpose</Label>
                      <Input
                        value={formData.purpose}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, purpose: e.target.value }))
                        }
                        placeholder="Delivery purpose"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="VEHICLE" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Location *</Label>
                      <Select
                        value={formData.locationId}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, locationId: v }))
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
                      <Label>Vehicle Number *</Label>
                      <Input
                        value={formData.vehicleNumber}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            vehicleNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Vehicle Type</Label>
                      <Select
                        value={formData.vehicleType}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, vehicleType: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TRUCK">Truck</SelectItem>
                          <SelectItem value="TEMPO">Tempo</SelectItem>
                          <SelectItem value="VAN">Van</SelectItem>
                          <SelectItem value="CAR">Car</SelectItem>
                          <SelectItem value="BIKE">Bike</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Driver Name *</Label>
                      <Input
                        value={formData.driverName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            driverName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Driver Phone</Label>
                      <Input
                        value={formData.driverPhone}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            driverPhone: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Company</Label>
                      <Input
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            companyName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="col-span-2 grid gap-2">
                      <Label>Purpose</Label>
                      <Textarea
                        value={formData.purpose}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, purpose: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.locationId || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Checked In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {stats.CHECKED_IN || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.PENDING || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {stats.CHECKED_OUT || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.COMPLETED || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="VISITOR">Visitor</SelectItem>
                <SelectItem value="DELIVERY_IN">Delivery In</SelectItem>
                <SelectItem value="DELIVERY_OUT">Delivery Out</SelectItem>
                <SelectItem value="MATERIAL_IN">Material In</SelectItem>
                <SelectItem value="MATERIAL_OUT">Material Out</SelectItem>
                <SelectItem value="VEHICLE">Vehicle</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                <SelectItem value="CHECKED_OUT">Checked Out</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gate Passes</CardTitle>
          <CardDescription>{data?.total || 0} total entries</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : gatePasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserCheck className="h-12 w-12 mb-4" />
              <p>No gate passes found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pass No</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Visitor/Driver</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Purpose/AWB</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gatePasses.map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell className="font-medium">
                        {gp.gatePassNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              typeColors[gp.type] || "bg-gray-500"
                            }`}
                          />
                          {gp.type.replace(/_/g, " ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {gp.visitorName || gp.driverName || "-"}
                      </TableCell>
                      <TableCell>{gp.companyName || "-"}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {gp.awbNo || gp.purpose || "-"}
                      </TableCell>
                      <TableCell>{formatTime(gp.entryTime)}</TableCell>
                      <TableCell>
                        {gp.exitTime ? formatTime(gp.exitTime) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[gp.status] || ""}>
                          {gp.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Link href={`/wms/gate-pass/${gp.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {gp.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                actionMutation.mutate({
                                  id: gp.id,
                                  action: "check_in",
                                })
                              }
                            >
                              <LogIn className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {gp.status === "CHECKED_IN" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                actionMutation.mutate({
                                  id: gp.id,
                                  action: "check_out",
                                })
                              }
                            >
                              <LogOut className="h-4 w-4 text-purple-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
