"use client";

import { useState, useEffect } from "react";
import {
  Save,
  RefreshCcw,
  Info,
  IndianRupee,
  Clock,
  Shield,
  Settings2,
  TrendingUp,
  Sliders,
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { toast } from "sonner";

interface CSRConfig {
  id: string;
  name: string;
  description: string | null;
  costWeight: number;
  speedWeight: number;
  reliabilityWeight: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CSRConfigPage() {
  const [config, setConfig] = useState<CSRConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [costWeight, setCostWeight] = useState(50);
  const [speedWeight, setSpeedWeight] = useState(30);
  const [reliabilityWeight, setReliabilityWeight] = useState(20);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/allocation-config/csr-configs/default");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setCostWeight(Math.round(data.costWeight * 100));
        setSpeedWeight(Math.round(data.speedWeight * 100));
        setReliabilityWeight(Math.round(data.reliabilityWeight * 100));
        setIsActive(data.isActive);
      }
    } catch (error) {
      console.error("Error fetching CSR config:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    const total = costWeight + speedWeight + reliabilityWeight;
    if (total !== 100) {
      toast.error("Weights must sum to 100%");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        cost_weight: costWeight / 100,
        speed_weight: speedWeight / 100,
        reliability_weight: reliabilityWeight / 100,
        is_active: isActive,
      };

      const url = config
        ? `/api/v1/allocation-config/csr-configs/${config.id}`
        : "/api/v1/allocation-config/csr-configs";
      const method = config ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config ? payload : { ...payload, name: "Default CSR Config", is_default: true }),
      });

      if (!response.ok) throw new Error("Failed to save config");
      toast.success("CSR configuration saved");
      fetchConfig();
    } catch (error) {
      console.error("Error saving CSR config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCostChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newCost = parseInt(e.target.value);
    const remaining = 100 - newCost;
    const ratio = speedWeight / (speedWeight + reliabilityWeight) || 0.6;
    setCostWeight(newCost);
    setSpeedWeight(Math.round(remaining * ratio));
    setReliabilityWeight(remaining - Math.round(remaining * ratio));
  }

  function handleSpeedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newSpeed = parseInt(e.target.value);
    const maxSpeed = 100 - costWeight;
    const actualSpeed = Math.min(newSpeed, maxSpeed);
    setSpeedWeight(actualSpeed);
    setReliabilityWeight(100 - costWeight - actualSpeed);
  }

  function handleReliabilityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newReliability = parseInt(e.target.value);
    const maxReliability = 100 - costWeight;
    const actualReliability = Math.min(newReliability, maxReliability);
    setReliabilityWeight(actualReliability);
    setSpeedWeight(100 - costWeight - actualReliability);
  }

  function resetToDefaults() {
    setCostWeight(50);
    setSpeedWeight(30);
    setReliabilityWeight(20);
  }

  const total = costWeight + speedWeight + reliabilityWeight;
  const isValid = total === 100;

  // Calculate example scores
  const exampleCarriers = [
    { name: "Carrier A", cost: 85, speed: 70, reliability: 90 },
    { name: "Carrier B", cost: 70, speed: 95, reliability: 75 },
    { name: "Carrier C", cost: 95, speed: 60, reliability: 85 },
  ];

  const scoredCarriers = exampleCarriers.map((c) => ({
    ...c,
    score: Math.round(
      c.cost * (costWeight / 100) +
      c.speed * (speedWeight / 100) +
      c.reliability * (reliabilityWeight / 100)
    ),
  })).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CSR Score Configuration</h1>
          <p className="text-muted-foreground">
            Configure Cost, Speed, and Reliability weights for carrier allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isValid}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About CSR Scoring</AlertTitle>
        <AlertDescription>
          The CSR (Cost, Speed, Reliability) algorithm calculates a weighted score for each
          carrier. Higher weights mean that factor has more influence on carrier selection.
          The weights must sum to 100%.
        </AlertDescription>
      </Alert>

      {!isValid && (
        <Alert variant="destructive">
          <AlertTitle>Invalid Configuration</AlertTitle>
          <AlertDescription>
            Weights must sum to 100%. Current total: {total}%
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Weight Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              Weight Configuration
            </CardTitle>
            <CardDescription>
              Adjust the importance of each factor in carrier selection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Cost Weight */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <IndianRupee className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <Label className="text-base">Cost Weight</Label>
                    <p className="text-xs text-muted-foreground">
                      Lower shipping cost = higher score
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {costWeight}%
                </Badge>
              </div>
              <input
                type="range"
                value={costWeight}
                onChange={handleCostChange}
                min={0}
                max={100}
                step={5}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
            </div>

            {/* Speed Weight */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <Label className="text-base">Speed Weight</Label>
                    <p className="text-xs text-muted-foreground">
                      Faster delivery = higher score
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {speedWeight}%
                </Badge>
              </div>
              <input
                type="range"
                value={speedWeight}
                onChange={handleSpeedChange}
                min={0}
                max={100 - costWeight}
                step={5}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Reliability Weight */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <Label className="text-base">Reliability Weight</Label>
                    <p className="text-xs text-muted-foreground">
                      Higher success rate = higher score
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {reliabilityWeight}%
                </Badge>
              </div>
              <input
                type="range"
                value={reliabilityWeight}
                onChange={handleReliabilityChange}
                min={0}
                max={100 - costWeight}
                step={5}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total</span>
                <Badge
                  variant={isValid ? "default" : "destructive"}
                  className={isValid ? "bg-green-100 text-green-800" : ""}
                >
                  {total}%
                </Badge>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Allocation</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, carriers are automatically selected using CSR scoring
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Score Preview
            </CardTitle>
            <CardDescription>
              See how carriers would be ranked with current weights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Formula */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Scoring Formula:</p>
                <code className="text-xs">
                  Score = (Cost × {costWeight}%) + (Speed × {speedWeight}%) + (Reliability × {reliabilityWeight}%)
                </code>
              </div>

              {/* Example Carriers */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Example Ranking:</p>
                {scoredCarriers.map((carrier, index) => (
                  <div
                    key={carrier.name}
                    className={`p-4 rounded-lg border ${
                      index === 0 ? "bg-green-50 border-green-200" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-medium">{carrier.name}</span>
                      </div>
                      <Badge
                        className={
                          index === 0
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        Score: {carrier.score}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" />
                        Cost: {carrier.cost}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Speed: {carrier.speed}
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Reliability: {carrier.reliability}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Weight Visualization */}
              <div className="mt-6">
                <p className="text-sm font-medium mb-3">Weight Distribution:</p>
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${costWeight}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${speedWeight}%` }}
                  />
                  <div
                    className="bg-purple-500 transition-all"
                    style={{ width: `${reliabilityWeight}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Cost
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Speed
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Reliability
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Presets</CardTitle>
          <CardDescription>
            Choose a preset configuration based on your business priority
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => {
                setCostWeight(50);
                setSpeedWeight(30);
                setReliabilityWeight(20);
              }}
            >
              <Settings2 className="h-6 w-6" />
              <span className="font-medium">Balanced</span>
              <span className="text-xs text-muted-foreground">50/30/20</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => {
                setCostWeight(70);
                setSpeedWeight(15);
                setReliabilityWeight(15);
              }}
            >
              <IndianRupee className="h-6 w-6 text-green-600" />
              <span className="font-medium">Cost-First</span>
              <span className="text-xs text-muted-foreground">70/15/15</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => {
                setCostWeight(20);
                setSpeedWeight(60);
                setReliabilityWeight(20);
              }}
            >
              <Clock className="h-6 w-6 text-blue-600" />
              <span className="font-medium">Speed-First</span>
              <span className="text-xs text-muted-foreground">20/60/20</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => {
                setCostWeight(20);
                setSpeedWeight(20);
                setReliabilityWeight(60);
              }}
            >
              <Shield className="h-6 w-6 text-purple-600" />
              <span className="font-medium">Reliability-First</span>
              <span className="text-xs text-muted-foreground">20/20/60</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
