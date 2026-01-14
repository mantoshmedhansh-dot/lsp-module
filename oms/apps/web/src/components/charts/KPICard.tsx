"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "./Sparkline";

export interface KPICardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  trendData?: number[];
  icon?: React.ReactNode;
  suffix?: string;
  prefix?: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function KPICard({
  title,
  value,
  previousValue,
  change,
  changeLabel,
  trend,
  trendData,
  icon,
  suffix = "",
  prefix = "",
  description,
  variant = "default",
}: KPICardProps) {
  // Determine trend from change if not explicitly provided
  const effectiveTrend = trend || (change !== undefined ? (change > 0 ? "up" : change < 0 ? "down" : "neutral") : "neutral");

  const getTrendColor = () => {
    if (effectiveTrend === "up") return "text-green-600";
    if (effectiveTrend === "down") return "text-red-600";
    return "text-muted-foreground";
  };

  const getTrendIcon = () => {
    if (effectiveTrend === "up") return <TrendingUp className="h-4 w-4" />;
    if (effectiveTrend === "down") return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "border-l-4 border-l-green-500";
      case "warning":
        return "border-l-4 border-l-amber-500";
      case "danger":
        return "border-l-4 border-l-red-500";
      default:
        return "";
    }
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  return (
    <Card className={getVariantStyles()}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">
              {prefix}
              {typeof value === "number" ? value.toLocaleString() : value}
              {suffix}
            </div>
            {(change !== undefined || changeLabel) && (
              <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>
                  {change !== undefined ? formatChange(change) : ""}
                  {changeLabel && ` ${changeLabel}`}
                </span>
              </div>
            )}
            {previousValue !== undefined && (
              <div className="text-xs text-muted-foreground mt-1">
                Previous: {prefix}
                {typeof previousValue === "number"
                  ? previousValue.toLocaleString()
                  : previousValue}
                {suffix}
              </div>
            )}
            {description && (
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            )}
          </div>
          {trendData && trendData.length > 1 && (
            <Sparkline data={trendData} trend={effectiveTrend} height={40} width={80} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
