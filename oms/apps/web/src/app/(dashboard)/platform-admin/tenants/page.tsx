"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Eye } from "lucide-react";

export default function TenantsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "100");
      const res = await fetch(`/api/v1/platform/admin/tenants?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const tenantList = Array.isArray(tenants) ? tenants : tenants?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Tenants</h1>
          <p className="text-muted-foreground">Manage tenant companies</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or code..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantList.map((t: {
                  company: { id: string; name: string; code: string; createdAt: string };
                  subscription: { planName: string; status: string; trialEndsAt: string } | null;
                }) => (
                  <TableRow key={t.company.id}>
                    <TableCell className="font-medium">{t.company.name}</TableCell>
                    <TableCell>{t.company.code}</TableCell>
                    <TableCell>{t.subscription?.planName || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.subscription?.status === "active"
                            ? "default"
                            : t.subscription?.status === "trialing"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {t.subscription?.status || "none"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.subscription?.trialEndsAt
                        ? new Date(t.subscription.trialEndsAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {new Date(t.company.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/platform-admin/tenants/${t.company.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenantList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tenants found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
