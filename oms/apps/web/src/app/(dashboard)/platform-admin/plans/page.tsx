"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";

export default function PlansManagementPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/plans?active_only=false");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const planList = Array.isArray(plans) ? plans : plans?.items || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plans Management</h1>
        <p className="text-muted-foreground">View and manage subscription plans</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {planList.map((plan: {
          id: string;
          slug: string;
          name: string;
          description: string;
          monthlyPrice: number;
          annualPrice: number;
          isActive: boolean;
          modules: { module: string }[];
          limits: { limitKey: string; limitValue: number }[];
        }) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.isActive ? "default" : "secondary"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold">
                  ₹{parseFloat(String(plan.monthlyPrice)).toLocaleString("en-IN")}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  ₹{parseFloat(String(plan.annualPrice)).toLocaleString("en-IN")}/yr
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Modules</h4>
                <ul className="space-y-1">
                  {plan.modules?.map((m) => (
                    <li key={m.module} className="text-sm flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-500" />
                      {m.module}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Limits</h4>
                <ul className="space-y-1">
                  {plan.limits?.map((l) => (
                    <li key={l.limitKey} className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">{l.limitKey.replace(/_/g, " ")}</span>
                      <span className="font-medium">
                        {l.limitValue === -1 ? "Unlimited" : l.limitValue.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
