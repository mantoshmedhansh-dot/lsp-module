"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SLAGaugeProps {
  title: string;
  value: number;
  target: number;
  suffix?: string;
  size?: "sm" | "md" | "lg";
}

export function SLAGauge({
  title,
  value,
  target,
  suffix = "%",
  size = "md",
}: SLAGaugeProps) {
  const percentage = Math.min(100, Math.max(0, (value / target) * 100));
  const remaining = 100 - percentage;

  // Determine color based on performance
  const getColor = () => {
    if (value >= target) return "#22c55e"; // Green - exceeding
    if (value >= target * 0.95) return "#f59e0b"; // Amber - close
    if (value >= target * 0.9) return "#f97316"; // Orange - at risk
    return "#ef4444"; // Red - critical
  };

  const data = [
    { value: percentage, color: getColor() },
    { value: remaining, color: "#e5e7eb" },
  ];

  const heights = {
    sm: 120,
    md: 160,
    lg: 200,
  };

  const innerRadius = {
    sm: 35,
    md: 50,
    lg: 65,
  };

  const outerRadius = {
    sm: 50,
    md: 70,
    lg: 90,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div style={{ width: "100%", height: heights[size] }} className="relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={innerRadius[size]}
                outerRadius={outerRadius[size]}
                paddingAngle={0}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ paddingTop: size === "lg" ? "40px" : "30px" }}
          >
            <span
              className={`font-bold ${
                size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-xl"
              }`}
              style={{ color: getColor() }}
            >
              {value.toFixed(1)}
              {suffix}
            </span>
            <span className="text-xs text-muted-foreground">
              Target: {target}
              {suffix}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getColor() }}
          />
          <span className="text-sm text-muted-foreground">
            {value >= target
              ? "Exceeding Target"
              : value >= target * 0.95
                ? "Near Target"
                : value >= target * 0.9
                  ? "At Risk"
                  : "Below Target"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
