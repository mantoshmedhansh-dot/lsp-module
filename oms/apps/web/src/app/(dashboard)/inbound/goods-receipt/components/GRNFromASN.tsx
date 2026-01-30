"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface ASN {
  id: string;
  asnNo: string;
  externalAsnNo?: string;
  externalPoId?: string;
  externalVendorCode?: string;
  externalVendorName?: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  vehicleNumber?: string;
  driverName?: string;
  expectedArrival?: string;
  actualArrival?: string;
  totalLines?: number;
  totalExpectedQty?: number;
  totalCartons?: number;
  totalPallets?: number;
}

interface GRNFromASNProps {
  onCreated?: (grnId: string) => void;
  onCancel?: () => void;
}

export function GRNFromASN({ onCreated, onCancel }: GRNFromASNProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [asns, setAsns] = useState<ASN[]>([]);
  const [filteredASNs, setFilteredASNs] = useState<ASN[]>([]);

  // Form state
  const [locationId, setLocationId] = useState<string>("");
  const [selectedASNId, setSelectedASNId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Receiving details (pre-filled from ASN if available)
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [gateEntryNo, setGateEntryNo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (locationId) {
      fetchASNs(locationId);
    } else {
      setAsns([]);
      setFilteredASNs([]);
    }
  }, [locationId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = asns.filter(
        (asn) =>
          asn.asnNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asn.externalAsnNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asn.externalVendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asn.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredASNs(filtered);
    } else {
      setFilteredASNs(asns);
    }
  }, [searchQuery, asns]);

  // Pre-fill receiving details when ASN is selected
  useEffect(() => {
    const selectedASN = asns.find((a) => a.id === selectedASNId);
    if (selectedASN) {
      setVehicleNumber(selectedASN.vehicleNumber || "");
      setDriverName(selectedASN.driverName || "");
    }
  }, [selectedASNId, asns]);

  async function fetchLocations() {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/locations?type=WAREHOUSE&limit=100");
      if (response.ok) {
        const data = await response.json();
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

  async function fetchASNs(locId: string) {
    try {
      setLoading(true);
      // Fetch ASNs with status ARRIVED (ready for receiving)
      const response = await fetch(
        `/api/v1/asns?status=ARRIVED&location_id=${locId}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        const asnList = Array.isArray(data) ? data : data.items || [];
        setAsns(asnList);
        setFilteredASNs(asnList);
      }
    } catch (error) {
      console.error("Error fetching ASNs:", error);
      toast.error("Failed to load ASNs");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGRN() {
    if (!selectedASNId) {
      toast.error("Please select an ASN");
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

      const url = `/api/v1/goods-receipts/from-asn/${selectedASNId}?${params.toString()}`;
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

  const selectedASN = asns.find((asn) => asn.id === selectedASNId);

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case "ARRIVED":
        return "default";
      case "IN_TRANSIT":
        return "secondary";
      case "EXPECTED":
        return "outline";
      default:
        return "outline";
    }
  }

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

      {/* ASN Selection */}
      {locationId && (
        <Card>
          <CardHeader>
            <CardTitle>Select ASN</CardTitle>
            <CardDescription>Choose an arrived ASN to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ASN number, vendor, or tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* ASN List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredASNs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {asns.length === 0
                    ? "No arrived ASNs for this location"
                    : "No ASNs match your search"}
                </p>
              </div>
            ) : (
              <RadioGroup value={selectedASNId} onValueChange={setSelectedASNId}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>ASN Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Carrier / Tracking</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Arrived</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredASNs.map((asn) => (
                      <TableRow
                        key={asn.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedASNId(asn.id)}
                      >
                        <TableCell>
                          <RadioGroupItem value={asn.id} id={asn.id} />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <p>{asn.asnNo}</p>
                            {asn.externalAsnNo && (
                              <p className="text-xs text-muted-foreground">
                                Ext: {asn.externalAsnNo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{asn.externalVendorName || "-"}</p>
                            {asn.externalVendorCode && (
                              <p className="text-xs text-muted-foreground">
                                {asn.externalVendorCode}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{asn.carrier || "-"}</p>
                            {asn.trackingNumber && (
                              <p className="text-xs text-muted-foreground">
                                {asn.trackingNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {asn.totalExpectedQty?.toLocaleString() || "-"}
                        </TableCell>
                        <TableCell>
                          {asn.actualArrival
                            ? format(new Date(asn.actualArrival), "dd MMM yyyy HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(asn.status)}>
                            {asn.status}
                          </Badge>
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
      {selectedASN && (
        <Card>
          <CardHeader>
            <CardTitle>Receiving Details</CardTitle>
            <CardDescription>
              Confirm or update receiving information for {selectedASN.asnNo}
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
        <Button onClick={handleCreateGRN} disabled={!selectedASNId || creating}>
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

export default GRNFromASN;
