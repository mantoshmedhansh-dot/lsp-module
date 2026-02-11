"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock } from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredModule?: string;
}

const MODULE_LABELS: Record<string, string> = {
  OMS: "Order Management",
  WMS: "Warehouse Management",
  LOGISTICS: "Logistics & Shipping",
  CONTROL_TOWER: "Command Center",
  FINANCE: "Finance & Billing",
  ANALYTICS: "Reports & Analytics",
  CHANNELS: "Channels & Marketplace",
};

export function UpgradeModal({
  open,
  onOpenChange,
  requiredModule,
}: UpgradeModalProps) {
  const router = useRouter();
  const { plan } = useSubscription();

  const { data: plans } = useQuery({
    queryKey: ["available-plans"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/plans");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const availablePlans = Array.isArray(plans) ? plans : plans?.items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Upgrade Required
          </DialogTitle>
          <DialogDescription>
            {requiredModule
              ? `The ${MODULE_LABELS[requiredModule] || requiredModule} module is not included in your current plan.`
              : "Upgrade your plan to unlock more features."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {availablePlans
            .filter((p: { slug: string }) => p.slug !== "free")
            .map((p: {
              id: string;
              slug: string;
              name: string;
              monthlyPrice: number;
              modules: { module: string }[];
            }) => {
              const isCurrent = plan?.slug === p.slug;
              const hasRequiredModule = requiredModule
                ? p.modules?.some((m) => m.module === requiredModule)
                : true;

              return (
                <div
                  key={p.id}
                  className={`rounded-lg border-2 p-4 ${
                    hasRequiredModule
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {isCurrent && (
                      <Badge variant="outline">Current</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold mb-3">
                    ₹{parseFloat(String(p.monthlyPrice)).toLocaleString("en-IN")}
                    <span className="text-sm font-normal text-muted-foreground">
                      /mo
                    </span>
                  </p>
                  <ul className="space-y-1 mb-4">
                    {p.modules?.map((m) => (
                      <li
                        key={m.module}
                        className="text-sm flex items-center gap-1"
                      >
                        <Check
                          className={`h-3 w-3 ${
                            m.module === requiredModule
                              ? "text-blue-600"
                              : "text-green-500"
                          }`}
                        />
                        <span
                          className={
                            m.module === requiredModule ? "font-medium" : ""
                          }
                        >
                          {MODULE_LABELS[m.module] || m.module}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={hasRequiredModule ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/settings/billing?upgrade=${p.slug}`);
                    }}
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
