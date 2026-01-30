"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface ExternalPO {
  id: string;
  externalPoNumber: string;
  externalVendorCode: string;
  externalVendorName: string;
  poDate: string;
  expectedDeliveryDate: string;
  totalLines: number;
  totalExpectedQty: number;
  totalAmount?: number;
  status: string;
}

interface GRNFromPOProps {
  onCreated?: (grnId: string) => void;
  onCancel?: () => void;
}

export function GRNFromPO({ onCreated, onCancel }: GRNFromPOProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [externalPOs, setExternalPOs] = useState<ExternalPO[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<ExternalPO[]>([]);

  // Form state
  const [locationId, setLocationId] = useState<string>("");
  const [selectedPOId, setSelectedPOId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Receiving details
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [gateEntryNo, setGateEntryNo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (locationId) {
      fetchExternalPOs(locationId);
    } else {
      setExternalPOs([]);
      setFilteredPOs([]);
    }
  }, [locationId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = externalPOs.filter(
        (po) =>
          po.externalPoNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.externalVendorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPOs(filtered);
    } else {
      setFilteredPOs(externalPOs);
    }
  }, [searchQuery, externalPOs]);

  async function fetchLocations() {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/locations?type=WAREHOUSE&limit=100");
      if (response.ok) {
        const data = await response.json();
        // Handle both array and {items: []} response formats
        const locationList = Array.isArray(data) ? data : data.items || [];
        setLocations(locationList);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  async function fetchExternalPOs(locId: string) {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/external-pos?status=OPEN&location_id=${locId}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        const poList = Array.isArray(data) ? data : data.items || [];
        setExternalPOs(poList);
        setFilteredPOs(poList);
      }
    } catch (error) {
      console.error("Error fetching external POs:", error);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGRN() {
    if (!selectedPOId) {
      toast.error("Please select a purchase order");
      return;
    }

    try {
      setCreating(true);

      // Build query params
      const params = new URLSearchParams();
      if (vehicleNumber) params.append("vehicle_number", vehicleNumber);
      if (driverName) params.append("driver_name", driverName);
      if (gateEntryNo) params.append("gate_entry_no", gateEntryNo);
      if (notes) params.append("notes", notes);

      const url = `/api/v1/goods-receipts/from-external-po/${selectedPOId}?${params.toString()}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create goods receipt");
      }

      const grn = await response.json();
      toast.success(`Goods Receipt ${grn.grNo} created successfully`);

      if (onCreated) {
        onCreated(grn.id);
      } else {
        router.push(`/inbound/goods-receipt/${grn.id}`);
      }
    } catch (error) {
      console.error("Error creating GRN:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create goods receipt");
    } finally {
      setCreating(false);
    }
  }

  const selectedPO = externalPOs.find((po) => po.id === selectedPOId);

  return (
    <div className="space-y-6">
      {/* Location Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Location</CardTitle>
          <CardDescription>Choose the warehouse receiving the goods</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Select warehouse location" />
            </SelectTrigger>
            <SelectContent>
              {locations.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No warehouses available
                </SelectItem>
              ) : (
                locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* PO Selection */}
      {locationId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Purchase Order</CardTitle>
            <CardDescription>Choose an open purchase order to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by PO number or vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* PO List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPOs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {externalPOs.length === 0
                    ? "No open purchase orders for this location"
                    : "No purchase orders match your search"}
                </p>
              </div>
            ) : (
              <RadioGroup value={selectedPOId} onValueChange={setSelectedPOId}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Expected Qty</TableHead>
                      <TableHead>Expected Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOs.map((po) => (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedPOId(po.id)}
                      >
                        <TableCell>
                          <RadioGroupItem value={po.id} id={po.id} />
                        </TableCell>
                        <TableCell className="font-medium">{po.externalPoNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p>{po.externalVendorName}</p>
                            <p className="text-xs text-muted-foreground">{po.externalVendorCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{po.totalLines}</TableCell>
                        <TableCell className="text-right">
                          {po.totalExpectedQty?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {po.expectedDeliveryDate
                            ? format(new Date(po.expectedDeliveryDate), "dd MMM yyyy")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receiving Details */}
      {selectedPO && (
        <Card>
          <CardHeader>
            <CardTitle>Receiving Details</CardTitle>
            <CardDescription>
              Enter optional receiving information for {selectedPO.externalPoNumber}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                <Input
                  id="vehicleNumber"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g., TK-1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverName">Driver Name</Label>
                <Input
                  id="driverName"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g., Yamamoto-san"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gateEntryNo">Gate Entry No</Label>
                <Input
                  id="gateEntryNo"
                  value={gateEntryNo}
                  onChange={(e) => setGateEntryNo(e.target.value)}
                  placeholder="e.g., GE-0089"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleCreateGRN} disabled={!selectedPOId || creating}>
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create GRN"
          )}
        </Button>
      </div>
    </div>
  );
}

export default GRNFromPO;
