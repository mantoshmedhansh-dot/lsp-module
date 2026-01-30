"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Package,
  Play,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return parseFloat(value) || 0;
  return value;
};

interface SlottingRecommendation {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  currentBinId: string;
  currentBinCode: string;
  currentZone: string;
  recommendedBinId: string;
  recommendedBinCode: string;
  recommendedZone: string;
  reason: string;
  priority: string;
  estimatedSavings: number;
  pickFrequency: number;
  status: string;
  createdAt: string;
}

interface Summary {
  totalRecommendations: number;
  pendingCount: number;
  approvedCount: number;
  executedCount: number;
  totalEstimatedSavings: number;
}

export default function SlottingRecommendationsPage() {
  const [recommendations, setRecommendations] = useState<SlottingRecommendation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);

      const response = await fetch(`/api/v1/slotting/recommendations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/slotting/recommendations/${id}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Recommendation approved");
        fetchRecommendations();
      }
    } catch (error) {
      toast.error("Failed to approve recommendation");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/slotting/recommendations/${id}/reject`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Recommendation rejected");
        fetchRecommendations();
      }
    } catch (error) {
      toast.error("Failed to reject recommendation");
    }
  };

  const handleExecute = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/slotting/recommendations/${id}/execute`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Move task created");
        fetchRecommendations();
      }
    } catch (error) {
      toast.error("Failed to execute recommendation");
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-blue-100 text-blue-800">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case "EXECUTED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Executed</Badge>;
      case "REJECTED":
        return <Badge variant="secondary">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slotting Recommendations</h1>
          <p className="text-muted-foreground">
            AI-generated suggestions for optimizing product placement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRecommendations}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalRecommendations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.pendingCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.approvedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.executedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {parseDecimal(summary?.totalEstimatedSavings).toFixed(0)} hrs
            </div>
            <p className="text-xs text-muted-foreground">per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="EXECUTED">Executed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Recommendations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Review and approve slotting changes</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : recommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recommendations found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Current Location</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Recommended</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Savings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium font-mono">{rec.skuCode}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-32">{rec.skuName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-mono">{rec.currentBinCode}</p>
                          <p className="text-xs text-muted-foreground">{rec.currentZone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-mono text-green-600">{rec.recommendedBinCode}</p>
                          <p className="text-xs text-muted-foreground">{rec.recommendedZone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm max-w-48 truncate" title={rec.reason}>
                        {rec.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rec.pickFrequency} picks/day
                      </p>
                    </TableCell>
                    <TableCell>{getPriorityBadge(rec.priority)}</TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        {parseDecimal(rec.estimatedSavings).toFixed(1)} hrs
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(rec.status)}</TableCell>
                    <TableCell className="text-right">
                      {rec.status === "PENDING" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleApprove(rec.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleReject(rec.id)}>
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                      {rec.status === "APPROVED" && (
                        <Button size="sm" onClick={() => handleExecute(rec.id)}>
                          <Play className="mr-1 h-4 w-4" />
                          Execute
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
