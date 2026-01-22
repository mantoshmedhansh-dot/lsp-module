"use client";

import { useState, useEffect } from "react";
import {
  Search,
  ArrowRight,
  IndianRupee,
  Clock,
  Truck,
  TrendingUp,
  Award,
  Scale,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PTLRateComparison {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  ratePerKg: number;
  minCharge: number;
  fuelSurchargePercent: number;
  odaCharge: number;
  totalRate: number;
  transitDays: number;
  minTransitDays: number;
  maxTransitDays: number;
  reliabilityScore: number | null;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

const ZONES = [
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "CENTRAL",
  "NORTHEAST",
  "LOCAL",
  "METRO",
  "REST_OF_INDIA",
];

export default function PTLRateComparisonPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PTLRateComparison[]>([]);

  const [originZone, setOriginZone] = useState("");
  const [destinationZone, setDestinationZone] = useState("");
  const [weight, setWeight] = useState("");
  const [vendorId, setVendorId] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/v1/ptl/vendors?is_active=true&limit=100");
      if (!response.ok) throw new Error("Failed to fetch vendors");
      const result = await response.json();
      setVendors(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  async function handleCompare() {
    if (!originZone || !destinationZone || !weight) {
      toast.error("Please enter origin, destination, and weight");
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("origin_zone", originZone);
      params.set("destination_zone", destinationZone);
      params.set("weight_kg", weight);
      if (vendorId) params.set("vendor_id", vendorId);

      const response = await fetch(`/api/v1/ptl/rate-comparison?${params}`);
      if (!response.ok) throw new Error("Failed to fetch rates");
      const result = await response.json();
      setResults(result.rates || []);

      if (result.rates?.length === 0) {
        toast.info("No rates found for this lane and weight");
      }
    } catch (error) {
      console.error("Error comparing rates:", error);
      toast.error("Failed to compare rates");
    } finally {
      setIsLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatTransitRange(min: number, max: number): string {
    if (min === max) return `${min} day(s)`;
    return `${min}-${max} day(s)`;
  }

  const lowestRate = results.length > 0 ? Math.min(...results.map((r) => r.totalRate)) : 0;
  const fastestTAT = results.length > 0 ? Math.min(...results.map((r) => r.transitDays)) : 0;
  const bestReliability = results.length > 0
    ? Math.max(...results.filter(r => r.reliabilityScore !== null).map((r) => r.reliabilityScore!))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PTL Rate Comparison</h1>
          <p className="text-muted-foreground">
            Compare rates from multiple vendors for a lane and weight
          </p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Rates</CardTitle>
          <CardDescription>
            Enter origin, destination, and weight to compare PTL rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 items-end">
            <div className="grid gap-2">
              <Label>Origin Zone *</Label>
              <Select value={originZone} onValueChange={setOriginZone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Destination Zone *</Label>
              <Select value={destinationZone} onValueChange={setDestinationZone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Weight (kg) *</Label>
              <Input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g., 50"
              />
            </div>
            <div className="grid gap-2">
              <Label>Vendor (Optional)</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="All vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All vendors</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCompare} disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" />
              Compare Rates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <IndianRupee className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lowest Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(lowestRate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fastest TAT</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {fastestTAT} day(s)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Reliability</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {bestReliability > 0 ? `${bestReliability}%` : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Options</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {results.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lane Header */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Badge variant="outline" className="text-base px-3 py-1">
              {originZone}
            </Badge>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className="text-base px-3 py-1">
              {destinationZone}
            </Badge>
            <span className="text-muted-foreground mx-2">|</span>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{weight} kg</span>
            </div>
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Comparison</CardTitle>
              <CardDescription>
                Sorted by total rate (lowest first)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Rate/kg</TableHead>
                    <TableHead>Min Charge</TableHead>
                    <TableHead>Fuel %</TableHead>
                    <TableHead>ODA</TableHead>
                    <TableHead>Total Rate</TableHead>
                    <TableHead>TAT</TableHead>
                    <TableHead>Reliability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((rate, index) => (
                    <TableRow
                      key={rate.vendorId}
                      className={index === 0 ? "bg-green-50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Award className="h-5 w-5 text-green-600" />
                          )}
                          <span className={index === 0 ? "font-bold" : ""}>
                            #{index + 1}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rate.vendorName}</div>
                        <div className="text-xs text-muted-foreground">
                          {rate.vendorCode}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(rate.ratePerKg)}</TableCell>
                      <TableCell>{formatCurrency(rate.minCharge)}</TableCell>
                      <TableCell>{rate.fuelSurchargePercent}%</TableCell>
                      <TableCell>{formatCurrency(rate.odaCharge)}</TableCell>
                      <TableCell>
                        <span
                          className={`font-bold ${
                            rate.totalRate === lowestRate
                              ? "text-green-600"
                              : ""
                          }`}
                        >
                          {formatCurrency(rate.totalRate)}
                        </span>
                        {rate.totalRate === lowestRate && (
                          <Badge className="ml-2 bg-green-100 text-green-800">
                            Best Price
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span
                            className={
                              rate.transitDays === fastestTAT
                                ? "font-bold text-blue-600"
                                : ""
                            }
                          >
                            {rate.transitDays} day(s)
                          </span>
                          {rate.transitDays === fastestTAT && (
                            <Badge className="ml-1 bg-blue-100 text-blue-800">
                              Fastest
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Range: {formatTransitRange(rate.minTransitDays, rate.maxTransitDays)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rate.reliabilityScore !== null ? (
                          <Badge
                            variant={
                              rate.reliabilityScore >= 80
                                ? "default"
                                : rate.reliabilityScore >= 60
                                ? "secondary"
                                : "destructive"
                            }
                            className={
                              rate.reliabilityScore >= 80
                                ? "bg-green-100 text-green-800"
                                : rate.reliabilityScore >= 60
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {rate.reliabilityScore}%
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {results.length === 0 && !isLoading && originZone && destinationZone && weight && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Click "Compare Rates" to search for available rates
            </p>
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!originZone && !destinationZone && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">PTL Rate Shopping</p>
            <p className="text-muted-foreground text-center max-w-md">
              Enter origin zone, destination zone, and shipment weight to compare
              PTL rates from multiple vendors. Find the best combination of price,
              speed, and reliability.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
