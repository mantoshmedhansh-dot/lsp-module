"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface FillRateChartProps {
  fillRate: number;
  targetRate?: number;
  title?: string;
  height?: number;
}

export function FillRateChart({
  fillRate,
  targetRate = 98,
  title = "Fill Rate",
  height = 200,
}: FillRateChartProps) {
  const data = [
    {
      name: "Target",
      value: targetRate,
      fill: "#e5e7eb",
    },
    {
      name: "Actual",
      value: Math.min(fillRate, 100),
      fill: fillRate >= targetRate ? "#22c55e" : fillRate >= targetRate - 5 ? "#f59e0b" : "#ef4444",
    },
  ];

  const status =
    fillRate >= targetRate
      ? { text: "On Target", color: "text-green-600" }
      : fillRate >= targetRate - 5
      ? { text: "Below Target", color: "text-yellow-600" }
      : { text: "Critical", color: "text-red-600" };

  return (
    <div className="w-full">
      <div className="text-center mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="80%"
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={5}
            background={{ fill: "#f3f4f6" }}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, ""]}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-16">
        <div className="text-3xl font-bold">{fillRate.toFixed(1)}%</div>
        <div className={`text-sm ${status.color}`}>{status.text}</div>
        <div className="text-xs text-gray-500 mt-1">Target: {targetRate}%</div>
      </div>
    </div>
  );
}
