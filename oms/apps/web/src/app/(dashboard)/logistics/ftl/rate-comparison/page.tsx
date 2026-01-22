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

interface RateComparison {
  laneRateId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  capacityKg: number;
  baseRate: number;
  loadingCharges: number;
  unloadingCharges: number;
  tollCharges: number;
  totalRate: number;
  transitDays: number;
  reliabilityScore: number | null;
}

interface VehicleType {
  id: string;
  code: string;
  name: string;
}

export default function FTLRateComparisonPage() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RateComparison[]>([]);

  const [originCity, setOriginCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [vehicleTypeId, setVehicleTypeId] = useState("");

  useEffect(() => {
    fetchVehicleTypes();
  }, []);

  const fetchVehicleTypes = async () => {
    try {
      const response = await fetch("/api/v1/ftl/vehicle-types?is_active=true&limit=100");
      if (!response.ok) throw new Error("Failed to fetch vehicle types");
      const result = await response.json();
      setVehicleTypes(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
    }
  };

  async function handleCompare() {
    if (!originCity || !destinationCity) {
      toast.error("Please enter origin and destination cities");
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("origin_city", originCity);
      params.set("destination_city", destinationCity);
      if (vehicleTypeId) params.set("vehicle_type_id", vehicleTypeId);

      const response = await fetch(`/api/v1/ftl/rate-comparison?${params}`);
      if (!response.ok) throw new Error("Failed to fetch rates");
      const result = await response.json();
      setResults(result.rates || []);

      if (result.rates?.length === 0) {
        toast.info("No rates found for this lane");
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
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatCapacity(kg: number): string {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1)} ton`;
    }
    return `${kg} kg`;
  }

  const lowestRate = results.length > 0 ? Math.min(...results.map((r) => r.totalRate)) : 0;
  const fastestTAT = results.length > 0 ? Math.min(...results.map((r) => r.transitDays)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FTL Rate Comparison</h1>
          <p className="text-muted-foreground">
            Compare rates from multiple vendors for a lane
          </p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Lane</CardTitle>
          <CardDescription>
            Enter origin and destination to compare FTL rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 items-end">
            <div className="grid gap-2">
              <Label>Origin City *</Label>
              <Input
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                placeholder="e.g., Mumbai"
              />
            </div>
            <div className="grid gap-2">
              <Label>Destination City *</Label>
              <Input
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="e.g., Delhi"
              />
            </div>
            <div className="grid gap-2">
              <Label>Vehicle Type (Optional)</Label>
              <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All vehicle types</SelectItem>
                  {vehicleTypes.map((vt) => (
                    <SelectItem key={vt.id} value={vt.id}>
                      {vt.name}
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
          <div className="grid grid-cols-3 gap-4">
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
                    <Truck className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Options Available</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {results.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lane Header */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <span className="text-lg font-semibold">{originCity}</span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg font-semibold">{destinationCity}</span>
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
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Base Rate</TableHead>
                    <TableHead>Additional</TableHead>
                    <TableHead>Total Rate</TableHead>
                    <TableHead>TAT</TableHead>
                    <TableHead>Reliability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((rate, index) => (
                    <TableRow
                      key={rate.laneRateId}
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
                      <TableCell>{rate.vehicleTypeName}</TableCell>
                      <TableCell>{formatCapacity(rate.capacityKg)}</TableCell>
                      <TableCell>{formatCurrency(rate.baseRate)}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {rate.loadingCharges > 0 && (
                            <div>L: {formatCurrency(rate.loadingCharges)}</div>
                          )}
                          {rate.unloadingCharges > 0 && (
                            <div>U: {formatCurrency(rate.unloadingCharges)}</div>
                          )}
                          {rate.tollCharges > 0 && (
                            <div>T: {formatCurrency(rate.tollCharges)}</div>
                          )}
                          {rate.loadingCharges === 0 &&
                            rate.unloadingCharges === 0 &&
                            rate.tollCharges === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                        </div>
                      </TableCell>
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
      {results.length === 0 && !isLoading && originCity && destinationCity && (
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
      {!originCity && !destinationCity && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">FTL Rate Shopping</p>
            <p className="text-muted-foreground text-center max-w-md">
              Enter origin and destination cities to compare FTL rates from
              multiple vendors. Find the best price and fastest delivery for
              your lane.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
