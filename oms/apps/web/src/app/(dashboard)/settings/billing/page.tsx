"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, CreditCard, Loader2, ExternalLink } from "lucide-react";
import { useSubscription } from "@/contexts/subscription-context";
import { UsageBar } from "@/components/subscription/usage-bar";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { plan, subscriptionStatus, isTrialing, daysLeftInTrial } = useSubscription();
  const success = searchParams.get("success");

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/plans");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/billing/invoices");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      const res = await fetch("/api/v1/platform/subscriptions/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingCycle: "monthly" }),
      });
      if (!res.ok) throw new Error("Failed to change plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-current"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-usage"] });
    },
  });

  const availablePlans = Array.isArray(plans) ? plans : plans?.items || [];
  const invoiceList = Array.isArray(invoices) ? invoices : invoices?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan and billing</p>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-800 font-medium">
            Plan upgraded successfully!
          </p>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {isTrialing
              ? `Free trial - ${daysLeftInTrial} days remaining`
              : `${plan?.name || "No plan"} plan`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {plan?.name || "Free Trial"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={subscriptionStatus === "active" ? "default" : "secondary"}>
                  {subscriptionStatus || "trialing"}
                </Badge>
                {plan?.monthlyPrice && (
                  <span className="text-muted-foreground">
                    ₹{parseFloat(String(plan.monthlyPrice)).toLocaleString("en-IN")}/month
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label="Orders" limitKey="orders_per_month" usageKey="ordersCount" />
          <UsageBar label="SKUs" limitKey="skus" usageKey="skusCount" />
          <UsageBar label="Users" limitKey="users" usageKey="usersCount" />
          <UsageBar label="Locations" limitKey="locations" usageKey="locationsCount" />
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {availablePlans.map((p: {
                id: string;
                slug: string;
                name: string;
                description: string;
                monthlyPrice: number;
                annualPrice: number;
                modules: { module: string }[];
                limits: { limitKey: string; limitValue: number }[];
              }) => {
                const isCurrent = plan?.slug === p.slug;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border-2 p-4 ${
                      isCurrent ? "border-blue-600 bg-blue-50/50" : "border-slate-200"
                    }`}
                  >
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {p.description}
                    </p>
                    <p className="text-2xl font-bold mb-4">
                      ₹{parseFloat(String(p.monthlyPrice)).toLocaleString("en-IN")}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>

                    <ul className="space-y-1.5 mb-4">
                      {p.modules?.map((m) => (
                        <li key={m.module} className="text-sm flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-green-500" />
                          {m.module}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || changePlanMutation.isPending}
                      onClick={() => changePlanMutation.mutate(p.slug)}
                    >
                      {isCurrent ? "Current Plan" : changePlanMutation.isPending ? "Changing..." : "Select Plan"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceList.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No invoices yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceList.map((inv: {
                  id: string;
                  invoiceNumber: string;
                  amount: number;
                  currency: string;
                  status: string;
                  createdAt: string;
                  invoiceUrl: string;
                }) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoiceNumber || inv.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      ₹{parseFloat(String(inv.amount)).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {inv.invoiceUrl && (
                        <a href={inv.invoiceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
