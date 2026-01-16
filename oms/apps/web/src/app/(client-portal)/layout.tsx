"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  RotateCcw,
  BarChart3,
  FileText,
  LogOut,
  ChevronDown,
  Bell,
  Search,
  Menu,
  X,
  Gauge,
  Layers,
  ClipboardList,
  Warehouse,
  PackageCheck,
  PackagePlus,
  ClipboardCheck,
  CreditCard,
  Users,
  MapPin,
  Scan,
  History,
  Route,
  FileBox,
  Receipt,
  IndianRupee,
  Scale,
  PackageX,
  CheckSquare,
  Calendar,
  ArrowDownToLine,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

// Analytics Section - Dashboard & Monitoring (NO CONFIG)
const analyticsNav: NavItem[] = [
  {
    name: "Dashboard",
    href: "/client",
    icon: LayoutDashboard,
    children: [
      { name: "Overview", href: "/client" },
    ],
  },
  { name: "Control Tower", href: "/client/control-tower", icon: Gauge },
];

// Channels Section - Marketplace Integrations
const channelsNav: NavItem[] = [
  {
    name: "Channels",
    href: "/client/channels",
    icon: Layers,
    children: [
      { name: "Marketplace Integrations", href: "/client/channels" },
      { name: "Order Sync", href: "/client/channels/sync" },
    ],
  },
];

// Orders Section
const ordersNav: NavItem[] = [
  {
    name: "Orders",
    href: "/client/orders",
    icon: ShoppingCart,
    children: [
      { name: "All Orders", href: "/client/orders" },
      { name: "Order Processing", href: "/client/orders/processing" },
      { name: "Bulk Actions", href: "/client/orders/bulk" },
    ],
  },
];

// Inventory Section
const inventoryNav: NavItem[] = [
  {
    name: "Inventory",
    href: "/client/inventory",
    icon: Package,
    children: [
      { name: "Inventory View", href: "/client/inventory" },
      { name: "Stock Adjustment", href: "/client/inventory/adjustment" },
      { name: "Cycle Count", href: "/client/inventory/cycle-count" },
      { name: "Movement History", href: "/client/inventory/movement" },
      { name: "Virtual Inventory", href: "/client/inventory/virtual" },
    ],
  },
];

// Inbound Section
const inboundNav: NavItem[] = [
  {
    name: "Inbound",
    href: "/client/inbound",
    icon: ArrowDownToLine,
    children: [
      { name: "Purchase Orders", href: "/client/inbound/purchase-orders" },
      { name: "ASN / Receiving", href: "/client/inbound/asn" },
      { name: "Inbound QC", href: "/client/inbound/qc" },
    ],
  },
];

// WMS Section - Warehouse Operations
const wmsNav: NavItem[] = [
  {
    name: "WMS",
    href: "/client/wms",
    icon: Warehouse,
    children: [
      { name: "Wave Picking", href: "/client/wms/waves" },
      { name: "Picklist", href: "/client/wms/picklist" },
      { name: "Packing", href: "/client/wms/packing" },
      { name: "QC Templates", href: "/client/wms/qc/templates" },
      { name: "QC Queue", href: "/client/wms/qc" },
      { name: "Manifest", href: "/client/wms/manifest" },
      { name: "Gate Pass", href: "/client/wms/gate-pass" },
    ],
  },
];

// Logistics Section - Expanded (Industry Standard)
const logisticsNav: NavItem[] = [
  {
    name: "Logistics",
    href: "/client/logistics",
    icon: Truck,
    children: [
      { name: "Shipping Dashboard", href: "/client/logistics/dashboard" },
      { name: "Courier Partners", href: "/client/logistics/transporters" },
      { name: "AWB Management", href: "/client/logistics/awb" },
      { name: "Rate Cards", href: "/client/logistics/rate-cards" },
      { name: "Shipping Rules", href: "/client/logistics/shipping-rules" },
      { name: "Allocation Rules", href: "/client/logistics/allocation-rules" },
      { name: "Service Pincodes", href: "/client/logistics/pincodes" },
      { name: "Tracking", href: "/client/logistics/tracking" },
    ],
  },
];

// Returns & RTO Section - Expanded
const returnsNav: NavItem[] = [
  {
    name: "Returns & RTO",
    href: "/client/returns",
    icon: RotateCcw,
    children: [
      { name: "Return Requests", href: "/client/returns" },
      { name: "RTO Management", href: "/client/returns/rto" },
      { name: "Return QC", href: "/client/returns/qc" },
      { name: "Refund Processing", href: "/client/returns/refunds" },
    ],
  },
];

// Finance & Reconciliation Section - Expanded
const financeNav: NavItem[] = [
  {
    name: "Finance",
    href: "/client/finance",
    icon: CreditCard,
    children: [
      { name: "Finance Dashboard", href: "/client/finance/dashboard" },
      { name: "COD Reconciliation", href: "/client/finance/cod-reconciliation" },
      { name: "Weight Discrepancy", href: "/client/finance/weight-discrepancy" },
      { name: "Freight Billing", href: "/client/finance/freight-billing" },
      { name: "Invoices", href: "/client/finance/invoices" },
      { name: "Payment Ledger", href: "/client/finance/payment-ledger" },
    ],
  },
];

// B2B Section
const b2bNav: NavItem[] = [
  {
    name: "B2B",
    href: "/client/b2b",
    icon: Users,
    children: [
      { name: "Customers", href: "/client/b2b/customers" },
      { name: "Price Lists", href: "/client/b2b/price-lists" },
      { name: "Quotations", href: "/client/b2b/quotations" },
      { name: "Credit Management", href: "/client/b2b/credit" },
    ],
  },
];

// Reports Section
const reportsNav: NavItem[] = [
  {
    name: "Reports",
    href: "/client/reports",
    icon: FileText,
    children: [
      { name: "Sales Reports", href: "/client/reports/sales" },
      { name: "Inventory Reports", href: "/client/reports/inventory" },
      { name: "Logistics Reports", href: "/client/reports/logistics" },
      { name: "Finance Reports", href: "/client/reports/finance" },
      { name: "Scheduled Reports", href: "/client/reports/scheduled" },
    ],
  },
];

// Combine all navigation sections (NO CONFIGURATION)
const navigation: NavItem[] = [
  ...analyticsNav,
  ...channelsNav,
  ...ordersNav,
  ...inventoryNav,
  ...inboundNav,
  ...wmsNav,
  ...logisticsNav,
  ...returnsNav,
  ...financeNav,
  ...b2bNav,
  ...reportsNav,
];

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Auto-expand the active section based on current path
  useEffect(() => {
    const activeSection = navigation.find(item =>
      item.children?.some(child => pathname === child.href) || pathname === item.href
    );
    if (activeSection && !expandedItems.includes(activeSection.name)) {
      setExpandedItems(prev => [...prev, activeSection.name]);
    }
  }, [pathname]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/client");
    }
    // Redirect non-CLIENT users to the main dashboard
    if (status === "authenticated" && session?.user?.role !== "CLIENT") {
      router.push("/dashboard");
    }
  }, [status, router, session?.user?.role]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: NavItem) =>
    item.children?.some(child => pathname === child.href) || pathname === item.href;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } hidden md:flex flex-col bg-slate-800 text-white transition-all duration-300`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          {sidebarOpen ? (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg">Client Portal</span>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto bg-blue-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                      isParentActive(item)
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    } ${!sidebarOpen && "justify-center"}`}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && <span className="ml-3">{item.name}</span>}
                    </div>
                    {sidebarOpen && (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedItems.includes(item.name) ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </button>
                  {sidebarOpen && expandedItems.includes(item.name) && (
                    <div className="pl-12 pb-2 bg-slate-900/30">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block py-2 text-sm transition-colors ${
                            isActive(child.href)
                              ? "text-blue-400 font-medium"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  } ${!sidebarOpen && "justify-center"}`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span className="ml-3">{item.name}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{session.user?.email}</p>
              </div>
              <button
                onClick={() => router.push("/api/v1/auth/signout")}
                className="text-slate-400 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/api/v1/auth/signout")}
              className="mx-auto block text-slate-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800 text-white overflow-y-auto">
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg">Client Portal</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-4">
              {navigation.map((item) => (
                <div key={item.name}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                          isParentActive(item)
                            ? "bg-slate-700 text-white"
                            : "text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className="w-5 h-5 mr-3" />
                          {item.name}
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            expandedItems.includes(item.name) ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {expandedItems.includes(item.name) && (
                        <div className="pl-12 pb-2 bg-slate-900/30">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`block py-2 text-sm transition-colors ${
                                isActive(child.href)
                                  ? "text-blue-400 font-medium"
                                  : "text-slate-400 hover:text-white"
                              }`}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders, SKUs..."
                className="pl-10 pr-4 py-2 w-64 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Date range selector */}
            <select className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>This Month</option>
              <option>Last Month</option>
              <option>Custom Range</option>
            </select>
            <button className="relative p-2 text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
