"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Star,
  IndianRupee,
  BarChart3,
  Download,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface CarrierPerformance {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierCode: string;
  shipmentType: string;
  period: string;
  totalShipments: number;
  delivered: number;
  rto: number;
  inTransit: number;
  deliveryRate: number;
  rtoRate: number;
  avgTatDays: number;
  onTimeDeliveryRate: number;
  avgCostPerShipment: number;
  reliabilityScore: number;
  costScore: number;
  speedScore: number;
  overallScore: number;
  trend: string;
}

const SHIPMENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "FTL", label: "FTL" },
  { value: "B2B_PTL", label: "B2B/PTL" },
  { value: "B2C", label: "B2C" },
];

const PERIODS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "ytd", label: "Year to Date" },
];

export default function CarrierScorecardsPage() {
  const [carriers, setCarriers] = useState<CarrierPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("30d");

  useEffect(() => {
    fetchCarrierPerformance();
  }, [typeFilter, periodFilter]);

  async function fetchCarrierPerformance() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.set("shipment_type", typeFilter);
      params.set("period", periodFilter);
      params.set("limit", "50");

      const response = await fetch(`/api/v1/analytics/carrier-scorecard?${params}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();
      setCarriers(Array.isArray(result) ? result : result.data || []);
    } catch (error) {
      console.error("Error fetching carriers:", error);
      toast.error("Failed to load carrier performance");
    } finally {
      setIsLoading(false);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  }

  function getScoreBg(score: number): string {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-yellow-100";
    return "bg-red-100";
  }

  function getTrendIcon(trend: string) {
    if (trend === "UP") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "DOWN") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const filteredCarriers = carriers.filter((c) =>
    c.carrierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Top performers
  const topByReliability = [...carriers].sort((a, b) => b.reliabilityScore - a.reliabilityScore).slice(0, 3);
  const topBySpeed = [...carriers].sort((a, b) => b.speedScore - a.speedScore).slice(0, 3);
  const topByCost = [...carriers].sort((a, b) => b.costScore - a.costScore).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carrier Scorecards</h1>
          <p className="text-muted-foreground">
            Performance metrics and rankings for all carriers
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search carriers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {SHIPMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]">
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

      {/* Top Performers */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Top Reliability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topByReliability.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <span className="text-sm">{c.carrierName}</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {c.reliabilityScore.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Top Speed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topBySpeed.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <span className="text-sm">{c.carrierName}</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    {c.speedScore.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-500" />
              Best Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topByCost.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <span className="text-sm">{c.carrierName}</span>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">
                    {c.costScore.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Cards */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredCarriers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No carrier data found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredCarriers.map((carrier) => (
            <Card key={carrier.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full ${getScoreBg(carrier.overallScore)} flex items-center justify-center`}>
                      <span className={`text-lg font-bold ${getScoreColor(carrier.overallScore)}`}>
                        {carrier.overallScore.toFixed(0)}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{carrier.carrierName}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {carrier.carrierCode}
                        {getTrendIcon(carrier.trend)}
                        <Badge variant="outline" className="text-xs">
                          {carrier.shipmentType}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{carrier.totalShipments}</p>
                    <p className="text-xs text-muted-foreground">Shipments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {carrier.deliveryRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Delivery Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {carrier.rtoRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">RTO Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {carrier.avgTatDays.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg TAT (days)</p>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Reliability
                      </span>
                      <span className="text-sm font-medium">{carrier.reliabilityScore.toFixed(1)}%</span>
                    </div>
                    <Progress value={carrier.reliabilityScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Speed
                      </span>
                      <span className="text-sm font-medium">{carrier.speedScore.toFixed(1)}%</span>
                    </div>
                    <Progress value={carrier.speedScore} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" /> Cost Efficiency
                      </span>
                      <span className="text-sm font-medium">{carrier.costScore.toFixed(1)}%</span>
                    </div>
                    <Progress value={carrier.costScore} className="h-2" />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    On-Time: {carrier.onTimeDeliveryRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg Cost: {formatCurrency(carrier.avgCostPerShipment)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
