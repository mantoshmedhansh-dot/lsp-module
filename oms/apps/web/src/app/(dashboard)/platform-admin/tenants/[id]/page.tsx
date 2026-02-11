"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Package, Users, MapPin } from "lucide-react";

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/platform/admin/tenants/${id}`);
      if (!res.ok) throw new Error("Failed to load tenant");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Tenant not found</p>;
  }

  const { company, subscription, plan, usage } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          {company?.name}
        </h1>
        <p className="text-muted-foreground">Code: {company?.code}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{plan?.name || "None"}</p>
            <Badge variant={subscription?.status === "active" ? "default" : "secondary"}>
              {subscription?.status || "none"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Package className="h-4 w-4" /> Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{usage?.ordersCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Users className="h-4 w-4" /> Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{usage?.usersCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <MapPin className="h-4 w-4" /> Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{usage?.locationsCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="font-medium">{company?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Phone</dt>
              <dd className="font-medium">{company?.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">GST</dt>
              <dd className="font-medium">{company?.gst || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">PAN</dt>
              <dd className="font-medium">{company?.pan || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {company?.createdAt ? new Date(company.createdAt).toLocaleDateString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={company?.isActive ? "default" : "secondary"}>
                  {company?.isActive ? "Active" : "Inactive"}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
