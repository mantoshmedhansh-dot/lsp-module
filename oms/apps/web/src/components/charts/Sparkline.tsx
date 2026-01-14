"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";

export interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
  strokeWidth?: number;
  trend?: "up" | "down" | "neutral";
}

export function Sparkline({
  data,
  color,
  height = 32,
  width = 100,
  showDot = false,
  strokeWidth = 2,
  trend,
}: SparklineProps) {
  // Convert array to recharts format
  const chartData = data.map((value, index) => ({ value, index }));

  // Determine color based on trend or provided color
  const getColor = () => {
    if (color) return color;
    if (trend === "up") return "#22c55e";
    if (trend === "down") return "#ef4444";
    return "#3b82f6";
  };

  // Calculate min/max for proper scaling
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const padding = (maxValue - minValue) * 0.1;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis
            domain={[minValue - padding, maxValue + padding]}
            hide
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            dot={showDot}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
