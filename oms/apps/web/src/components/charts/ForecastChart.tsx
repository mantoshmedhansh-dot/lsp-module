"use client";

import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface ForecastDataPoint {
  date: string;
  actual?: number;
  forecast?: number;
  lowEstimate?: number;
  highEstimate?: number;
}

interface ForecastChartProps {
  data: ForecastDataPoint[];
  title?: string;
  valueFormatter?: (value: number) => string;
  trendDirection?: "up" | "down" | "stable";
  trendPercent?: number;
  currentStock?: number;
  reorderPoint?: number;
  height?: number;
}

export function ForecastChart({
  data,
  title = "Demand Forecast",
  valueFormatter = (v) => v.toLocaleString(),
  trendDirection = "stable",
  trendPercent = 0,
  currentStock,
  reorderPoint,
  height = 300,
}: ForecastChartProps) {
  const TrendIcon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
      ? TrendingDown
      : Minus;

  const trendColor =
    trendDirection === "up"
      ? "text-green-600"
      : trendDirection === "down"
      ? "text-red-600"
      : "text-gray-500";

  // Calculate totals
  const actualTotal = data.reduce((sum, d) => sum + (d.actual || 0), 0);
  const forecastTotal = data.reduce((sum, d) => sum + (d.forecast || 0), 0);

  // Check if stock warning needed
  const stockWarning =
    currentStock !== undefined &&
    reorderPoint !== undefined &&
    currentStock < reorderPoint;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          <div className="flex items-center gap-4 mt-1">
            <div>
              <span className="text-xs text-gray-500">Historical: </span>
              <span className="font-semibold">{valueFormatter(actualTotal)}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Forecast: </span>
              <span className="font-semibold text-blue-600">
                {valueFormatter(forecastTotal)}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {trendPercent > 0 ? "+" : ""}
              {trendPercent}%
            </span>
          </div>
          {stockWarning && (
            <div className="flex items-center gap-1 text-yellow-600 text-xs mt-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Reorder needed</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1} />
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
            formatter={(value: number | undefined, name: string | undefined) => {
              const labels: Record<string, string> = {
                actual: "Historical",
                forecast: "Forecast",
                highEstimate: "High Estimate",
                lowEstimate: "Low Estimate",
              };
              return [valueFormatter(value ?? 0), labels[name ?? ""] || name || ""];
            }}
            labelFormatter={(label) => {
              const date = new Date(label);
              return date.toLocaleDateString();
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                actual: "Historical",
                forecast: "Forecast",
              };
              return labels[value] || value;
            }}
          />

          {/* Confidence interval area */}
          <Area
            type="monotone"
            dataKey="highEstimate"
            stroke="none"
            fill="url(#confidenceGradient)"
            stackId="confidence"
          />

          {/* Historical bars */}
          <Bar
            dataKey="actual"
            fill="#64748b"
            radius={[2, 2, 0, 0]}
            barSize={12}
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stock status */}
      {currentStock !== undefined && (
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div>
            <span className="text-gray-500">Current Stock: </span>
            <span className={stockWarning ? "text-red-600 font-medium" : ""}>
              {valueFormatter(currentStock)}
            </span>
          </div>
          {reorderPoint !== undefined && (
            <div>
              <span className="text-gray-500">Reorder Point: </span>
              <span>{valueFormatter(reorderPoint)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
