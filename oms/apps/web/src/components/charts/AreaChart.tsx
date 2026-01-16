"use client";

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface AreaChartDataPoint {
  name: string;
  [key: string]: string | number;
}

export interface AreaConfig {
  dataKey: string;
  color: string;
  name?: string;
  fillOpacity?: number;
  stackId?: string;
}

export interface AreaChartProps {
  title?: string;
  description?: string;
  data: AreaChartDataPoint[];
  areas: AreaConfig[];
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number | undefined, name: string | undefined) => [string, string];
}

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function AreaChart({
  title,
  description,
  data,
  areas,
  xAxisKey = "name",
  height = 300,
  showGrid = true,
  showLegend = true,
  yAxisFormatter,
  tooltipFormatter,
}: AreaChartProps) {
  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          {areas.map((area, index) => (
            <linearGradient
              key={`gradient-${area.dataKey}`}
              id={`color-${area.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={area.color || COLORS[index % COLORS.length]}
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor={area.color || COLORS[index % COLORS.length]}
                stopOpacity={0.1}
              />
            </linearGradient>
          ))}
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={tooltipFormatter}
        />
        {showLegend && <Legend />}
        {areas.map((area, index) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name || area.dataKey}
            stroke={area.color || COLORS[index % COLORS.length]}
            fill={`url(#color-${area.dataKey})`}
            fillOpacity={area.fillOpacity || 1}
            stackId={area.stackId}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );

  if (!title) return chart;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  );
}
