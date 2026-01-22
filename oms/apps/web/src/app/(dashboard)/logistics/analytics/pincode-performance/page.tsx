"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  TrendingUp,
  TrendingDown,
  Clock,
  Truck,
  Download,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
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

interface PincodePerformance {
  id: string;
  pincode: string;
  city: string;
  state: string;
  zone: string;
  period: string;
  totalShipments: number;
  delivered: number;
  rto: number;
  deliveryRate: number;
  rtoRate: number;
  avgTatDays: number;
  onTimeRate: number;
  topCarrier: string;
  topCarrierDeliveryRate: number;
  activeCarriers: number;
  riskLevel: string;
  trend: string;
}

const PERIODS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

const RISK_LEVELS = [
  { value: "", label: "All Risk Levels" },
  { value: "LOW", label: "Low Risk" },
  { value: "MEDIUM", label: "Medium Risk" },
  { value: "HIGH", label: "High Risk" },
];

const ZONES = [
  { value: "", label: "All Zones" },
  { value: "METRO", label: "Metro" },
  { value: "TIER_1", label: "Tier 1" },
  { value: "TIER_2", label: "Tier 2" },
  { value: "TIER_3", label: "Tier 3" },
  { value: "REMOTE", label: "Remote" },
];

export default function PincodePerformancePage() {
  const [pincodes, setPincodes] = useState<PincodePerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("30d");

  const fetchPincodePerformance = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (zoneFilter) params.set("zone", zoneFilter);
      if (riskFilter) params.set("risk_level", riskFilter);
      params.set("period", periodFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/v1/analytics/pincode-performance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();
      setPincodes(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching pincodes:", error);
      toast.error("Failed to load pincode performance");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, zoneFilter, riskFilter, periodFilter]);

  useEffect(() => {
    fetchPincodePerformance();
  }, [fetchPincodePerformance]);

  function getTrendIcon(trend: string) {
    if (trend === "UP") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "DOWN") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  }

  function getRiskBadge(risk: string) {
    const colors: Record<string, string> = {
      LOW: "bg-green-100 text-green-800",
      MEDIUM: "bg-yellow-100 text-yellow-800",
      HIGH: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={colors[risk] || "bg-gray-100 text-gray-800"}>
        {risk}
      </Badge>
    );
  }

  function getPerformanceColor(rate: number): string {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  }

  // Stats
  const totalPincodes = pincodes.length;
  const highRiskCount = pincodes.filter((p) => p.riskLevel === "HIGH").length;
  const avgDeliveryRate = pincodes.length > 0
    ? pincodes.reduce((sum, p) => sum + p.deliveryRate, 0) / pincodes.length
    : 0;
  const totalShipments = pincodes.reduce((sum, p) => sum + p.totalShipments, 0);

  // Problem pincodes
  const problemPincodes = pincodes
    .filter((p) => p.deliveryRate < 80 || p.rtoRate > 15)
    .sort((a, b) => a.deliveryRate - b.deliveryRate)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pincode Performance</h1>
          <p className="text-muted-foreground">
            B2C delivery performance by pincode
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
                <p className="text-sm text-muted-foreground">Total Pincodes</p>
                <p className="text-2xl font-bold">{totalPincodes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
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
      </div>

      {/* Problem Pincodes Alert */}
      {problemPincodes.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              Pincodes Requiring Attention
            </CardTitle>
            <CardDescription className="text-red-700">
              {problemPincodes.length} pincode(s) with delivery rate below 80% or RTO above 15%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {problemPincodes.slice(0, 10).map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="border-red-300 text-red-800"
                >
                  {p.pincode} ({p.deliveryRate.toFixed(0)}%)
                </Badge>
              ))}
              {problemPincodes.length > 10 && (
                <Badge variant="outline" className="border-red-300 text-red-800">
                  +{problemPincodes.length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by pincode, city, or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((risk) => (
                  <SelectItem key={risk.value} value={risk.value}>
                    {risk.label}
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
          <CardTitle>Pincode Performance Details</CardTitle>
          <CardDescription>
            {pincodes.length} pincode(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pincode</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Delivery Rate</TableHead>
                <TableHead>RTO Rate</TableHead>
                <TableHead>Avg TAT</TableHead>
                <TableHead>Top Carrier</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : pincodes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">No pincode data found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pincodes.map((pincode) => (
                  <TableRow key={pincode.id}>
                    <TableCell>
                      <span className="font-mono font-medium">{pincode.pincode}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{pincode.city}</div>
                      <div className="text-xs text-muted-foreground">{pincode.state}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pincode.zone}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{pincode.totalShipments}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getPerformanceColor(pincode.deliveryRate)}`}>
                          {pincode.deliveryRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={pincode.deliveryRate}
                        className="w-16 h-1.5 mt-1"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={pincode.rtoRate > 15 ? "text-red-600 font-medium" : ""}>
                        {pincode.rtoRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{pincode.avgTatDays.toFixed(1)} days</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{pincode.topCarrier}</div>
                      <div className="text-xs text-muted-foreground">
                        {pincode.topCarrierDeliveryRate.toFixed(0)}% delivery
                      </div>
                    </TableCell>
                    <TableCell>{getRiskBadge(pincode.riskLevel)}</TableCell>
                    <TableCell>{getTrendIcon(pincode.trend)}</TableCell>
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
