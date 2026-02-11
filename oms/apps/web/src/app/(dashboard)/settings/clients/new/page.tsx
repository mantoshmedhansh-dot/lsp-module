"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function NewClientPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    legalName: "",
    gst: "",
    pan: "",
    // Contract fields
    serviceModel: "FULL",
    billingType: "per_order",
    billingRate: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("Client code is required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: Create the brand client
      const clientResponse = await fetch("/api/v1/platform/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          legalName: formData.legalName.trim() || null,
          gst: formData.gst.trim() || null,
          pan: formData.pan.trim() || null,
        }),
      });

      if (!clientResponse.ok) {
        const err = await clientResponse.json();
        throw new Error(err.detail || "Failed to create client");
      }

      const client = await clientResponse.json();

      // Step 2: Create the service contract
      const contractResponse = await fetch(
        `/api/v1/platform/clients/${client.id}/contract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lspCompanyId: "", // backend will set this
            brandCompanyId: client.id,
            serviceModel: formData.serviceModel,
            billingType: formData.billingType,
            billingRate: formData.billingRate
              ? parseFloat(formData.billingRate)
              : 0,
            status: "onboarding",
          }),
        }
      );

      if (!contractResponse.ok) {
        // Client created but contract failed — still navigate
        toast.warning(
          "Client created but contract setup failed. You can configure it later."
        );
      } else {
        toast.success(`Client "${formData.name}" onboarded successfully`);
      }

      router.push(`/settings/clients/${client.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to onboard client");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Onboard New Client
          </h1>
          <p className="text-muted-foreground">
            Add a new brand client to your LSP
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Details
            </CardTitle>
            <CardDescription>
              Basic information about the brand client
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Fashion Forward Inc."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Company Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g. FFI"
                maxLength={10}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                value={formData.legalName}
                onChange={(e) =>
                  setFormData({ ...formData, legalName: e.target.value })
                }
                placeholder="Registered legal entity name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gst">GST Number</Label>
                <Input
                  id="gst"
                  value={formData.gst}
                  onChange={(e) =>
                    setFormData({ ...formData, gst: e.target.value })
                  }
                  placeholder="22XXXXX1234X1Z5"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan">PAN Number</Label>
                <Input
                  id="pan"
                  value={formData.pan}
                  onChange={(e) =>
                    setFormData({ ...formData, pan: e.target.value })
                  }
                  placeholder="XXXXX1234X"
                  maxLength={10}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Contract */}
        <Card>
          <CardHeader>
            <CardTitle>Service Contract</CardTitle>
            <CardDescription>
              Define the service model and billing terms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceModel">Service Model</Label>
              <Select
                value={formData.serviceModel}
                onValueChange={(v) =>
                  setFormData({ ...formData, serviceModel: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">
                    Full (Warehousing + Logistics)
                  </SelectItem>
                  <SelectItem value="WAREHOUSING">
                    Warehousing Only (3PL)
                  </SelectItem>
                  <SelectItem value="LOGISTICS">
                    Logistics Only (Carrier)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingType">Billing Type</Label>
              <Select
                value={formData.billingType}
                onValueChange={(v) =>
                  setFormData({ ...formData, billingType: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_order">Per Order</SelectItem>
                  <SelectItem value="per_sqft">
                    Per Sq.Ft (Warehouse)
                  </SelectItem>
                  <SelectItem value="fixed">Fixed Monthly</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingRate">Billing Rate</Label>
              <Input
                id="billingRate"
                type="number"
                step="0.01"
                min="0"
                value={formData.billingRate}
                onChange={(e) =>
                  setFormData({ ...formData, billingRate: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? "Onboarding..." : "Onboard Client"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
