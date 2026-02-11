"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Package,
  ShoppingCart,
  Users,
  Check,
  Circle,
  ArrowRight,
  Loader2,
} from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://lsp-oms-api.onrender.com";

const stepConfig = [
  {
    key: "company_profile",
    title: "Company Profile",
    description: "Add your company details like GST, PAN, and address",
    icon: Building2,
    href: "/settings/company",
  },
  {
    key: "first_location",
    title: "Add Your First Location",
    description: "Set up a warehouse, store, or hub",
    icon: MapPin,
    href: "/settings/locations",
  },
  {
    key: "first_sku",
    title: "Add Your First SKU",
    description: "Create a product in your catalog",
    icon: Package,
    href: "/masters/skus",
  },
  {
    key: "first_order",
    title: "Create Your First Order",
    description: "Process a test order end-to-end",
    icon: ShoppingCart,
    href: "/orders/new",
  },
  {
    key: "invite_team",
    title: "Invite Your Team",
    description: "Add team members and assign roles",
    icon: Users,
    href: "/settings/users",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const res = await fetch(`/api/v1/platform/onboarding/status`);
      if (!res.ok) return { steps: [], completedCount: 0, totalCount: 0, isComplete: false };
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (stepKey: string) => {
      const res = await fetch(`/api/v1/platform/onboarding/complete-step/${stepKey}`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  const isStepCompleted = (stepKey: string) => {
    if (!onboarding?.steps) return false;
    const step = onboarding.steps.find(
      (s: { stepKey: string; completed: boolean }) => s.stepKey === stepKey
    );
    return step?.completed || false;
  };

  const completedCount = onboarding?.completedCount || 0;
  const totalCount = onboarding?.totalCount || stepConfig.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome to CJDQuick OMS{session?.user?.companyName ? `, ${session.user.companyName}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete these steps to get the most out of your OMS
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Setup Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} completed
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        {stepConfig.map((step, index) => {
          const completed = isStepCompleted(step.key);
          const StepIcon = step.icon;

          return (
            <Card
              key={step.key}
              className={completed ? "border-green-200 bg-green-50/50" : ""}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    completed
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {completed ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{step.title}</h3>
                    {completed && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        Done
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                <div className="flex-shrink-0 flex gap-2">
                  {!completed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => completeMutation.mutate(step.key)}
                      disabled={completeMutation.isPending}
                    >
                      Skip
                    </Button>
                  )}
                  <Button
                    variant={completed ? "ghost" : "default"}
                    size="sm"
                    onClick={() => router.push(step.href)}
                  >
                    {completed ? "View" : "Start"}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Skip All */}
      {completedCount < totalCount && (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="text-muted-foreground"
          >
            Skip setup and go to dashboard
          </Button>
        </div>
      )}

      {/* All Done */}
      {completedCount >= totalCount && totalCount > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <h3 className="font-semibold text-green-800">
                Setup complete!
              </h3>
              <p className="text-sm text-green-600">
                You&apos;re all set. Head to the dashboard to start managing operations.
              </p>
            </div>
            <Button onClick={() => router.push("/dashboard")}>
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
