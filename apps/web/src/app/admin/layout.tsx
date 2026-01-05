"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Truck,
  Users,
  Route,
  Navigation,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Package,
  ScanLine,
  Box,
  Handshake,
  Layers,
  Globe,
  TrendingUp,
  Warehouse,
  Link2,
  BarChart3,
  Target,
  Leaf,
  Shield,
  Radio,
  ShoppingCart,
  FileText,
  PackageCheck,
  PackageX,
  Send,
  ClipboardCheck,
} from "lucide-react";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { HubSelector } from "@/components/admin/HubSelector";
import { UserMenu } from "@/components/admin/UserMenu";

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Phase I: Hub Network",
    items: [
      { name: "Hubs", href: "/admin/hubs", icon: Building2 },
      { name: "Pincode Coverage", href: "/admin/pincodes", icon: MapPin },
    ],
  },
  {
    name: "Phase II: Fleet",
    items: [
      { name: "Vehicles", href: "/admin/vehicles", icon: Truck },
      { name: "Drivers", href: "/admin/drivers", icon: Users },
    ],
  },
  {
    name: "Phase III: Transport",
    items: [
      { name: "Routes", href: "/admin/routes", icon: Route },
      { name: "Trips", href: "/admin/trips", icon: Navigation },
    ],
  },
  {
    name: "Phase IV: Shipments",
    items: [
      { name: "All Shipments", href: "/admin/shipments", icon: Package },
      { name: "Consignments", href: "/admin/consignments", icon: Layers },
      { name: "Journey Plans", href: "/admin/journeys", icon: TrendingUp },
    ],
  },
  {
    name: "Orders & Fulfillment",
    items: [
      { name: "All Orders", href: "/admin/orders", icon: ShoppingCart },
      { name: "Manifest", href: "/admin/orders/manifest", icon: FileText },
      { name: "Pick", href: "/admin/orders/pick", icon: PackageCheck },
      { name: "Pack", href: "/admin/orders/pack", icon: Box },
      { name: "Dispatch", href: "/admin/orders/dispatch", icon: Send },
      { name: "Delivery", href: "/admin/orders/delivery", icon: Truck },
      { name: "POD", href: "/admin/orders/pod", icon: ClipboardCheck },
    ],
  },
  {
    name: "Operations",
    items: [
      { name: "Hub Scanning", href: "/admin/scanning", icon: ScanLine },
      { name: "Partner Handovers", href: "/admin/handovers", icon: Handshake },
      { name: "Partner Zones", href: "/admin/partner-zones", icon: Globe },
      { name: "Control Tower", href: "/control-tower", icon: Radio },
    ],
  },
  {
    name: "Scale & Analytics",
    items: [
      { name: "WMS", href: "/wms", icon: Warehouse },
      { name: "ERP Integrations", href: "/integrations", icon: Link2 },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      { name: "Capacity Planning", href: "/capacity", icon: Target },
      { name: "Carbon Footprint", href: "/carbon", icon: Leaf },
      { name: "Insurance", href: "/insurance", icon: Shield },
    ],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <AdminAuthGuard>
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary-500" />
              <span className="font-bold text-lg">CJDarcl Quick</span>
            </div>
          )}
          {collapsed && <Package className="h-8 w-8 text-primary-500 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navigation.map((item) => (
            <div key={item.name}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-800 transition-colors ${
                    pathname === item.href
                      ? "bg-primary-600 text-white"
                      : "text-gray-300"
                  }`}
                >
                  {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              ) : (
                <div>
                  {!collapsed && (
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
                      {item.name}
                    </div>
                  )}
                  {item.items?.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
                        pathname === subItem.href
                          ? "bg-primary-600 text-white"
                          : "text-gray-300"
                      } ${!collapsed ? "pl-6" : ""}`}
                    >
                      <subItem.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{subItem.name}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          {!collapsed && (
            <div className="text-xs text-gray-500">
              <p>Admin Panel</p>
              <p>v1.0.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            {pathname !== "/admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="font-medium">Home</span>
              </Link>
            )}
            <HubSelector />
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              View Site
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
    </AdminAuthGuard>
  );
}
