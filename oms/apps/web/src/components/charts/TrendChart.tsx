"use client";

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendChartProps {
  data: Array<{ date: string; value: number }>;
  title?: string;
  valueLabel?: string;
  valueFormatter?: (value: number) => string;
  color?: string;
  showTrend?: boolean;
  trendDirection?: "up" | "down" | "flat";
  trendPercent?: number;
  targetValue?: number;
  height?: number;
}

export function TrendChart({
  data,
  title,
  valueLabel = "Value",
  valueFormatter = (v) => v.toLocaleString(),
  color = "#3b82f6",
  showTrend = true,
  trendDirection,
  trendPercent,
  targetValue,
  height = 200,
}: TrendChartProps) {
  // Calculate trend if not provided
  const calculatedTrend = (() => {
    if (trendDirection) return { direction: trendDirection, percent: trendPercent || 0 };
    if (data.length < 2) return { direction: "flat" as const, percent: 0 };

    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstAvg =
      firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

    const percentChange =
      firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

    const direction =
      percentChange > 5 ? "up" : percentChange < -5 ? "down" : "flat";

    return { direction: direction as "up" | "down" | "flat", percent: percentChange };
  })();

  const TrendIcon =
    calculatedTrend.direction === "up"
      ? TrendingUp
      : calculatedTrend.direction === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    calculatedTrend.direction === "up"
      ? "text-green-600"
      : calculatedTrend.direction === "down"
      ? "text-red-600"
      : "text-gray-500";

  // Calculate current and previous totals
  const currentTotal = data.slice(-7).reduce((sum, d) => sum + d.value, 0);
  const averageValue =
    data.length > 0 ? data.reduce((sum, d) => sum + d.value, 0) / data.length : 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h3 className="text-sm font-medium text-gray-700">{title}</h3>}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{valueFormatter(currentTotal)}</span>
            {showTrend && (
              <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                <span>
                  {calculatedTrend.percent > 0 ? "+" : ""}
                  {calculatedTrend.percent}%
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Avg: {valueFormatter(Math.round(averageValue))}</div>
          {targetValue && <div>Target: {valueFormatter(targetValue)}</div>}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
            }
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value: number | undefined) => [valueFormatter(value ?? 0), valueLabel]}
            labelFormatter={(label) => {
              const date = new Date(label);
              return date.toLocaleDateString();
            }}
          />
          {targetValue && (
            <ReferenceLine
              y={targetValue}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: "Target", position: "right", fontSize: 10 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color.replace("#", "")})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
