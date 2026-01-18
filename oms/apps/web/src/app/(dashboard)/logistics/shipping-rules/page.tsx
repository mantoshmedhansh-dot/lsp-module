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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  RouteIcon,
  ArrowUpDown,
} from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  DRAFT: "bg-yellow-100 text-yellow-800",
};

interface ShippingRule {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: number;
  transporter: { id: string; name: string; code: string };
  location: { id: string; name: string; code: string };
  conditions: {
    id: string;
    field: string;
    operator: string;
    value: string;
    logicalOperator: string;
  }[];
}

interface Location {
  id: string;
  name: string;
  code: string;
}

interface Transporter {
  id: string;
  name: string;
  code: string;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
  logicalOperator: string;
}

export default function ShippingRulesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingRule | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "AUTO_ASSIGN",
    locationId: "",
    transporterId: "",
    priority: 0,
    conditions: [] as Condition[],
  });

  // Fetch shipping rules
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipping-rules", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      const res = await fetch(`/api/v1/shipping-rules?${params}`);
      if (!res.ok) throw new Error("Failed to fetch shipping rules");
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

  // Fetch transporters
  const { data: transportersData } = useQuery({
    queryKey: ["transporters"],
    queryFn: async () => {
      const res = await fetch("/api/v1/transporters?limit=100");
      if (!res.ok) throw new Error("Failed to fetch transporters");
      return res.json();
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const url = data.id ? `/api/v1/shipping-rules/${data.id}` : "/api/v1/shipping-rules";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save rule");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Shipping rule ${editingRule ? "updated" : "created"} successfully`,
      });
      setIsCreateOpen(false);
      setEditingRule(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["shipping-rules"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/shipping-rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete rule");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Shipping rule deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["shipping-rules"] });
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
      name: "",
      type: "AUTO_ASSIGN",
      locationId: "",
      transporterId: "",
      priority: 0,
      conditions: [],
    });
  };

  const handleEdit = (rule: ShippingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      locationId: rule.location.id,
      transporterId: rule.transporter.id,
      priority: rule.priority,
      conditions: rule.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
        logicalOperator: c.logicalOperator,
      })),
    });
    setIsCreateOpen(true);
  };

  const addCondition = () => {
    setFormData((p) => ({
      ...p,
      conditions: [
        ...p.conditions,
        { field: "pincode", operator: "EQUALS", value: "", logicalOperator: "AND" },
      ],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((p) => ({
      ...p,
      conditions: p.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    setFormData((p) => ({
      ...p,
      conditions: p.conditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  const rules: ShippingRule[] = data?.data || [];
  const locations: Location[] = locationsData?.data || [];
  const transporters: Transporter[] = transportersData?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Rules</h1>
          <p className="text-muted-foreground">
            Configure automatic transporter assignment rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setEditingRule(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "Edit Shipping Rule" : "Create Shipping Rule"}
                </DialogTitle>
                <DialogDescription>
                  Define conditions to automatically assign transporters
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Rule Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g., Metro Cities - BlueDart"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Rule Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, type: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO_ASSIGN">Auto Assign</SelectItem>
                        <SelectItem value="PRIORITY">Priority Based</SelectItem>
                        <SelectItem value="COST_BASED">Cost Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                    <Label>Transporter *</Label>
                    <Select
                      value={formData.transporterId}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, transporterId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transporter" />
                      </SelectTrigger>
                      <SelectContent>
                        {transporters.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Input
                      type="number"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          priority: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0 = highest"
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Conditions</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addCondition}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Condition
                    </Button>
                  </div>
                  {formData.conditions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No conditions - rule will apply to all orders
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.conditions.map((condition, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-3 border rounded-lg"
                        >
                          {index > 0 && (
                            <Select
                              value={condition.logicalOperator}
                              onValueChange={(v) =>
                                updateCondition(index, "logicalOperator", v)
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Select
                            value={condition.field}
                            onValueChange={(v) =>
                              updateCondition(index, "field", v)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pincode">Pincode</SelectItem>
                              <SelectItem value="state">State</SelectItem>
                              <SelectItem value="city">City</SelectItem>
                              <SelectItem value="zone">Zone</SelectItem>
                              <SelectItem value="payment_mode">Payment Mode</SelectItem>
                              <SelectItem value="weight">Weight</SelectItem>
                              <SelectItem value="order_value">Order Value</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={condition.operator}
                            onValueChange={(v) =>
                              updateCondition(index, "operator", v)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EQUALS">Equals</SelectItem>
                              <SelectItem value="NOT_EQUALS">Not Equals</SelectItem>
                              <SelectItem value="CONTAINS">Contains</SelectItem>
                              <SelectItem value="STARTS_WITH">Starts With</SelectItem>
                              <SelectItem value="GREATER_THAN">Greater Than</SelectItem>
                              <SelectItem value="LESS_THAN">Less Than</SelectItem>
                              <SelectItem value="IN">In List</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={condition.value}
                            onChange={(e) =>
                              updateCondition(index, "value", e.target.value)
                            }
                            placeholder="Value"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCondition(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingRule(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    saveMutation.mutate({
                      ...formData,
                      id: editingRule?.id,
                    })
                  }
                  disabled={
                    !formData.name ||
                    !formData.locationId ||
                    !formData.transporterId ||
                    saveMutation.isPending
                  }
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingRule
                    ? "Update"
                    : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Rules</CardTitle>
          <CardDescription>
            Rules are evaluated in priority order (lowest number = highest priority)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <RouteIcon className="h-12 w-12 mb-4" />
              <p>No shipping rules configured</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Priority
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">
                        {rule.priority}
                      </TableCell>
                      <TableCell>{rule.name}</TableCell>
                      <TableCell>{rule.type.replace(/_/g, " ")}</TableCell>
                      <TableCell>{rule.location.name}</TableCell>
                      <TableCell>{rule.transporter.name}</TableCell>
                      <TableCell>
                        {rule.conditions.length === 0 ? (
                          <span className="text-muted-foreground">All orders</span>
                        ) : (
                          <span className="text-sm">
                            {rule.conditions.length} condition(s)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[rule.status] || ""}>
                          {rule.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
