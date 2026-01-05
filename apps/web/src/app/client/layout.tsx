"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  HeadphonesIcon,
  Calculator,
  Layers,
  Settings,
  Warehouse,
  Building2,
  FileText,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  LogOut,
} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/client",
    icon: LayoutDashboard,
  },
  {
    name: "Orders",
    items: [
      { name: "All Orders", href: "/client/orders", icon: ShoppingCart },
      { name: "Create Order", href: "/client/orders/new", icon: Package },
      { name: "Bulk Upload", href: "/client/orders/bulk", icon: Layers },
    ],
  },
  {
    name: "Pickups",
    items: [
      { name: "Pickup Requests", href: "/client/pickups", icon: Truck },
      { name: "Schedule Pickup", href: "/client/pickups/new", icon: Truck },
    ],
  },
  {
    name: "Exceptions",
    items: [
      { name: "All Exceptions", href: "/client/exceptions", icon: AlertTriangle },
      { name: "NDR", href: "/client/exceptions/ndr", icon: AlertTriangle },
      { name: "Weight Disputes", href: "/client/exceptions/weight", icon: AlertTriangle },
    ],
  },
  {
    name: "Support",
    href: "/client/support",
    icon: HeadphonesIcon,
  },
  {
    name: "Tools",
    items: [
      { name: "Rate Calculator", href: "/client/rate-calculator", icon: Calculator },
      { name: "Services", href: "/client/services", icon: Layers },
    ],
  },
  {
    name: "Setup",
    items: [
      { name: "My Facilities", href: "/client/facilities", icon: Warehouse },
      { name: "Bank Details", href: "/client/bank", icon: Building2 },
      { name: "Documents", href: "/client/documents", icon: FileText },
    ],
  },
  {
    name: "Billing",
    items: [
      { name: "Invoices", href: "/client/billing", icon: CreditCard },
      { name: "COD Remittance", href: "/client/billing/cod", icon: CreditCard },
    ],
  },
  {
    name: "Settings",
    href: "/client/settings",
    icon: Settings,
  },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Mock client data - will be replaced with actual auth
  const client = {
    companyName: "Demo Company",
    userName: "Ashish Kumar",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } bg-white border-r transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-primary-600" />
              <span className="font-bold text-lg text-gray-900">CJDarcl Quick</span>
            </div>
          )}
          {collapsed && <Package className="h-8 w-8 text-primary-600 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
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
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    pathname === item.href
                      ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              ) : (
                <div>
                  {!collapsed && (
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4">
                      {item.name}
                    </div>
                  )}
                  {item.items?.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        pathname === subItem.href
                          ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
                          : "text-gray-600 hover:bg-gray-50"
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

        {/* User Info */}
        {!collapsed && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {client.userName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {client.companyName}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">
              Hi, {client.userName.split(" ")[0]}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search AWB or Order..."
                className="w-64 px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {/* Quick Actions */}
            <Link
              href="/client/orders/new"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Order
            </Link>
            {/* Notifications */}
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            {/* User Menu */}
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
