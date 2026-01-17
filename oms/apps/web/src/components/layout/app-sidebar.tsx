"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Package,
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Boxes,
  Truck,
  PackageCheck,
  RotateCcw,
  BarChart3,
  Settings,
  Building2,
  Users,
  MapPin,
  LogOut,
  ChevronDown,
  Layers,
  ClipboardCheck,
  CreditCard,
  AlertTriangle,
  PackageOpen,
  ScanLine,
  FileBox,
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  Route,
  BadgeCheck,
  Tags,
  Store,
  Plug,
  Shield,
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

// Type definitions for navigation items
type NavSubItem = { title: string; href: string };
type NavItemWithSub = { title: string; icon: LucideIcon; items: NavSubItem[] };
type NavItemWithHref = { title: string; icon: LucideIcon; href: string };
type NavItem = NavItemWithSub | NavItemWithHref;

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

const dashboardNav: NavItemWithHref = {
  title: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
};

// ═══════════════════════════════════════════════════════════════════════════
// OPERATIONS (Day-to-day activities)
// ═══════════════════════════════════════════════════════════════════════════

// Orders Section
const ordersNav: NavItemWithSub = {
  title: "Orders",
  icon: ShoppingCart,
  items: [
    { title: "All Orders", href: "/orders" },
    { title: "Order Import", href: "/orders/import" },
    { title: "B2B Orders", href: "/b2b/quotations" },
  ],
};

// Fulfillment Section (Outbound Operations)
const fulfillmentNav: NavItemWithSub = {
  title: "Fulfillment",
  icon: PackageOpen,
  items: [
    { title: "Wave Planning", href: "/wms/waves" },
    { title: "Pick Lists", href: "/wms/picklist" },
    { title: "Packing Station", href: "/wms/packing" },
    { title: "Manifest & Handover", href: "/wms/manifest" },
    { title: "Gate Pass", href: "/wms/gate-pass" },
  ],
};

// Inbound Section (Receiving Operations)
const inboundNav: NavItemWithSub = {
  title: "Inbound",
  icon: ArrowDownToLine,
  items: [
    { title: "Purchase Orders", href: "/inbound/purchase-orders" },
    { title: "ASN / Receiving", href: "/inbound/receiving" },
  ],
};

// Inventory Section
const inventoryNav: NavItemWithSub = {
  title: "Inventory",
  icon: Boxes,
  items: [
    { title: "Stock View", href: "/inventory" },
    { title: "Stock Adjustments", href: "/inventory/adjustment" },
    { title: "Cycle Count", href: "/inventory/cycle-count" },
    { title: "Movement History", href: "/inventory/movements" },
  ],
};

// Shipping & Logistics Section
const shippingNav: NavItemWithSub = {
  title: "Shipping & Logistics",
  icon: Truck,
  items: [
    { title: "Shipment Tracking", href: "/logistics/tracking" },
    { title: "AWB Management", href: "/logistics/awb" },
    { title: "NDR Management", href: "/control-tower/ndr" },
  ],
};

// Returns Section
const returnsNav: NavItemWithSub = {
  title: "Returns",
  icon: RotateCcw,
  items: [
    { title: "Customer Returns", href: "/returns" },
    { title: "RTO Management", href: "/returns/rto" },
    { title: "Return QC", href: "/returns/qc" },
    { title: "Refund Processing", href: "/returns/refunds" },
  ],
};

// Quality Control Section (Unified)
const qcNav: NavItemWithSub = {
  title: "Quality Control",
  icon: BadgeCheck,
  items: [
    { title: "QC Queue", href: "/wms/qc/executions" },
    { title: "Inbound QC", href: "/inbound/qc" },
    { title: "QC Templates", href: "/wms/qc/templates" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS & FINANCE
// ═══════════════════════════════════════════════════════════════════════════

// Finance Section
const financeNav: NavItemWithSub = {
  title: "Finance",
  icon: CreditCard,
  items: [
    { title: "COD Reconciliation", href: "/finance/cod-reconciliation" },
    { title: "Freight Billing", href: "/finance/freight-billing" },
    { title: "Weight Discrepancy", href: "/finance/weight-discrepancy" },
    { title: "Payment Ledger", href: "/finance/payment-ledger" },
  ],
};

// Reports Section
const reportsNav: NavItemWithSub = {
  title: "Reports",
  icon: BarChart3,
  items: [
    { title: "Sales Reports", href: "/reports/sales" },
    { title: "Inventory Reports", href: "/reports/inventory" },
    { title: "Logistics Reports", href: "/reports/logistics" },
    { title: "Finance Reports", href: "/reports/finance" },
    { title: "Scheduled Reports", href: "/reports/scheduled" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION (Masters & Settings)
// ═══════════════════════════════════════════════════════════════════════════

// Catalog Section (Masters)
const catalogNav: NavItemWithSub = {
  title: "Catalog",
  icon: Tags,
  items: [
    { title: "SKU Master", href: "/settings/skus" },
    { title: "SKU Bundles / Kits", href: "/settings/bundles" },
    { title: "B2B Customers", href: "/b2b/customers" },
  ],
};

// Warehouse Setup Section
const warehouseSetupNav: NavItemWithSub = {
  title: "Warehouse Setup",
  icon: Warehouse,
  items: [
    { title: "Locations / Warehouses", href: "/settings/locations" },
  ],
};

// Logistics Setup Section
const logisticsSetupNav: NavItemWithSub = {
  title: "Logistics Setup",
  icon: Route,
  items: [
    { title: "Courier Partners", href: "/logistics/transporters" },
    { title: "Rate Cards", href: "/logistics/rate-cards" },
    { title: "Shipping Rules", href: "/logistics/shipping-rules" },
    { title: "Allocation Rules", href: "/logistics/allocation-rules" },
    { title: "Serviceability", href: "/logistics/pincodes" },
  ],
};

// Channels Section
const channelsNav: NavItemWithSub = {
  title: "Channels",
  icon: Store,
  items: [
    { title: "Marketplace Integrations", href: "/channels" },
    { title: "Sync Settings", href: "/channels/sync" },
  ],
};

// Settings Section
const settingsNav: NavItemWithSub = {
  title: "Settings",
  icon: Settings,
  items: [
    { title: "Company Profile", href: "/settings/company" },
    { title: "Users & Roles", href: "/settings/users" },
    { title: "API Integrations", href: "/settings/integrations" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPER ADMIN ONLY
// ═══════════════════════════════════════════════════════════════════════════

const adminPanelNav: NavItemWithHref = {
  title: "All Companies",
  icon: Shield,
  href: "/master/brands",
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENT: Collapsible Menu Item
// ═══════════════════════════════════════════════════════════════════════════

function CollapsibleNavItem({ item, pathname }: { item: NavItemWithSub; pathname: string }) {
  const isActive = item.items.some(
    (subItem) => pathname === subItem.href || pathname.startsWith(subItem.href + "/")
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
                  isActive={pathname === subItem.href || pathname.startsWith(subItem.href + "/")}
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
        {/* ═══ SUPER ADMIN SECTION ═══ */}
        {session?.user?.role === "SUPER_ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-orange-600">
              Admin Panel
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === adminPanelNav.href || pathname.startsWith(adminPanelNav.href + "/")}
                  >
                    <Link href={adminPanelNav.href}>
                      <adminPanelNav.icon className="h-4 w-4" />
                      <span>{adminPanelNav.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ═══ DASHBOARD ═══ */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === dashboardNav.href}
                >
                  <Link href={dashboardNav.href}>
                    <dashboardNav.icon className="h-4 w-4" />
                    <span>{dashboardNav.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ OPERATIONS ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={ordersNav} pathname={pathname} />
              <CollapsibleNavItem item={fulfillmentNav} pathname={pathname} />
              <CollapsibleNavItem item={inboundNav} pathname={pathname} />
              <CollapsibleNavItem item={inventoryNav} pathname={pathname} />
              <CollapsibleNavItem item={shippingNav} pathname={pathname} />
              <CollapsibleNavItem item={returnsNav} pathname={pathname} />
              <CollapsibleNavItem item={qcNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ ANALYTICS & FINANCE ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">
            Analytics & Finance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={financeNav} pathname={pathname} />
              <CollapsibleNavItem item={reportsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ CONFIGURATION ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground">
            Configuration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={catalogNav} pathname={pathname} />
              <CollapsibleNavItem item={warehouseSetupNav} pathname={pathname} />
              <CollapsibleNavItem item={logisticsSetupNav} pathname={pathname} />
              <CollapsibleNavItem item={channelsNav} pathname={pathname} />
              <CollapsibleNavItem item={settingsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
