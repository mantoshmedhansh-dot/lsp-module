"use client";

import { useSubscription } from "@/contexts/subscription-context";

interface UsageBarProps {
  label: string;
  limitKey: string;
  usageKey: string;
  className?: string;
}

export function UsageBar({ label, limitKey, usageKey, className }: UsageBarProps) {
  const { usage, limits, isSuperAdmin } = useSubscription();

  if (isSuperAdmin) return null;

  const limit = limits[limitKey];
  if (limit === undefined || limit === -1) return null; // Unlimited

  const current = (usage as Record<string, number> | null)?.[usageKey] ?? 0;
  const percent = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={
            isAtLimit
              ? "text-red-600 font-medium"
              : isNearLimit
                ? "text-amber-600"
                : "text-muted-foreground"
          }
        >
          {current.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isAtLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-amber-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function UsageSummary() {
  const { isSuperAdmin } = useSubscription();

  if (isSuperAdmin) return null;

  return (
    <div className="space-y-2 px-3 py-2">
      <UsageBar label="Orders" limitKey="orders_per_month" usageKey="ordersCount" />
      <UsageBar label="SKUs" limitKey="skus" usageKey="skusCount" />
      <UsageBar label="Users" limitKey="users" usageKey="usersCount" />
    </div>
  );
}
