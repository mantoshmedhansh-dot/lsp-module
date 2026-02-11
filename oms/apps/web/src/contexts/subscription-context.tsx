"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

interface PlanLimit {
  limitKey: string;
  limitValue: number;
}

interface PlanModule {
  module: string;
}

interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  modules: PlanModule[];
  limits: PlanLimit[];
}

interface UsageData {
  ordersCount: number;
  skusCount: number;
  usersCount: number;
  locationsCount: number;
  apiCallsCount: number;
}

interface SubscriptionContextType {
  plan: SubscriptionPlan | null;
  usage: UsageData | null;
  limits: Record<string, number>;
  subscriptionStatus: string | null;
  isTrialing: boolean;
  daysLeftInTrial: number;
  hasModule: (module: string) => boolean;
  isWithinLimit: (key: string, currentValue?: number) => boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  plan: null,
  usage: null,
  limits: {},
  subscriptionStatus: null,
  isTrialing: false,
  daysLeftInTrial: 0,
  hasModule: () => true,
  isWithinLimit: () => true,
  isLoading: true,
  isSuperAdmin: false,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["subscription-current"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/subscriptions/current");
      if (!res.ok) return { subscription: null, plan: null };
      return res.json();
    },
    enabled: !!session?.user && !isSuperAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["subscription-usage"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/usage/current");
      if (!res.ok) return { usage: null, limits: {} };
      return res.json();
    },
    enabled: !!session?.user && !isSuperAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const subscription = subData?.subscription;
  const plan = subData?.plan;
  const usage = usageData?.usage;
  const limits = usageData?.limits || {};

  const isTrialing = subscription?.status === "trialing";
  const daysLeftInTrial = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const hasModule = (module: string): boolean => {
    if (isSuperAdmin) return true;
    if (!plan?.modules) return false;
    return plan.modules.some((m: PlanModule) => m.module === module);
  };

  const isWithinLimit = (key: string, currentValue?: number): boolean => {
    if (isSuperAdmin) return true;
    const limit = limits[key];
    if (limit === undefined || limit === -1) return true; // -1 = unlimited
    const current = currentValue ?? (usage as Record<string, number>)?.[key + "Count"] ?? 0;
    return current < limit;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        usage,
        limits,
        subscriptionStatus: subscription?.status || null,
        isTrialing,
        daysLeftInTrial,
        hasModule,
        isWithinLimit,
        isLoading: subLoading || usageLoading,
        isSuperAdmin,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
