"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@cjdquick/ui";
import {
  FileCheck,
  Truck,
  Receipt,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";

const complianceNav = [
  {
    title: "Overview",
    href: "/compliance",
    icon: LayoutDashboard,
  },
  {
    title: "ULIP Integration",
    href: "/compliance/ulip",
    icon: ShieldCheck,
    description: "Unified Logistics Interface Platform",
  },
  {
    title: "E-way Bills",
    href: "/compliance/eway-bills",
    icon: Truck,
    description: "GST E-way Bill Management",
  },
  {
    title: "E-Invoices",
    href: "/compliance/einvoices",
    icon: Receipt,
    description: "GST E-Invoice (IRP)",
  },
];

export default function ComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-muted/30 p-4">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileCheck className="h-5 w-5" />
            Compliance
          </h2>
          <p className="text-sm text-muted-foreground">
            GST & Regulatory Compliance
          </p>
        </div>

        <nav className="space-y-1">
          {complianceNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/compliance" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <div>
                  <div className="font-medium">{item.title}</div>
                  {item.description && (
                    <div
                      className={cn(
                        "text-xs",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {item.description}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Quick Stats */}
        <div className="mt-8 rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-medium">Compliance Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ULIP</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Active
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-way Bill</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Connected
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-Invoice</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Enabled
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
