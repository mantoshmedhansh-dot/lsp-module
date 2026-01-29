"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  TrendingUp,
  Package,
  MapPin,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Zap,
  BarChart3,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Parse Decimal strings from API (CLAUDE.md Rule 4)
const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value;
};

interface VelocityAnalysis {
  skuId: string;
  skuCode: string;
  skuName: string;
  abcClass: string;
  xyzClass: string;
  pickFrequency: number;
  avgDailyPicks: number;
  currentBin: string;
  currentZone: string;
  optimalZone: string;
  distanceFromOptimal: number;
}

interface Recommendation {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  recommendationType: string;
  fromBinId: string;
  fromBinCode: string;
  suggestedBinId: string;
  suggestedBinCode: string;
  reason: string;
  expectedImprovement: number;
  priorityScore: number;
  status: string;
  createdAt: string;
}

interface SlottingMetrics {
  totalSkus: number;
  optimizedSkus: number;
  pendingRecommendations: number;
  avgPickDistance: number;
  potentialSavings: number;
  aClassSkus: number;
  bClassSkus: number;
  cClassSkus: number;
}

export default function SlottingPage() {
  const [analysis, setAnalysis] = useState<VelocityAnalysis[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [metrics, setMetrics] = useState<SlottingMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/slotting/analysis");
      if (response.ok) {
        const data = await response.json();
        setAnalysis(Array.isArray(data) ? data : data.analysis || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Error fetching analysis:", error);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/slotting/recommendations?status=PENDING");
      if (response.ok) {
        const data = await response.json();
        setRecommendations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/slotting/metrics");
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchAnalysis(), fetchRecommendations(), fetchMetrics()]);
    setIsLoading(false);
  }, [fetchAnalysis, fetchRecommendations, fetchMetrics]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const generateRecommendations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/slotting/optimize", {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Recommendations generated successfully");
        fetchRecommendations();
      } else {
        toast.error("Failed to generate recommendations");
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast.error("Failed to generate recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  const applyRecommendation = async () => {
    if (!selectedRec) return;

    try {
      setIsApplying(true);
      const response = await fetch(`/api/v1/slotting/apply/${selectedRec.id}`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Recommendation applied successfully");
        setShowApplyDialog(false);
        fetchRecommendations();
        fetchMetrics();
      } else {
        toast.error("Failed to apply recommendation");
      }
    } catch (error) {
      console.error("Error applying recommendation:", error);
      toast.error("Failed to apply recommendation");
    } finally {
      setIsApplying(false);
    }
  };

  const getAbcBadge = (abcClass: string) => {
    switch (abcClass) {
      case "A":
        return <Badge className="bg-green-100 text-green-800">A - High</Badge>;
      case "B":
        return <Badge className="bg-yellow-100 text-yellow-800">B - Medium</Badge>;
      case "C":
        return <Badge className="bg-gray-100 text-gray-800">C - Low</Badge>;
      default:
        return <Badge variant="outline">{abcClass}</Badge>;
    }
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slotting Optimization</h1>
          <p className="text-muted-foreground">
            Optimize warehouse bin assignments for picking efficiency
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={generateRecommendations}>
            <Zap className="mr-2 h-4 w-4" />
            Generate Recommendations
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSkus || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.optimizedSkus || 0} optimally placed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {metrics?.pendingRecommendations || recommendations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Recommendations to apply
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Pick Distance</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseDecimal(metrics?.avgPickDistance).toFixed(1)}m
            </div>
            <p className="text-xs text-muted-foreground">
              Per pick operation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {parseDecimal(metrics?.potentialSavings).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              In pick time reduction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ABC Distribution */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>ABC Velocity Distribution</CardTitle>
            <CardDescription>SKU classification based on pick frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">A Class (High Velocity)</span>
                  <span className="text-sm text-muted-foreground">{metrics.aClassSkus}</span>
                </div>
                <Progress value={(metrics.aClassSkus / metrics.totalSkus) * 100} className="h-2 bg-green-100" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">B Class (Medium)</span>
                  <span className="text-sm text-muted-foreground">{metrics.bClassSkus}</span>
                </div>
                <Progress value={(metrics.bClassSkus / metrics.totalSkus) * 100} className="h-2 bg-yellow-100" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">C Class (Low Velocity)</span>
                  <span className="text-sm text-muted-foreground">{metrics.cClassSkus}</span>
                </div>
                <Progress value={(metrics.cClassSkus / metrics.totalSkus) * 100} className="h-2 bg-gray-100" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Velocity Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations
            {recommendations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>SKU Velocity Analysis</CardTitle>
              <CardDescription>ABC/XYZ classification and optimal placement</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : analysis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No analysis data available</p>
                  <Button variant="outline" className="mt-4" onClick={generateRecommendations}>
                    Run Analysis
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>ABC Class</TableHead>
                      <TableHead className="text-center">Daily Picks</TableHead>
                      <TableHead>Current Location</TableHead>
                      <TableHead>Optimal Zone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.slice(0, 20).map((item) => (
                      <TableRow key={item.skuId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.skuCode}</p>
                            <p className="text-sm text-muted-foreground">{item.skuName}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getAbcBadge(item.abcClass)}</TableCell>
                        <TableCell className="text-center font-medium">
                          {parseDecimal(item.avgDailyPicks).toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {item.currentBin} ({item.currentZone})
                          </div>
                        </TableCell>
                        <TableCell>{item.optimalZone}</TableCell>
                        <TableCell>
                          {item.currentZone === item.optimalZone ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Optimal
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Needs Move
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Pending Recommendations</CardTitle>
              <CardDescription>Apply these to optimize warehouse layout</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">No pending recommendations</p>
                  <p className="text-sm text-muted-foreground">Your warehouse is optimally slotted!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead></TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Improvement</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recommendations.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rec.skuCode}</p>
                            <p className="text-sm text-muted-foreground">{rec.skuName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{rec.fromBinCode}</TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono text-green-600">{rec.suggestedBinCode}</TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            +{parseDecimal(rec.expectedImprovement).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>{getPriorityBadge(rec.priorityScore)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRec(rec);
                              setShowApplyDialog(true);
                            }}
                          >
                            Apply
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Slotting Recommendation</DialogTitle>
            <DialogDescription>
              This will create a bin transfer task
            </DialogDescription>
          </DialogHeader>
          {selectedRec && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">SKU</span>
                  <span className="font-medium">{selectedRec.skuCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Move</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{selectedRec.fromBinCode}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-mono text-green-600">{selectedRec.suggestedBinCode}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Expected Improvement</span>
                  <span className="font-medium text-green-600">
                    +{parseDecimal(selectedRec.expectedImprovement).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Reason:</strong> {selectedRec.reason}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={applyRecommendation} disabled={isApplying}>
              {isApplying ? "Applying..." : "Apply Recommendation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
