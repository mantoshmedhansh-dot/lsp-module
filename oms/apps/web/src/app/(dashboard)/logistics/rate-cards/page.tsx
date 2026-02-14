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
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Plus, Edit, Trash2, RefreshCw, Calculator, Receipt } from "lucide-react";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  EXPIRED: "bg-red-100 text-red-800",
};

interface RateCardSlab {
  id?: string;
  fromWeight: number;
  toWeight: number;
  rate: number;
  additionalPerKg?: number;
}

interface RateCard {
  id: string;
  name: string;
  type: string;
  status: string;
  zone?: string;
  validFrom?: string;
  validTo?: string;
  minWeight?: number;
  maxWeight?: number;
  baseRate?: number;
  perKgRate?: number;
  codPercentage?: number;
  codMinCharge?: number;
  fuelSurchargePercent?: number;
  transporter: { id: string; name: string; code: string };
  slabs: RateCardSlab[];
}

interface Transporter {
  id: string;
  name: string;
  code: string;
}

export default function RateCardsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCalculateOpen, setIsCalculateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<RateCard | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "WEIGHT_BASED",
    transporterId: "",
    zone: "",
    validFrom: "",
    validTo: "",
    minWeight: 0,
    maxWeight: 50,
    baseRate: 0,
    perKgRate: 0,
    codPercentage: 2,
    codMinCharge: 50,
    fuelSurchargePercent: 0,
    slabs: [] as RateCardSlab[],
  });

  // Calculator state
  const [calcData, setCalcData] = useState({
    weight: 1,
    originPincode: "",
    destinationPincode: "",
    paymentMode: "PREPAID",
    orderValue: 1000,
  });
  const [calcResults, setCalcResults] = useState<unknown[]>([]);

  // Fetch rate cards
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rate-cards", page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      const res = await fetch(`/api/v1/logistics/rate-cards?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rate cards");
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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const url = data.id ? `/api/v1/logistics/rate-cards/${data.id}` : "/api/v1/logistics/rate-cards";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save rate card");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Rate card ${editingCard ? "updated" : "created"} successfully`,
      });
      setIsCreateOpen(false);
      setEditingCard(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["rate-cards"] });
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
      const res = await fetch(`/api/v1/logistics/rate-cards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Rate card deleted" });
      queryClient.invalidateQueries({ queryKey: ["rate-cards"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate rates
  const calculateMutation = useMutation({
    mutationFn: async (data: typeof calcData) => {
      const res = await fetch("/api/v1/logistics/rate-cards/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to calculate rates");
      return res.json();
    },
    onSuccess: (data) => {
      setCalcResults(data.rates || []);
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
      type: "WEIGHT_BASED",
      transporterId: "",
      zone: "",
      validFrom: "",
      validTo: "",
      minWeight: 0,
      maxWeight: 50,
      baseRate: 0,
      perKgRate: 0,
      codPercentage: 2,
      codMinCharge: 50,
      fuelSurchargePercent: 0,
      slabs: [],
    });
  };

  const handleEdit = (card: RateCard) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      type: card.type,
      transporterId: card.transporter.id,
      zone: card.zone || "",
      validFrom: card.validFrom?.split("T")[0] || "",
      validTo: card.validTo?.split("T")[0] || "",
      minWeight: card.minWeight || 0,
      maxWeight: card.maxWeight || 50,
      baseRate: card.baseRate || 0,
      perKgRate: card.perKgRate || 0,
      codPercentage: card.codPercentage || 2,
      codMinCharge: card.codMinCharge || 50,
      fuelSurchargePercent: card.fuelSurchargePercent || 0,
      slabs: card.slabs.map((s) => ({
        fromWeight: s.fromWeight,
        toWeight: s.toWeight,
        rate: s.rate,
        additionalPerKg: s.additionalPerKg,
      })),
    });
    setIsCreateOpen(true);
  };

  const addSlab = () => {
    const lastSlab = formData.slabs[formData.slabs.length - 1];
    setFormData((p) => ({
      ...p,
      slabs: [
        ...p.slabs,
        {
          fromWeight: lastSlab ? lastSlab.toWeight : 0,
          toWeight: lastSlab ? lastSlab.toWeight + 5 : 5,
          rate: 0,
          additionalPerKg: 0,
        },
      ],
    }));
  };

  const removeSlab = (index: number) => {
    setFormData((p) => ({
      ...p,
      slabs: p.slabs.filter((_, i) => i !== index),
    }));
  };

  const updateSlab = (index: number, field: string, value: number) => {
    setFormData((p) => ({
      ...p,
      slabs: p.slabs.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const rateCards: RateCard[] = data?.data || [];
  const transporters: Transporter[] = transportersData?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Cards</h1>
          <p className="text-muted-foreground">
            Configure shipping rates and cost calculations
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCalculateOpen} onOpenChange={setIsCalculateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calculator className="h-4 w-4 mr-2" />
                Rate Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Shipping Rate Calculator</DialogTitle>
                <DialogDescription>
                  Calculate shipping rates based on your rate cards
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={calcData.weight}
                      onChange={(e) =>
                        setCalcData((p) => ({
                          ...p,
                          weight: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Order Value</Label>
                    <Input
                      type="number"
                      value={calcData.orderValue}
                      onChange={(e) =>
                        setCalcData((p) => ({
                          ...p,
                          orderValue: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Origin Pincode</Label>
                    <Input
                      value={calcData.originPincode}
                      onChange={(e) =>
                        setCalcData((p) => ({
                          ...p,
                          originPincode: e.target.value,
                        }))
                      }
                      placeholder="e.g., 110001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Destination Pincode</Label>
                    <Input
                      value={calcData.destinationPincode}
                      onChange={(e) =>
                        setCalcData((p) => ({
                          ...p,
                          destinationPincode: e.target.value,
                        }))
                      }
                      placeholder="e.g., 400001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Payment Mode</Label>
                    <Select
                      value={calcData.paymentMode}
                      onValueChange={(v) =>
                        setCalcData((p) => ({ ...p, paymentMode: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PREPAID">Prepaid</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => calculateMutation.mutate(calcData)}
                  disabled={calculateMutation.isPending}
                >
                  {calculateMutation.isPending ? "Calculating..." : "Calculate"}
                </Button>

                {calcResults.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transporter</TableHead>
                          <TableHead className="text-right">Base</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">Fuel</TableHead>
                          <TableHead className="text-right">COD</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calcResults.map((rate: unknown, i) => {
                          const r = rate as {
                            transporterName: string;
                            baseRate: number;
                            weightCharge: number;
                            fuelSurcharge: number;
                            codCharge: number;
                            totalRate: number;
                          };
                          return (
                            <TableRow key={i}>
                              <TableCell>{r.transporterName}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(r.baseRate)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(r.weightCharge)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(r.fuelSurcharge)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(r.codCharge)}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(r.totalRate)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setEditingCard(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Rate Card
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCard ? "Edit Rate Card" : "Create Rate Card"}
                </DialogTitle>
                <DialogDescription>
                  Define shipping rates for a transporter
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="e.g., Standard Surface"
                    />
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
                        <SelectValue placeholder="Select" />
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
                    <Label>Type</Label>
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
                        <SelectItem value="WEIGHT_BASED">Weight Based</SelectItem>
                        <SelectItem value="SLAB_BASED">Slab Based</SelectItem>
                        <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Zone</Label>
                    <Input
                      value={formData.zone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, zone: e.target.value }))
                      }
                      placeholder="e.g., LOCAL, METRO"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valid From</Label>
                    <Input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, validFrom: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Valid To</Label>
                    <Input
                      type="date"
                      value={formData.validTo}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, validTo: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label>Base Rate</Label>
                    <Input
                      type="number"
                      value={formData.baseRate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          baseRate: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Per Kg Rate</Label>
                    <Input
                      type="number"
                      value={formData.perKgRate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          perKgRate: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>COD %</Label>
                    <Input
                      type="number"
                      value={formData.codPercentage}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          codPercentage: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>COD Min</Label>
                    <Input
                      type="number"
                      value={formData.codMinCharge}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          codMinCharge: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Slabs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Weight Slabs</Label>
                    <Button variant="outline" size="sm" onClick={addSlab}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Slab
                    </Button>
                  </div>
                  {formData.slabs.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-2">
                      {formData.slabs.map((slab, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2"
                        >
                          <Input
                            type="number"
                            step="0.5"
                            value={slab.fromWeight}
                            onChange={(e) =>
                              updateSlab(
                                index,
                                "fromWeight",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="From (kg)"
                            className="w-24"
                          />
                          <span>-</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={slab.toWeight}
                            onChange={(e) =>
                              updateSlab(
                                index,
                                "toWeight",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="To (kg)"
                            className="w-24"
                          />
                          <Input
                            type="number"
                            value={slab.rate}
                            onChange={(e) =>
                              updateSlab(
                                index,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="Rate"
                            className="w-24"
                          />
                          <Input
                            type="number"
                            value={slab.additionalPerKg || 0}
                            onChange={(e) =>
                              updateSlab(
                                index,
                                "additionalPerKg",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="Add/kg"
                            className="w-24"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSlab(index)}
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
                    setEditingCard(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    saveMutation.mutate({
                      ...formData,
                      id: editingCard?.id,
                    })
                  }
                  disabled={
                    !formData.name ||
                    !formData.transporterId ||
                    saveMutation.isPending
                  }
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingCard
                    ? "Update"
                    : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Cards</CardTitle>
          <CardDescription>
            {data?.total || 0} rate cards configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : rateCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mb-4" />
              <p>No rate cards configured</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Base Rate</TableHead>
                    <TableHead>Per Kg</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{card.name}</TableCell>
                      <TableCell>{card.transporter.name}</TableCell>
                      <TableCell>{card.type.replace(/_/g, " ")}</TableCell>
                      <TableCell>{card.zone || "-"}</TableCell>
                      <TableCell>
                        {card.baseRate ? formatCurrency(card.baseRate) : "-"}
                      </TableCell>
                      <TableCell>
                        {card.perKgRate ? formatCurrency(card.perKgRate) : "-"}
                      </TableCell>
                      <TableCell>
                        {card.validFrom
                          ? `${formatDate(card.validFrom)} - ${
                              card.validTo ? formatDate(card.validTo) : "∞"
                            }`
                          : "Always"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[card.status] || ""}>
                          {card.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(card)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(card.id)}
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
