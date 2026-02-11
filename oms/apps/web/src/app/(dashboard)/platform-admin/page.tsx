"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Building2, Users, TrendingUp, CreditCard } from "lucide-react";

export default function PlatformAdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/admin/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Tenants",
      value: stats?.totalTenants || 0,
      icon: Building2,
      description: "Registered companies",
    },
    {
      title: "Active Subscriptions",
      value: stats?.activeSubscriptions || 0,
      icon: Users,
      description: `${stats?.trialingCount || 0} trialing`,
    },
    {
      title: "MRR",
      value: `₹${(stats?.mrr || 0).toLocaleString("en-IN")}`,
      icon: TrendingUp,
      description: `ARR: ₹${(stats?.arr || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Revenue This Month",
      value: `₹${(stats?.revenueThisMonth || 0).toLocaleString("en-IN")}`,
      icon: CreditCard,
      description: "From paid invoices",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <p className="text-muted-foreground">Revenue dashboard and tenant management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Distribution */}
      {stats?.planDistribution && Object.keys(stats.planDistribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.planDistribution).map(([planName, count]) => (
                <div key={planName} className="flex items-center justify-between">
                  <span className="font-medium">{planName}</span>
                  <span className="text-muted-foreground">{count as number} tenants</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
