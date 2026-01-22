"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Truck,
  Download,
  IndianRupee,
  Package,
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface LanePerformance {
  id: string;
  originZone: string;
  destinationZone: string;
  shipmentType: string;
  period: string;
  totalShipments: number;
  delivered: number;
  rto: number;
  deliveryRate: number;
  rtoRate: number;
  avgTatDays: number;
  targetTatDays: number;
  onTimeRate: number;
  avgCost: number;
  topCarrier: string;
  topCarrierShare: number;
  trend: string;
}

const SHIPMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "FTL", label: "FTL" },
  { value: "B2B_PTL", label: "B2B/PTL" },
];

const PERIODS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

const ZONES = [
  "NORTH",
  "SOUTH",
  "EAST",
  "WEST",
  "CENTRAL",
  "NORTHEAST",
];

export default function LanePerformancePage() {
  const [lanes, setLanes] = useState<LanePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("30d");

  const fetchLanePerformance = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.set("shipment_type", typeFilter);
      if (originFilter) params.set("origin_zone", originFilter);
      if (destinationFilter) params.set("destination_zone", destinationFilter);
      params.set("period", periodFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/analytics/lane-performance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();
      setLanes(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching lanes:", error);
      toast.error("Failed to load lane performance");
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, originFilter, destinationFilter, periodFilter]);

  useEffect(() => {
    fetchLanePerformance();
  }, [fetchLanePerformance]);

  function getTrendIcon(trend: string) {
    if (trend === "UP") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "DOWN") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  }

  function getPerformanceColor(rate: number): string {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Stats
  const totalShipments = lanes.reduce((sum, l) => sum + l.totalShipments, 0);
  const avgDeliveryRate = lanes.length > 0
    ? lanes.reduce((sum, l) => sum + l.deliveryRate, 0) / lanes.length
    : 0;
  const avgTat = lanes.length > 0
    ? lanes.reduce((sum, l) => sum + l.avgTatDays, 0) / lanes.length
    : 0;

  // Top/Bottom lanes
  const topLanes = [...lanes].sort((a, b) => b.deliveryRate - a.deliveryRate).slice(0, 5);
  const bottomLanes = [...lanes].sort((a, b) => a.deliveryRate - b.deliveryRate).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lane Performance</h1>
          <p className="text-muted-foreground">
            Performance metrics for FTL and B2B/PTL lanes
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Lanes</p>
                <p className="text-2xl font-bold">{lanes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Shipments</p>
                <p className="text-2xl font-bold">{totalShipments.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {avgDeliveryRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg TAT</p>
                <p className="text-2xl font-bold">{avgTat.toFixed(1)} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top/Bottom Lanes */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Top Performing Lanes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topLanes.map((lane, i) => (
                <div key={lane.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <span className="text-sm">
                      {lane.originZone} → {lane.destinationZone}
                    </span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {lane.deliveryRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Needs Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bottomLanes.map((lane, i) => (
                <div key={lane.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <span className="text-sm">
                      {lane.originZone} → {lane.destinationZone}
                    </span>
                  </div>
                  <Badge className="bg-red-100 text-red-800">
                    {lane.deliveryRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lanes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {SHIPMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Origins</SelectItem>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={destinationFilter} onValueChange={setDestinationFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Destinations</SelectItem>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lane Performance Details</CardTitle>
          <CardDescription>
            {lanes.length} lane(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lane</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Delivery Rate</TableHead>
                <TableHead>RTO Rate</TableHead>
                <TableHead>Avg TAT</TableHead>
                <TableHead>On-Time</TableHead>
                <TableHead>Top Carrier</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : lanes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No lane data found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                lanes.map((lane) => (
                  <TableRow key={lane.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{lane.originZone}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline">{lane.destinationZone}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          lane.shipmentType === "FTL"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }
                      >
                        {lane.shipmentType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{lane.totalShipments}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${getPerformanceColor(lane.deliveryRate)}`}>
                        {lane.deliveryRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600">{lane.rtoRate.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{lane.avgTatDays.toFixed(1)} days</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Target: {lane.targetTatDays} days
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={lane.onTimeRate} className="w-16 h-2" />
                        <span className="text-sm">{lane.onTimeRate.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{lane.topCarrier}</div>
                      <div className="text-xs text-muted-foreground">
                        {lane.topCarrierShare.toFixed(0)}% share
                      </div>
                    </TableCell>
                    <TableCell>{getTrendIcon(lane.trend)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
