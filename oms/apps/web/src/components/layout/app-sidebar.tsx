"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  Package,
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Boxes,
  Truck,
  RotateCcw,
  BarChart3,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  CreditCard,
  PackageOpen,
  ArrowDownToLine,
  Route,
  BadgeCheck,
  Store,
  Plug,
  Shield,
  Radar,
  Bell,
  Handshake,
  TrendingUp,
  PackageSearch,
  AlertCircle,
  Target,
  DollarSign,
  Layers,
  Grid3X3,
  ClipboardList,
  Scan,
  TruckIcon,
  LineChart,
  Database,
  Mic,
  Smartphone,
  ArrowRightLeft,
  UserCheck,
  LayoutGrid,
  Repeat,
  FileText,
  Tags,
  Calendar,
  FileSpreadsheet,
  Building2,
  MapPin,
  Scale,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

type NavSubItem = { title: string; href: string };
type NavItemWithSub = { title: string; icon: LucideIcon; items: NavSubItem[] };
type NavItemWithHref = { title: string; icon: LucideIcon; href: string };
type NavItem = NavItemWithSub | NavItemWithHref;

// ═══════════════════════════════════════════════════════════════════════════
// 1. ADMIN (SUPER_ADMIN ONLY)
// ═══════════════════════════════════════════════════════════════════════════

const platformAdminNav: NavItemWithSub = {
  title: "Platform Admin",
  icon: Shield,
  items: [
    { title: "All Companies", href: "/master/companies" },
    { title: "All Brands/Tenants", href: "/master/brands" },
    { title: "System Health", href: "/master/health" },
    { title: "Audit Logs", href: "/master/audit" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════

const dashboardNav: NavItemWithSub = {
  title: "Dashboard",
  icon: LayoutDashboard,
  items: [
    { title: "Overview", href: "/dashboard" },
    { title: "Seller Panel", href: "/dashboard/seller-panel" },
  ],
};

const controlTowerNav: NavItemWithSub = {
  title: "Control Tower",
  icon: Radar,
  items: [
    { title: "Real-time Overview", href: "/control-tower" },
    { title: "Exception Management", href: "/control-tower/exceptions" },
    { title: "SLA Monitor", href: "/control-tower/sla" },
    { title: "Detection Rules", href: "/control-tower/rules" },
    { title: "AI Insights", href: "/control-tower/ai-actions" },
    { title: "Proactive Alerts", href: "/control-tower/proactive" },
  ],
};

const ndrManagementNav: NavItemWithSub = {
  title: "NDR Management",
  icon: AlertCircle,
  items: [
    { title: "NDR Command Center", href: "/control-tower/ndr" },
    { title: "NDR Queue", href: "/ndr" },
    { title: "Reattempt Actions", href: "/ndr/reattempts" },
    { title: "Escalations", href: "/ndr/escalations" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. ORDER LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

const ordersNav: NavItemWithSub = {
  title: "Orders",
  icon: ShoppingCart,
  items: [
    { title: "All Orders", href: "/orders" },
    { title: "New Order", href: "/orders/new" },
    { title: "Order Import", href: "/orders/import" },
    { title: "Bulk Actions", href: "/orders/bulk" },
    { title: "Pre-orders", href: "/orders/preorders" },
    { title: "Subscriptions", href: "/orders/subscriptions" },
  ],
};

const b2bSalesNav: NavItemWithSub = {
  title: "B2B Sales",
  icon: Handshake,
  items: [
    { title: "Quotations", href: "/b2b/quotations" },
    { title: "B2B Orders", href: "/b2b/orders" },
    { title: "Price Lists", href: "/b2b/price-lists" },
    { title: "Credit Management", href: "/b2b/credit" },
    { title: "B2B Customers", href: "/b2b/customers" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. WMS (Warehouse Management System) — RESTRUCTURED
// ═══════════════════════════════════════════════════════════════════════════

const wmsSetupNav: NavItemWithSub = {
  title: "Setup",
  icon: Settings,
  items: [
    { title: "Zones", href: "/wms/zones" },
    { title: "Bins", href: "/wms/bins" },
    { title: "Putaway Rules", href: "/inbound/putaway" },
    { title: "QC Templates", href: "/wms/qc/templates" },
    { title: "Cycle Count Waves", href: "/inventory/cycle-counts" },
    { title: "SKU Label Print", href: "/wms/sku-label-print" },
  ],
};

const wmsInboundNav: NavItemWithSub = {
  title: "Inbound",
  icon: ArrowDownToLine,
  items: [
    { title: "Goods Receipt (GRN)", href: "/inbound/goods-receipt" },
    { title: "ASN Management", href: "/inbound/asn" },
    { title: "Receiving", href: "/inbound/receiving" },
    { title: "Inbound QC", href: "/inbound/qc" },
    { title: "Putaway Tasks", href: "/inbound/putaway" },
    { title: "Direct Inbound", href: "/inbound/direct" },
    { title: "Return Inbound", href: "/inbound/return-inbound" },
  ],
};

const wmsInventoryNav: NavItemWithSub = {
  title: "Inventory",
  icon: Boxes,
  items: [
    { title: "Inventory View", href: "/inventory" },
    { title: "Movement History", href: "/inventory/movements" },
    { title: "Inventory Move / Transfer", href: "/inventory/transfers" },
    { title: "Stock Adjustments", href: "/inventory/adjustments" },
    { title: "Cycle Count", href: "/inventory/cycle-counts" },
    { title: "BIN Audit", href: "/inventory/bin-audit" },
    { title: "Virtual Inventory", href: "/inventory/virtual" },
    { title: "SKU Transaction History", href: "/inventory/sku-transactions" },
    { title: "Inventory Reservation", href: "/inventory/reservations" },
  ],
};

const wmsOrderProcessingNav: NavItemWithSub = {
  title: "Order Processing",
  icon: PackageOpen,
  items: [
    { title: "Order Allocate / Unallocate", href: "/fulfillment/allocate" },
    { title: "Wave Planning", href: "/fulfillment/waves" },
    { title: "Picklist Management", href: "/fulfillment/picklist" },
    { title: "Packing", href: "/fulfillment/packing" },
    { title: "Outbound QC", href: "/fulfillment/qc" },
    { title: "Delivery Split", href: "/fulfillment/delivery-split" },
    { title: "Manifest", href: "/fulfillment/manifest" },
    { title: "Delivery Shipping", href: "/fulfillment/delivery-shipping" },
    { title: "Gate Pass", href: "/fulfillment/gate-pass" },
  ],
};

const wmsReturnsNav: NavItemWithSub = {
  title: "Returns & RTO",
  icon: RotateCcw,
  items: [
    { title: "Customer Returns", href: "/returns" },
    { title: "RTO Management", href: "/returns/rto" },
    { title: "Returns QC", href: "/returns/qc" },
    { title: "Refund Processing", href: "/returns/refunds" },
  ],
};

const wmsQualityControlNav: NavItemWithSub = {
  title: "Quality Control",
  icon: BadgeCheck,
  items: [
    { title: "QC Templates", href: "/wms/qc/templates" },
    { title: "QC Executions", href: "/wms/qc/executions" },
    { title: "QC Parameters", href: "/wms/qc/parameters" },
  ],
};

const wmsAdvancedNav: NavItemWithSub = {
  title: "Advanced WMS",
  icon: Layers,
  items: [
    { title: "Labor Management", href: "/wms/labor" },
    { title: "Slotting Optimization", href: "/wms/slotting" },
    { title: "Voice Picking", href: "/wms/voice" },
    { title: "Mobile WMS", href: "/wms/mobile" },
    { title: "Cross-Docking", href: "/wms/cross-dock" },
    { title: "Transhipment", href: "/wms/transhipment" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. LOGISTICS — DEDUPLICATED
// ═══════════════════════════════════════════════════════════════════════════

const shipmentTrackingNav: NavItemWithSub = {
  title: "Shipment Tracking",
  icon: Truck,
  items: [
    { title: "Tracking Dashboard", href: "/logistics/tracking" },
    { title: "AWB Management", href: "/logistics/awb" },
    { title: "Delivery Performance", href: "/logistics/performance" },
  ],
};

const b2cCourierNav: NavItemWithSub = {
  title: "B2C / Courier",
  icon: Package,
  items: [
    { title: "Courier Partners", href: "/logistics/transporters" },
    { title: "B2C Rate Cards", href: "/logistics/rate-cards" },
    { title: "Shipping Rules", href: "/logistics/shipping-rules" },
    { title: "Pincode Serviceability", href: "/logistics/pincodes" },
  ],
};

const ftlNav: NavItemWithSub = {
  title: "FTL Management",
  icon: TruckIcon,
  items: [
    { title: "FTL Vendors", href: "/logistics/ftl/vendors" },
    { title: "Vehicle Types", href: "/logistics/ftl/vehicle-types" },
    { title: "Lane Rates", href: "/logistics/ftl/lane-rates" },
    { title: "Indent Management", href: "/logistics/ftl/indents" },
    { title: "Rate Comparison", href: "/logistics/ftl/rate-comparison" },
  ],
};

const ptlNav: NavItemWithSub = {
  title: "PTL / B2B",
  icon: Boxes,
  items: [
    { title: "PTL Rate Matrix", href: "/logistics/ptl/rate-matrix" },
    { title: "TAT Matrix", href: "/logistics/ptl/tat-matrix" },
    { title: "Rate Comparison", href: "/logistics/ptl/rate-comparison" },
  ],
};

const allocationNav: NavItemWithSub = {
  title: "Allocation Engine",
  icon: Target,
  items: [
    { title: "Allocation Rules", href: "/logistics/allocation/rules" },
    { title: "CSR Configuration", href: "/logistics/allocation/csr-config" },
    { title: "Allocation Audit", href: "/logistics/allocation/audit" },
  ],
};

const logisticsAnalyticsNav: NavItemWithSub = {
  title: "Logistics Analytics",
  icon: LineChart,
  items: [
    { title: "Logistics Dashboard", href: "/logistics/dashboard" },
    { title: "Carrier Scorecards", href: "/logistics/analytics/carrier-scorecards" },
    { title: "Lane Performance", href: "/logistics/analytics/lane-performance" },
    { title: "Pincode Performance", href: "/logistics/analytics/pincode-performance" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. PROCUREMENT
// ═══════════════════════════════════════════════════════════════════════════

const procurementNav: NavItemWithSub = {
  title: "Procurement",
  icon: ClipboardList,
  items: [
    { title: "Purchase Orders", href: "/procurement/purchase-orders" },
    { title: "External POs", href: "/inbound/external-pos" },
    { title: "Vendors", href: "/procurement/vendors" },
    { title: "Vendor Performance", href: "/procurement/performance" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 7. CHANNELS & MARKETPLACE — PROMOTED
// ═══════════════════════════════════════════════════════════════════════════

const marketplaceNav: NavItemWithSub = {
  title: "Marketplace",
  icon: Store,
  items: [
    { title: "Connections", href: "/channels/marketplaces" },
    { title: "SKU Mapping", href: "/channels/sku-mapping" },
    { title: "Order Sync", href: "/channels/order-sync" },
    { title: "Inventory Sync", href: "/channels/inventory-sync" },
    { title: "Marketplace Returns", href: "/channels/returns" },
    { title: "Settlements", href: "/channels/settlements" },
    { title: "Scheduled Jobs", href: "/channels/scheduled-jobs" },
    { title: "Sync Settings", href: "/channels/sync" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. FINANCE
// ═══════════════════════════════════════════════════════════════════════════

const financeNav: NavItemWithSub = {
  title: "Finance",
  icon: CreditCard,
  items: [
    { title: "Finance Dashboard", href: "/finance/dashboard" },
    { title: "Invoices", href: "/finance/invoices" },
    { title: "COD Reconciliation", href: "/finance/cod-reconciliation" },
    { title: "Payment Reconciliation", href: "/finance/reconciliation" },
    { title: "Freight Billing", href: "/finance/freight-billing" },
    { title: "Weight Discrepancy", href: "/finance/weight-discrepancy" },
    { title: "Payment Ledger", href: "/finance/payment-ledger" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. REPORTS & ANALYTICS — MERGED
// ═══════════════════════════════════════════════════════════════════════════

const reportsNav: NavItemWithSub = {
  title: "Reports",
  icon: BarChart3,
  items: [
    { title: "Reports Hub", href: "/reports" },
    { title: "Sales Reports", href: "/reports/sales" },
    { title: "Inventory Reports", href: "/reports/inventory" },
    { title: "Logistics Reports", href: "/reports/logistics" },
    { title: "Finance Reports", href: "/reports/finance" },
    { title: "Scheduled Reports", href: "/reports/scheduled" },
    { title: "Custom Reports", href: "/reports/custom" },
  ],
};

const analyticsNav: NavItemWithSub = {
  title: "Analytics",
  icon: TrendingUp,
  items: [
    { title: "Sales Analytics", href: "/analytics/sales" },
    { title: "Operations Analytics", href: "/analytics/operations" },
    { title: "Carrier Analytics", href: "/analytics/carriers" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 10. CONFIGURATION — CLEANED (Only true config items)
// ═══════════════════════════════════════════════════════════════════════════

const mastersNav: NavItemWithSub = {
  title: "Masters",
  icon: Database,
  items: [
    { title: "SKU Master", href: "/masters/skus" },
    { title: "SKU Bundles / Kits", href: "/masters/bundles" },
    { title: "Categories", href: "/masters/categories" },
  ],
};

const companyUsersNav: NavItemWithSub = {
  title: "Company & Users",
  icon: Building2,
  items: [
    { title: "Company Profile", href: "/settings/company" },
    { title: "Users & Roles", href: "/settings/users" },
    { title: "Locations / Warehouses", href: "/settings/locations" },
  ],
};

const integrationsNav: NavItemWithSub = {
  title: "Integrations",
  icon: Plug,
  items: [
    { title: "API & Integrations", href: "/settings/integrations" },
    { title: "Communication Templates", href: "/setup/templates" },
  ],
};

const appSettingsNav: NavItemWithSub = {
  title: "Settings",
  icon: Settings,
  items: [
    { title: "Inventory Valuation", href: "/settings/inventory/valuation" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENT: Collapsible Menu Item
// ═══════════════════════════════════════════════════════════════════════════

function CollapsibleNavItem({
  item,
  pathname,
}: {
  item: NavItemWithSub;
  pathname: string;
}) {
  const isActive = item.items.some(
    (subItem) =>
      pathname === subItem.href || pathname.startsWith(subItem.href + "/")
  );

  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={isActive ? "bg-accent" : ""}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={
                    pathname === subItem.href ||
                    pathname.startsWith(subItem.href + "/")
                  }
                >
                  <Link href={subItem.href}>{subItem.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENT: Collapsible Section Group
// ═══════════════════════════════════════════════════════════════════════════

function CollapsibleSectionGroup({
  label,
  labelColor,
  items,
  pathname,
  defaultOpen = true,
}: {
  label: string;
  labelColor?: string;
  items: NavItemWithSub[];
  pathname: string;
  defaultOpen?: boolean;
}) {
  const hasActiveItem = items.some((item) =>
    item.items.some(
      (subItem) =>
        pathname === subItem.href || pathname.startsWith(subItem.href + "/")
    )
  );

  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveItem);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={cn(
              "text-xs font-semibold cursor-pointer hover:text-foreground transition-colors flex items-center justify-between",
              labelColor || "text-muted-foreground"
            )}
          >
            {label}
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <CollapsibleNavItem
                  key={item.title}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SIDEBAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base">CJDQuick OMS</span>
            <span className="text-xs text-muted-foreground">
              Order Management System
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* ═══ 1. ADMIN (SUPER_ADMIN ONLY) ═══ */}
        {session?.user?.role === "SUPER_ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-orange-600">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <CollapsibleNavItem item={platformAdminNav} pathname={pathname} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ═══ 2. COMMAND CENTER ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-blue-600">
            Command Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={dashboardNav} pathname={pathname} />
              <CollapsibleNavItem item={controlTowerNav} pathname={pathname} />
              <CollapsibleNavItem item={ndrManagementNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 3. ORDER LIFECYCLE ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-green-600">
            Order Lifecycle
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={ordersNav} pathname={pathname} />
              <CollapsibleNavItem item={b2bSalesNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 4. WMS (Warehouse Management) ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-purple-600">
            WMS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={wmsSetupNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsInboundNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsInventoryNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsOrderProcessingNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsReturnsNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsQualityControlNav} pathname={pathname} />
              <CollapsibleNavItem item={wmsAdvancedNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 5. LOGISTICS ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-amber-600">
            Logistics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={shipmentTrackingNav} pathname={pathname} />
              <CollapsibleNavItem item={b2cCourierNav} pathname={pathname} />
              <CollapsibleNavItem item={ftlNav} pathname={pathname} />
              <CollapsibleNavItem item={ptlNav} pathname={pathname} />
              <CollapsibleNavItem item={allocationNav} pathname={pathname} />
              <CollapsibleNavItem item={logisticsAnalyticsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 6. PROCUREMENT ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-teal-600">
            Procurement
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={procurementNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 7. CHANNELS & MARKETPLACE ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-indigo-600">
            Channels & Marketplace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={marketplaceNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 8. FINANCE ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-rose-600">
            Finance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={financeNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 9. REPORTS & ANALYTICS ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-rose-600">
            Reports & Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={reportsNav} pathname={pathname} />
              <CollapsibleNavItem item={analyticsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ 10. CONFIGURATION (COLLAPSED) ═══ */}
        <CollapsibleSectionGroup
          label="Configuration"
          labelColor="text-slate-500"
          items={[
            mastersNav,
            companyUsersNav,
            integrationsNav,
            appSettingsNav,
          ]}
          pathname={pathname}
          defaultOpen={false}
        />
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                      {session?.user?.role === "SUPER_ADMIN"
                        ? "SA"
                        : session?.user?.name
                        ? getInitials(session.user.name)
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">
                      {session?.user?.role === "SUPER_ADMIN"
                        ? "Super Admin"
                        : session?.user?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user?.role?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">Profile Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    signOut({ callbackUrl: "/login", redirect: true });
                  }}
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
