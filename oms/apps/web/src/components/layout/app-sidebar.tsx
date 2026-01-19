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
  Building2,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  AlertTriangle,
  PackageOpen,
  FileBox,
  ArrowDownToLine,
  Route,
  BadgeCheck,
  Tags,
  Store,
  Plug,
  Shield,
  Radar,
  BrainCircuit,
  Bell,
  Handshake,
  Receipt,
  FileText,
  TrendingUp,
  PackageSearch,
  MapPin,
  RefreshCw,
  AlertCircle,
  Target,
  Activity,
  DollarSign,
  Scale,
  BookOpen,
  Timer,
  Layers,
  Grid3X3,
  Megaphone,
  Mail,
  ListChecks,
  ClipboardList,
  Scan,
  PackageX,
  CircleDollarSign,
  TruckIcon,
  LineChart,
  PieChart,
  Calendar,
  FileSpreadsheet,
  Database,
  Server,
  ScrollText,
  ShoppingBag,
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
// COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════

const dashboardNav: NavItemWithHref = {
  title: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
};

const controlTowerNav: NavItemWithSub = {
  title: "Control Tower",
  icon: Radar,
  items: [
    { title: "Real-time Overview", href: "/control-tower" },
    { title: "Exception Management", href: "/control-tower/exceptions" },
    { title: "NDR Command Center", href: "/control-tower/ndr" },
    { title: "Detection Rules", href: "/control-tower/rules" },
    { title: "SLA Monitor", href: "/control-tower/sla" },
    { title: "AI Insights", href: "/control-tower/ai-actions" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ORDER LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

const ordersNav: NavItemWithSub = {
  title: "Orders",
  icon: ShoppingCart,
  items: [
    { title: "All Orders", href: "/orders" },
    { title: "Order Import", href: "/orders/import" },
    { title: "Bulk Actions", href: "/orders/bulk" },
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
// WAREHOUSE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

const inboundNav: NavItemWithSub = {
  title: "Inbound",
  icon: ArrowDownToLine,
  items: [
    { title: "Purchase Orders", href: "/inbound/purchase-orders" },
    { title: "ASN Management", href: "/inbound/asn" },
    { title: "Receiving", href: "/inbound/receiving" },
    { title: "Inbound QC", href: "/inbound/qc" },
  ],
};

const fulfillmentNav: NavItemWithSub = {
  title: "Outbound (Fulfillment)",
  icon: PackageOpen,
  items: [
    { title: "Wave Planning", href: "/fulfillment/waves" },
    { title: "Picking", href: "/fulfillment/picklist" },
    { title: "Packing", href: "/fulfillment/packing" },
    { title: "Outbound QC", href: "/fulfillment/qc" },
    { title: "Manifest", href: "/fulfillment/manifest" },
    { title: "Gate Pass", href: "/fulfillment/gate-pass" },
  ],
};

const inventoryNav: NavItemWithSub = {
  title: "Inventory",
  icon: Boxes,
  items: [
    { title: "Stock Overview", href: "/inventory" },
    { title: "Stock Adjustments", href: "/inventory/adjustment" },
    { title: "Cycle Count", href: "/inventory/cycle-count" },
    { title: "Movement History", href: "/inventory/movements" },
    { title: "Virtual Inventory", href: "/inventory/virtual" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGISTICS & DELIVERY
// ═══════════════════════════════════════════════════════════════════════════

const shipmentsNav: NavItemWithSub = {
  title: "Shipments",
  icon: Truck,
  items: [
    { title: "Tracking Dashboard", href: "/logistics/tracking" },
    { title: "AWB Management", href: "/logistics/awb" },
    { title: "Delivery Performance", href: "/logistics/performance" },
  ],
};

const ndrNav: NavItemWithSub = {
  title: "NDR Management",
  icon: AlertCircle,
  items: [
    { title: "NDR Queue", href: "/ndr" },
    { title: "Reattempt Actions", href: "/ndr/reattempts" },
    { title: "Escalations", href: "/ndr/escalations" },
  ],
};

const returnsNav: NavItemWithSub = {
  title: "Returns & RTO",
  icon: RotateCcw,
  items: [
    { title: "Customer Returns", href: "/returns" },
    { title: "RTO Management", href: "/returns/rto" },
    { title: "Returns QC", href: "/returns/qc" },
    { title: "Refund Processing", href: "/returns/refunds" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// PROCUREMENT
// ═══════════════════════════════════════════════════════════════════════════

const procurementNav: NavItemWithSub = {
  title: "Procurement",
  icon: ClipboardList,
  items: [
    { title: "Purchase Orders", href: "/procurement/purchase-orders" },
    { title: "Vendors", href: "/procurement/vendors" },
    { title: "Vendor Performance", href: "/procurement/performance" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// FINANCE & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

const financeNav: NavItemWithSub = {
  title: "Finance",
  icon: CreditCard,
  items: [
    { title: "Finance Dashboard", href: "/finance/dashboard" },
    { title: "COD Reconciliation", href: "/finance/cod-reconciliation" },
    { title: "Freight Billing", href: "/finance/freight-billing" },
    { title: "Weight Discrepancy", href: "/finance/weight-discrepancy" },
    { title: "Payment Ledger", href: "/finance/payment-ledger" },
  ],
};

const reportsNav: NavItemWithSub = {
  title: "Reports & Analytics",
  icon: BarChart3,
  items: [
    { title: "Reports Hub", href: "/reports" },
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
// CONFIGURATION (COLLAPSIBLE SECTION)
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

const warehouseSetupNav: NavItemWithSub = {
  title: "Warehouse Setup",
  icon: Warehouse,
  items: [
    { title: "Locations", href: "/setup/locations" },
    { title: "Zones & Bins", href: "/setup/zones" },
  ],
};

const logisticsSetupNav: NavItemWithSub = {
  title: "Logistics Setup",
  icon: Route,
  items: [
    { title: "Transporters", href: "/setup/transporters" },
    { title: "Rate Cards", href: "/setup/rate-cards" },
    { title: "Shipping Rules", href: "/setup/shipping-rules" },
    { title: "Allocation Rules", href: "/setup/allocation-rules" },
    { title: "Serviceability", href: "/setup/pincodes" },
  ],
};

const channelsNav: NavItemWithSub = {
  title: "Channels",
  icon: Store,
  items: [
    { title: "Marketplace Integrations", href: "/setup/channels" },
    { title: "Sync Settings", href: "/setup/channels/sync" },
  ],
};

const qcSetupNav: NavItemWithSub = {
  title: "Quality Control",
  icon: BadgeCheck,
  items: [
    { title: "QC Templates", href: "/setup/qc-templates" },
    { title: "QC Parameters", href: "/setup/qc-parameters" },
  ],
};

const notificationsNav: NavItemWithSub = {
  title: "Notifications",
  icon: Bell,
  items: [
    { title: "Alert Rules", href: "/setup/alerts" },
    { title: "Communication Templates", href: "/setup/templates" },
  ],
};

const settingsNav: NavItemWithSub = {
  title: "Settings",
  icon: Settings,
  items: [
    { title: "Company Profile", href: "/settings/company" },
    { title: "Users & Roles", href: "/settings/users" },
    { title: "API & Integrations", href: "/settings/integrations" },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN (SUPER ADMIN ONLY)
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
        {/* ═══ SUPER ADMIN SECTION ═══ */}
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

        {/* ═══ COMMAND CENTER ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-blue-600">
            Command Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard - Direct Link */}
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
              {/* Control Tower */}
              <CollapsibleNavItem item={controlTowerNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ ORDER LIFECYCLE ═══ */}
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

        {/* ═══ WAREHOUSE OPERATIONS ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-purple-600">
            Warehouse Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={inboundNav} pathname={pathname} />
              <CollapsibleNavItem item={fulfillmentNav} pathname={pathname} />
              <CollapsibleNavItem item={inventoryNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ LOGISTICS & DELIVERY ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-amber-600">
            Logistics & Delivery
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={shipmentsNav} pathname={pathname} />
              <CollapsibleNavItem item={ndrNav} pathname={pathname} />
              <CollapsibleNavItem item={returnsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ PROCUREMENT ═══ */}
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

        {/* ═══ FINANCE & ANALYTICS ═══ */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-rose-600">
            Finance & Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavItem item={financeNav} pathname={pathname} />
              <CollapsibleNavItem item={reportsNav} pathname={pathname} />
              <CollapsibleNavItem item={analyticsNav} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ═══ CONFIGURATION (COLLAPSIBLE) ═══ */}
        <CollapsibleSectionGroup
          label="Configuration"
          labelColor="text-slate-500"
          items={[
            mastersNav,
            warehouseSetupNav,
            logisticsSetupNav,
            channelsNav,
            qcSetupNav,
            notificationsNav,
            settingsNav,
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
