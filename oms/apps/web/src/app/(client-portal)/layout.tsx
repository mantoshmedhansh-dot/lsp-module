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
  Warehouse,
  CreditCard,
  ArrowDownToLine,
  PackageOpen,
  Boxes,
  BadgeCheck,
  Tags,
  Route,
  Store,
  Settings,
  Gauge,
  Building2,
  Send,
  MapPin,
  FileBox,
  ClipboardCheck,
  Container,
  TruckIcon,
  Users,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE TYPES
// ═══════════════════════════════════════════════════════════════════════════
type ServiceType = "OMS_WMS" | "B2C_COURIER" | "B2B_LOGISTICS";

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION SECTIONS (Industry Standard WMS/OMS Structure)
// ═══════════════════════════════════════════════════════════════════════════

// Dashboard
const dashboardNav: NavItem = {
  name: "Dashboard",
  href: "/client",
  icon: LayoutDashboard,
};

// ═══════════════════════════════════════════════════════════════════════════
// B2C COURIER SERVICE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

const b2cDashboardNav: NavItem = {
  name: "Dashboard",
  href: "/client/b2c",
  icon: LayoutDashboard,
};

const b2cShipmentsNav: NavItem = {
  name: "Shipments",
  href: "/client/b2c/shipments",
  icon: Send,
  children: [
    { name: "All Shipments", href: "/client/b2c/shipments" },
    { name: "Create Shipment", href: "/client/b2c/shipments/new" },
    { name: "Bulk Upload", href: "/client/b2c/shipments/bulk" },
  ],
};

const b2cTrackingNav: NavItem = {
  name: "Tracking",
  href: "/client/logistics/tracking",
  icon: Truck,
};

const b2cNdrNav: NavItem = {
  name: "NDR Management",
  href: "/client/control-tower/ndr",
  icon: Gauge,
};

const b2cPickupNav: NavItem = {
  name: "Pickup Addresses",
  href: "/client/b2c/pickup-addresses",
  icon: MapPin,
};

const b2cFinanceNav: NavItem = {
  name: "Finance",
  href: "/client/finance/cod-reconciliation",
  icon: CreditCard,
  children: [
    { name: "COD Remittance", href: "/client/finance/cod-reconciliation" },
    { name: "Freight Charges", href: "/client/finance/freight-billing" },
    { name: "Weight Disputes", href: "/client/finance/weight-discrepancy" },
    { name: "Invoices", href: "/client/finance/invoices" },
  ],
};

const b2cReportsNav: NavItem = {
  name: "Reports",
  href: "/client/reports/logistics",
  icon: BarChart3,
  children: [
    { name: "Delivery Reports", href: "/client/reports/logistics" },
    { name: "COD Reports", href: "/client/reports/finance" },
  ],
};

const b2cSettingsNav: NavItem = {
  name: "Settings",
  href: "/client/logistics/rate-cards",
  icon: Settings,
  children: [
    { name: "Rate Card", href: "/client/logistics/rate-cards" },
    { name: "Company Profile", href: "/client/settings" },
  ],
};

// B2C Navigation Groups
const b2cNavItems: NavItem[] = [
  b2cDashboardNav,
  b2cShipmentsNav,
  b2cTrackingNav,
  b2cNdrNav,
  b2cPickupNav,
  b2cFinanceNav,
  b2cReportsNav,
  b2cSettingsNav,
];

// ═══════════════════════════════════════════════════════════════════════════
// B2B LOGISTICS SERVICE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

const b2bDashboardNav: NavItem = {
  name: "Dashboard",
  href: "/client/b2b-logistics",
  icon: LayoutDashboard,
};

const b2bBookingsNav: NavItem = {
  name: "Bookings",
  href: "/client/b2b-logistics/bookings",
  icon: FileBox,
  children: [
    { name: "All Bookings", href: "/client/b2b-logistics/bookings" },
    { name: "Book LTL", href: "/client/b2b-logistics/bookings/ltl" },
    { name: "Book FTL", href: "/client/b2b-logistics/bookings/ftl" },
  ],
};

const b2bLrNav: NavItem = {
  name: "LR Management",
  href: "/client/b2b-logistics/lr",
  icon: FileText,
  children: [
    { name: "All LRs", href: "/client/b2b-logistics/lr" },
    { name: "Create LR", href: "/client/b2b-logistics/lr/new" },
  ],
};

const b2bTrackingNav: NavItem = {
  name: "Tracking",
  href: "/client/b2b-logistics/tracking",
  icon: TruckIcon,
  children: [
    { name: "Vehicle Tracking", href: "/client/b2b-logistics/tracking" },
    { name: "Shipment Status", href: "/client/b2b-logistics/tracking/shipments" },
  ],
};

const b2bPodNav: NavItem = {
  name: "POD Management",
  href: "/client/b2b-logistics/pod",
  icon: ClipboardCheck,
};

const b2bConsigneeNav: NavItem = {
  name: "Consignees",
  href: "/client/b2b-logistics/consignees",
  icon: Users,
};

const b2bFreightFinanceNav: NavItem = {
  name: "Finance",
  href: "/client/b2b-logistics/finance",
  icon: CreditCard,
  children: [
    { name: "Freight Invoices", href: "/client/b2b-logistics/finance/invoices" },
    { name: "Credit Limits", href: "/client/b2b-logistics/finance/credit" },
    { name: "Payment History", href: "/client/b2b-logistics/finance/payments" },
  ],
};

const b2bFreightReportsNav: NavItem = {
  name: "Reports",
  href: "/client/b2b-logistics/reports",
  icon: BarChart3,
  children: [
    { name: "Delivery Reports", href: "/client/b2b-logistics/reports/delivery" },
    { name: "Cost Analysis", href: "/client/b2b-logistics/reports/cost" },
  ],
};

const b2bFreightSettingsNav: NavItem = {
  name: "Settings",
  href: "/client/b2b-logistics/settings",
  icon: Settings,
  children: [
    { name: "Rate Agreement", href: "/client/b2b-logistics/settings/rates" },
    { name: "Company Profile", href: "/client/settings" },
  ],
};

// B2B Navigation Groups
const b2bNavItems: NavItem[] = [
  b2bDashboardNav,
  b2bBookingsNav,
  b2bLrNav,
  b2bTrackingNav,
  b2bPodNav,
  b2bConsigneeNav,
  b2bFreightFinanceNav,
  b2bFreightReportsNav,
  b2bFreightSettingsNav,
];

// Control Tower
const controlTowerNav: NavItem = {
  name: "Control Tower",
  href: "/client/control-tower",
  icon: Gauge,
  children: [
    { name: "Overview", href: "/client/control-tower" },
    { name: "Exception Management", href: "/client/control-tower/exceptions" },
    { name: "NDR Command Center", href: "/client/control-tower/ndr" },
    { name: "AI Actions", href: "/client/control-tower/ai-actions" },
    { name: "Detection Rules", href: "/client/control-tower/rules" },
  ],
};

// ═══ OPERATIONS ═══

const ordersNav: NavItem = {
  name: "Orders",
  href: "/client/orders",
  icon: ShoppingCart,
  children: [
    { name: "All Orders", href: "/client/orders" },
    { name: "Order Processing", href: "/client/orders/processing" },
    { name: "Bulk Actions", href: "/client/orders/bulk" },
  ],
};

const fulfillmentNav: NavItem = {
  name: "Fulfillment",
  href: "/client/wms",
  icon: PackageOpen,
  children: [
    { name: "Wave Planning", href: "/client/wms/waves" },
    { name: "Pick Lists", href: "/client/wms/picklist" },
    { name: "Packing Station", href: "/client/wms/packing" },
    { name: "Manifest & Handover", href: "/client/wms/manifest" },
    { name: "Gate Pass", href: "/client/wms/gate-pass" },
  ],
};

const inboundNav: NavItem = {
  name: "Inbound",
  href: "/client/inbound",
  icon: ArrowDownToLine,
  children: [
    { name: "Purchase Orders", href: "/client/inbound/purchase-orders" },
    { name: "ASN / Receiving", href: "/client/inbound/asn" },
  ],
};

const inventoryNav: NavItem = {
  name: "Inventory",
  href: "/client/inventory",
  icon: Boxes,
  children: [
    { name: "Stock View", href: "/client/inventory" },
    { name: "Stock Adjustments", href: "/client/inventory/adjustment" },
    { name: "Cycle Count", href: "/client/inventory/cycle-count" },
    { name: "Movement History", href: "/client/inventory/movement" },
  ],
};

const shippingNav: NavItem = {
  name: "Shipping & Logistics",
  href: "/client/logistics",
  icon: Truck,
  children: [
    { name: "Shipment Tracking", href: "/client/logistics/tracking" },
    { name: "AWB Management", href: "/client/logistics/awb" },
  ],
};

const returnsNav: NavItem = {
  name: "Returns",
  href: "/client/returns",
  icon: RotateCcw,
  children: [
    { name: "Customer Returns", href: "/client/returns" },
    { name: "RTO Management", href: "/client/returns/rto" },
    { name: "Return QC", href: "/client/returns/qc" },
    { name: "Refund Processing", href: "/client/returns/refunds" },
  ],
};

const qcNav: NavItem = {
  name: "Quality Control",
  href: "/client/inbound/qc",
  icon: BadgeCheck,
  children: [
    { name: "QC Queue", href: "/client/wms/qc" },
    { name: "Inbound QC", href: "/client/inbound/qc" },
    { name: "QC Templates", href: "/client/wms/qc/templates" },
  ],
};

// ═══ ANALYTICS & FINANCE ═══

const financeNav: NavItem = {
  name: "Finance",
  href: "/client/finance",
  icon: CreditCard,
  children: [
    { name: "COD Reconciliation", href: "/client/finance/cod-reconciliation" },
    { name: "Freight Billing", href: "/client/finance/freight-billing" },
    { name: "Weight Discrepancy", href: "/client/finance/weight-discrepancy" },
    { name: "Payment Ledger", href: "/client/finance/payment-ledger" },
  ],
};

const reportsNav: NavItem = {
  name: "Reports",
  href: "/client/reports",
  icon: BarChart3,
  children: [
    { name: "Sales Reports", href: "/client/reports/sales" },
    { name: "Inventory Reports", href: "/client/reports/inventory" },
    { name: "Logistics Reports", href: "/client/reports/logistics" },
    { name: "Finance Reports", href: "/client/reports/finance" },
    { name: "Scheduled Reports", href: "/client/reports/scheduled" },
  ],
};

// ═══ CONFIGURATION ═══

const catalogNav: NavItem = {
  name: "Catalog",
  href: "/client/settings/skus",
  icon: Tags,
  children: [
    { name: "SKU Master", href: "/client/settings/skus" },
    { name: "B2B Customers", href: "/client/b2b/customers" },
  ],
};

const logisticsSetupNav: NavItem = {
  name: "Logistics Setup",
  href: "/client/logistics/transporters",
  icon: Route,
  children: [
    { name: "Courier Partners", href: "/client/logistics/transporters" },
    { name: "Rate Cards", href: "/client/logistics/rate-cards" },
    { name: "Shipping Rules", href: "/client/logistics/shipping-rules" },
    { name: "Allocation Rules", href: "/client/logistics/allocation-rules" },
    { name: "Serviceability", href: "/client/logistics/pincodes" },
  ],
};

const channelsNav: NavItem = {
  name: "Channels",
  href: "/client/channels",
  icon: Store,
  children: [
    { name: "Marketplace Integrations", href: "/client/channels" },
    { name: "Sync Settings", href: "/client/channels/sync" },
  ],
};

const settingsNav: NavItem = {
  name: "Settings",
  href: "/client/settings",
  icon: Settings,
  children: [
    { name: "Company Profile", href: "/client/settings" },
    { name: "My Contract", href: "/client/my-contract" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION GROUPS
// ═══════════════════════════════════════════════════════════════════════════

const operationsNav: NavItem[] = [
  ordersNav,
  fulfillmentNav,
  inboundNav,
  inventoryNav,
  shippingNav,
  returnsNav,
  qcNav,
];

const analyticsNav: NavItem[] = [
  financeNav,
  reportsNav,
];

const configNav: NavItem[] = [
  catalogNav,
  logisticsSetupNav,
  channelsNav,
  settingsNav,
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
  const [activeService, setActiveService] = useState<ServiceType>("OMS_WMS");
  const [contractServiceModel, setContractServiceModel] = useState<string | null>(null);

  // Fetch contract to determine service model filtering
  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch("/api/v1/platform/brand-portal/my-contract");
        if (res.ok) {
          const data = await res.json();
          setContractServiceModel(data.contract?.serviceModel || null);
        }
      } catch {
        // silent
      }
    }
    fetchContract();
  }, []);

  // Detect active service from URL
  useEffect(() => {
    if (pathname.startsWith("/client/b2c")) {
      setActiveService("B2C_COURIER");
    } else if (pathname.startsWith("/client/b2b-logistics")) {
      setActiveService("B2B_LOGISTICS");
    } else {
      setActiveService("OMS_WMS");
    }
  }, [pathname]);

  // Get navigation items based on active service and contract service model
  const getNavItems = () => {
    let items: NavItem[];
    switch (activeService) {
      case "B2C_COURIER":
        items = b2cNavItems;
        break;
      case "B2B_LOGISTICS":
        items = b2bNavItems;
        break;
      default:
        items = [dashboardNav, controlTowerNav, ...operationsNav, ...analyticsNav, ...configNav];
        break;
    }

    // Filter by contract service model (Feature 7)
    if (contractServiceModel && activeService === "OMS_WMS") {
      const inventoryNames = ["Inventory", "Inbound", "QC", "Quality Control"];
      const shippingNames = ["Shipping", "Tracking", "Logistics Setup"];
      if (contractServiceModel === "WAREHOUSING") {
        items = items.filter((i) => !shippingNames.includes(i.name));
      } else if (contractServiceModel === "LOGISTICS") {
        items = items.filter((i) => !inventoryNames.includes(i.name));
      }
      // FULL: show all
    }

    return items;
  };

  // All navigation items combined for active detection
  const allNavItems = getNavItems();

  // Auto-expand the active section based on current path
  useEffect(() => {
    const activeSection = allNavItems.find(item =>
      item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/")) ||
      pathname === item.href
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isParentActive = (item: NavItem) =>
    item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + "/")) ||
    pathname === item.href;

  // Render a nav item
  const renderNavItem = (item: NavItem, closeMobile: boolean = false) => (
    <div key={item.name}>
      {item.children ? (
        <>
          <button
            onClick={() => toggleExpanded(item.name)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
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
            <div className="pl-12 pb-1 bg-slate-900/30">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`block py-1.5 text-sm transition-colors ${
                    isActive(child.href)
                      ? "text-blue-400 font-medium"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={closeMobile ? () => setMobileMenuOpen(false) : undefined}
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
          className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-slate-700 text-white"
              : "text-slate-300 hover:bg-slate-700 hover:text-white"
          } ${!sidebarOpen && "justify-center"}`}
          onClick={closeMobile ? () => setMobileMenuOpen(false) : undefined}
        >
          <item.icon className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && <span className="ml-3">{item.name}</span>}
        </Link>
      )}
    </div>
  );

  // Render section label
  const renderSectionLabel = (label: string) => (
    sidebarOpen && (
      <div className="px-4 py-2 mt-4 first:mt-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
    )
  );

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
              <div className="flex flex-col">
                <span className="font-bold text-base">CJDQuick</span>
                <span className="text-xs text-slate-400">Client Portal</span>
              </div>
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
        <nav className="flex-1 py-2 overflow-y-auto">
          {activeService === "OMS_WMS" ? (
            <>
              {/* Dashboard */}
              {renderNavItem(dashboardNav)}

              {/* Control Tower Section */}
              {renderSectionLabel("Control Tower")}
              {renderNavItem(controlTowerNav)}

              {/* Operations Section */}
              {renderSectionLabel("Operations")}
              {operationsNav.map(item => renderNavItem(item))}

              {/* Analytics & Finance Section */}
              {renderSectionLabel("Analytics & Finance")}
              {analyticsNav.map(item => renderNavItem(item))}

              {/* Configuration Section */}
              {renderSectionLabel("Configuration")}
              {configNav.map(item => renderNavItem(item))}
            </>
          ) : activeService === "B2C_COURIER" ? (
            <>
              {/* B2C Courier Navigation */}
              {b2cNavItems.map(item => renderNavItem(item))}
            </>
          ) : (
            <>
              {/* B2B Logistics Navigation */}
              {b2bNavItems.map(item => renderNavItem(item))}
            </>
          )}
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
                <div className="flex flex-col">
                  <span className="font-bold text-base">CJDQuick</span>
                  <span className="text-xs text-slate-400">Client Portal</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="py-2">
              {activeService === "OMS_WMS" ? (
                <>
                  {/* Dashboard */}
                  {renderNavItem(dashboardNav, true)}

                  {/* Control Tower Section */}
                  <div className="px-4 py-2 mt-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Control Tower
                    </span>
                  </div>
                  {renderNavItem(controlTowerNav, true)}

                  {/* Operations Section */}
                  <div className="px-4 py-2 mt-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Operations
                    </span>
                  </div>
                  {operationsNav.map(item => renderNavItem(item, true))}

                  {/* Analytics & Finance Section */}
                  <div className="px-4 py-2 mt-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Analytics & Finance
                    </span>
                  </div>
                  {analyticsNav.map(item => renderNavItem(item, true))}

                  {/* Configuration Section */}
                  <div className="px-4 py-2 mt-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Configuration
                    </span>
                  </div>
                  {configNav.map(item => renderNavItem(item, true))}
                </>
              ) : activeService === "B2C_COURIER" ? (
                <>
                  {/* B2C Courier Navigation */}
                  {b2cNavItems.map(item => renderNavItem(item, true))}
                </>
              ) : (
                <>
                  {/* B2B Logistics Navigation */}
                  {b2bNavItems.map(item => renderNavItem(item, true))}
                </>
              )}
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

            {/* Service Selector */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setActiveService("OMS_WMS");
                  router.push("/client");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeService === "OMS_WMS"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <span className="hidden sm:inline">OMS + WMS</span>
                <span className="sm:hidden">OMS</span>
              </button>
              <button
                onClick={() => {
                  setActiveService("B2C_COURIER");
                  router.push("/client/b2c");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeService === "B2C_COURIER"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <span className="hidden sm:inline">B2C Courier</span>
                <span className="sm:hidden">B2C</span>
              </button>
              <button
                onClick={() => {
                  setActiveService("B2B_LOGISTICS");
                  router.push("/client/b2b-logistics");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeService === "B2B_LOGISTICS"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                <span className="hidden sm:inline">B2B Logistics</span>
                <span className="sm:hidden">B2B</span>
              </button>
            </div>

            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={activeService === "B2C_COURIER" ? "Search AWB..." : activeService === "B2B_LOGISTICS" ? "Search LR..." : "Search orders, SKUs..."}
                className="pl-10 pr-4 py-2 w-48 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Date range selector */}
            <select className="hidden md:block text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
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
