"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScanLine,
  Package,
  Handshake,
  Truck,
  Building2,
} from "lucide-react";

const navItems = [
  {
    href: "/operations/scanning",
    label: "Hub Scanning",
    icon: ScanLine,
    description: "Scan shipments at hubs",
  },
  {
    href: "/operations/consignments",
    label: "Consignments",
    icon: Package,
    description: "Manage consignments",
  },
  {
    href: "/operations/handovers",
    label: "Partner Handovers",
    icon: Handshake,
    description: "Partner delivery handovers",
  },
];

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-8 h-14">
            <Link href="/operations" className="font-semibold text-gray-900">
              Operations
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
