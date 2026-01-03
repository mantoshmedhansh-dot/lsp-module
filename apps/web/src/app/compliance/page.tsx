"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";
import {
  FileCheck,
  Truck,
  Receipt,
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";

interface ComplianceStats {
  ulip: {
    integrations: number;
    activeVerifications: number;
    pendingVerifications: number;
  };
  ewayBills: {
    total: number;
    active: number;
    expiringSoon: number;
    generated: number;
  };
  einvoices: {
    total: number;
    generated: number;
    pending: number;
    failed: number;
  };
}

export default function CompliancePage() {
  const [stats, setStats] = useState<ComplianceStats>({
    ulip: { integrations: 0, activeVerifications: 0, pendingVerifications: 0 },
    ewayBills: { total: 0, active: 0, expiringSoon: 0, generated: 0 },
    einvoices: { total: 0, generated: 0, pending: 0, failed: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [ulipRes, ewayRes, einvoiceRes] = await Promise.all([
          fetch("/api/compliance/ulip"),
          fetch("/api/compliance/eway-bill"),
          fetch("/api/compliance/einvoice"),
        ]);

        const [ulipData, ewayData, einvoiceData] = await Promise.all([
          ulipRes.json(),
          ewayRes.json(),
          einvoiceRes.json(),
        ]);

        setStats({
          ulip: {
            integrations: ulipData.data?.items?.length || 0,
            activeVerifications: 0,
            pendingVerifications: 0,
          },
          ewayBills: {
            total: ewayData.data?.pagination?.total || 0,
            active: ewayData.data?.summary?.active || 0,
            expiringSoon: ewayData.data?.summary?.expiringSoon || 0,
            generated: ewayData.data?.summary?.generated || 0,
          },
          einvoices: {
            total: einvoiceData.data?.pagination?.total || 0,
            generated: einvoiceData.data?.summary?.generated || 0,
            pending: einvoiceData.data?.summary?.pending || 0,
            failed: einvoiceData.data?.summary?.failed || 0,
          },
        });
      } catch (error) {
        console.error("Failed to fetch compliance stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const modules = [
    {
      title: "ULIP Integration",
      description: "Unified Logistics Interface Platform - Connect with 129 government APIs for vehicle verification and cargo tracking.",
      icon: ShieldCheck,
      href: "/compliance/ulip",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      stats: [
        { label: "Integrations", value: stats.ulip.integrations },
        { label: "Active Verifications", value: stats.ulip.activeVerifications },
      ],
    },
    {
      title: "E-way Bill",
      description: "GST E-way Bill generation and management for goods movement exceeding Rs. 50,000.",
      icon: Truck,
      href: "/compliance/eway-bills",
      color: "text-green-600",
      bgColor: "bg-green-50",
      stats: [
        { label: "Active", value: stats.ewayBills.active },
        { label: "Expiring Soon", value: stats.ewayBills.expiringSoon, alert: true },
      ],
    },
    {
      title: "E-Invoice",
      description: "GST E-Invoice generation via IRP portal for B2B transactions.",
      icon: Receipt,
      href: "/compliance/einvoices",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      stats: [
        { label: "Generated", value: stats.einvoices.generated },
        { label: "Pending", value: stats.einvoices.pending, alert: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
        <p className="text-muted-foreground">
          Manage GST compliance, ULIP integration, and regulatory requirements
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total E-way Bills</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : stats.ewayBills.total}</div>
            <p className="text-xs text-muted-foreground">{stats.ewayBills.active} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">E-Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : stats.einvoices.total}</div>
            <p className="text-xs text-muted-foreground">{stats.einvoices.generated} generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ULIP Status</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : stats.ulip.integrations}</div>
            <p className="text-xs text-muted-foreground">Active integrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98%</div>
            <p className="text-xs text-muted-foreground">All systems healthy</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {(stats.ewayBills.expiringSoon > 0 || stats.einvoices.pending > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-800" />
            <h3 className="font-semibold text-amber-800">Attention Required</h3>
          </div>
          <div className="space-y-2">
            {stats.ewayBills.expiringSoon > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span>{stats.ewayBills.expiringSoon} E-way bills expiring within 24 hours</span>
                </div>
                <Link href="/compliance/eway-bills?filter=expiring">
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              </div>
            )}
            {stats.einvoices.pending > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white p-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  <span>{stats.einvoices.pending} E-invoices pending generation</span>
                </div>
                <Link href="/compliance/einvoices?filter=pending">
                  <Button variant="outline" size="sm">Generate</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Modules */}
      <div className="grid gap-6 md:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.title} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${module.bgColor}`}>
                  <module.icon className={`h-6 w-6 ${module.color}`} />
                </div>
                <Badge variant="info">Mandatory</Badge>
              </div>
              <CardTitle className="mt-4">{module.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-4 grid grid-cols-2 gap-4">
                {module.stats.map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className={`text-xl font-bold ${stat.alert && stat.value > 0 ? "text-amber-600" : ""}`}>
                      {loading ? "-" : stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="p-6 pt-0">
              <Link href={module.href}>
                <Button className="w-full" variant="outline">
                  Manage <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Compliance Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Latest compliance actions and updates</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { type: "E-way Bill", action: "Generated", id: "EWB123456789", time: "2 minutes ago", icon: Truck, color: "text-green-600" },
              { type: "E-Invoice", action: "IRN Created", id: "INV/2024/001234", time: "15 minutes ago", icon: Receipt, color: "text-purple-600" },
              { type: "ULIP", action: "Vehicle Verified", id: "MH12AB1234", time: "1 hour ago", icon: ShieldCheck, color: "text-blue-600" },
              { type: "E-way Bill", action: "Extended", id: "EWB987654321", time: "3 hours ago", icon: Truck, color: "text-amber-600" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted p-2">
                    <activity.icon className={`h-4 w-4 ${activity.color}`} />
                  </div>
                  <div>
                    <div className="font-medium">{activity.type} {activity.action}</div>
                    <div className="text-sm text-muted-foreground">{activity.id}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{activity.time}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
