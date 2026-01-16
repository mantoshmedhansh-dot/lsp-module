"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AgingBucket {
  label: string;
  value: number;
  quantity: number;
}

interface InventoryAgingChartProps {
  data: AgingBucket[];
  title?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

const AGING_COLORS = [
  "#22c55e", // 0-30 days - green
  "#84cc16", // 31-60 days - lime
  "#f59e0b", // 61-90 days - amber
  "#f97316", // 91-120 days - orange
  "#ef4444", // >120 days - red
];

export function InventoryAgingChart({
  data,
  title = "Inventory Aging",
  valueFormatter = (v) =>
    v.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
  height = 250,
}: InventoryAgingChartProps) {
  const totalValue = data.reduce((sum, bucket) => sum + bucket.value, 0);
  const totalQuantity = data.reduce((sum, bucket) => sum + bucket.quantity, 0);

  // Calculate percentages
  const enrichedData = data.map((bucket, index) => ({
    ...bucket,
    percentage: totalValue > 0 ? (bucket.value / totalValue) * 100 : 0,
    color: AGING_COLORS[index] || AGING_COLORS[AGING_COLORS.length - 1],
  }));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className="text-right text-xs text-gray-500">
          <div>Total: {valueFormatter(totalValue)}</div>
          <div>{totalQuantity.toLocaleString()} units</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={enrichedData} layout="vertical" margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) =>
              value >= 100000
                ? `${(value / 100000).toFixed(1)}L`
                : value >= 1000
                ? `${(value / 1000).toFixed(0)}k`
                : value.toString()
            }
          />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={80} />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => {
              if (name === "value") return [valueFormatter(value ?? 0), "Value"];
              return [value ?? 0, name ?? ""];
            }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;
              const data = payload[0].payload as AgingBucket & {
                percentage: number;
                color: string;
              };
              return (
                <div className="bg-white p-2 border rounded shadow-sm text-xs">
                  <div className="font-medium">{data.label}</div>
                  <div>Value: {valueFormatter(data.value)}</div>
                  <div>Quantity: {data.quantity.toLocaleString()}</div>
                  <div>Share: {data.percentage.toFixed(1)}%</div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {enrichedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
        {enrichedData.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: bucket.color }}
            />
            <span>{bucket.label}</span>
            <span className="text-gray-500">({bucket.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
