"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Check, ArrowRight } from "lucide-react";
import Link from "next/link";

// Use relative URL to go through Next.js API proxy (avoids CORS issues)

const signupSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  adminName: z.string().min(2, "Name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupFormData = z.infer<typeof signupSchema>;

const plans = [
  {
    slug: "free",
    name: "Free Trial",
    price: "₹0",
    period: "14 days",
    features: ["OMS Module", "100 orders/month", "50 SKUs", "2 users", "1 location"],
    highlight: false,
  },
  {
    slug: "starter",
    name: "Starter",
    price: "₹3,999",
    period: "/month",
    features: [
      "OMS + WMS",
      "1,000 orders/month",
      "500 SKUs",
      "5 users",
      "3 locations",
      "Basic API",
    ],
    highlight: false,
  },
  {
    slug: "growth",
    name: "Growth",
    price: "₹11,999",
    period: "/month",
    features: [
      "OMS + WMS + Logistics",
      "10,000 orders/month",
      "5,000 SKUs",
      "20 users",
      "10 locations",
      "Full API",
    ],
    highlight: true,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "₹39,999",
    period: "/month",
    features: [
      "All modules",
      "Unlimited orders",
      "Unlimited SKUs",
      "Unlimited users",
      "Unlimited locations",
      "Full API + Webhooks",
    ],
    highlight: false,
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("free");

  const selectedPlanData = plans.find((p) => p.slug === selectedPlan);
  const buttonLabel =
    selectedPlan === "free"
      ? "Start Free Trial"
      : `Get Started with ${selectedPlanData?.name}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call signup endpoint
      const response = await fetch(`/api/v1/platform/onboarding/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          planSlug: selectedPlan,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setError(err.detail || "Signup failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Auto-login via NextAuth
      const result = await signIn("credentials", {
        email: data.adminEmail,
        password: data.adminPassword,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but login failed. Please login manually.");
        router.push("/login");
      } else {
        router.push("/onboarding");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold">CJDQuick OMS</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">
            {selectedPlan === "free"
              ? "Start your free trial"
              : `Get started with ${selectedPlanData?.name}`}
          </h1>
          <p className="mt-2 text-slate-600">
            {selectedPlan === "free"
              ? "14 days free. No credit card required."
              : "Set up your account and start using CJDQuick OMS."}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Signup Form */}
          <Card className="order-2 lg:order-1">
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Set up your company and admin account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Logistics Pvt Ltd"
                    {...register("companyName")}
                  />
                  {errors.companyName && (
                    <p className="text-sm text-red-500">
                      {errors.companyName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminName">Your Name</Label>
                  <Input
                    id="adminName"
                    placeholder="John Doe"
                    {...register("adminName")}
                  />
                  {errors.adminName && (
                    <p className="text-sm text-red-500">
                      {errors.adminName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="john@acme.com"
                    {...register("adminEmail")}
                  />
                  {errors.adminEmail && (
                    <p className="text-sm text-red-500">
                      {errors.adminEmail.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Password</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Min 6 characters"
                    {...register("adminPassword")}
                  />
                  {errors.adminPassword && (
                    <p className="text-sm text-red-500">
                      {errors.adminPassword.message}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      {buttonLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-blue-600 hover:underline">
                    Log in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <div className="order-1 lg:order-2 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Select a plan
            </h3>
            {plans.map((plan) => (
              <button
                key={plan.slug}
                type="button"
                onClick={() => setSelectedPlan(plan.slug)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedPlan === plan.slug
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                } ${plan.highlight ? "ring-1 ring-blue-200" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {plan.name}
                    </span>
                    {plan.highlight && (
                      <Badge variant="secondary" className="text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <span className="font-bold text-slate-900">
                    {plan.price}
                    <span className="text-sm font-normal text-slate-500">
                      {plan.period}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {plan.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-sm text-slate-600 flex items-center gap-1"
                    >
                      <Check className="h-3 w-3 text-green-500" />
                      {feature}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
