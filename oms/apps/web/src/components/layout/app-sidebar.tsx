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
  FileText,
  CreditCard,
  Gauge,
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

const navigation = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "eRetail Dashboard", href: "/dashboard" },
      { title: "Seller Panel Dashboard", href: "/dashboard/seller-panel" },
    ],
  },
  {
    title: "Control Tower",
    icon: Gauge,
    href: "/control-tower",
  },
  {
    title: "Orders",
    icon: ShoppingCart,
    href: "/orders",
    badge: "12",
  },
  {
    title: "WMS",
    icon: Warehouse,
    items: [
      { title: "Wave Picking", href: "/wms/waves" },
      { title: "Picklist", href: "/wms/picklist" },
      { title: "Packing", href: "/wms/packing" },
      { title: "Shipping", href: "/wms/delivery-shipping" },
      { title: "Manifest", href: "/wms/manifest" },
      { title: "Gate Pass", href: "/wms/gate-pass" },
      { title: "QC Templates", href: "/wms/qc/templates" },
      { title: "QC Queue", href: "/wms/qc/executions" },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    items: [
      { title: "Inventory View", href: "/inventory" },
      { title: "Stock Adjustment", href: "/inventory/adjustment" },
      { title: "Cycle Count", href: "/inventory/cycle-count" },
      { title: "Movement History", href: "/inventory/movements" },
    ],
  },
  {
    title: "Inbound",
    icon: PackageCheck,
    items: [
      { title: "Purchase Orders", href: "/inbound/purchase-orders" },
      { title: "Receiving", href: "/inbound/receiving" },
      { title: "Inbound QC", href: "/inbound/qc" },
    ],
  },
  {
    title: "Logistics",
    icon: Truck,
    items: [
      { title: "Transporters", href: "/logistics/transporters" },
      { title: "AWB Management", href: "/logistics/awb" },
      { title: "Service Pincodes", href: "/logistics/pincodes" },
    ],
  },
  {
    title: "Returns",
    icon: RotateCcw,
    href: "/returns",
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/reports",
  },
  {
    title: "B2B",
    icon: Building2,
    items: [
      { title: "Customers", href: "/b2b/customers" },
      { title: "Quotations", href: "/b2b/quotations" },
    ],
  },
];

const masterPanelNav = [
  {
    title: "Companies",
    icon: Building2,
    href: "/master/companies",
  },
  {
    title: "Clients/Brands",
    icon: Users,
    href: "/master/brands",
  },
];

const settingsNav = [
  {
    title: "Company Profile",
    icon: Building2,
    href: "/settings/company",
  },
  {
    title: "Locations/Warehouses",
    icon: MapPin,
    href: "/settings/locations",
  },
  {
    title: "User Management",
    icon: Users,
    href: "/settings/users",
  },
  {
    title: "SKU Master",
    icon: Package,
    href: "/settings/skus",
  },
  {
    title: "Rate Cards",
    icon: CreditCard,
    href: "/settings/rate-cards",
  },
  {
    title: "Integrations",
    icon: Settings,
    href: "/settings/integrations",
  },
  {
    title: "Shipping Rules",
    icon: Truck,
    href: "/settings/shipping-rules",
  },
];

const financeNav = [
  {
    title: "COD Reconciliation",
    icon: CreditCard,
    href: "/finance/cod-reconciliation",
  },
];

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
            <span className="font-bold text-base">OMS Master</span>
            <span className="text-xs text-muted-foreground">
              Multi-Tenant Control Panel
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Master Panel Section - Only for Super Admin */}
        {session?.user?.role === "SUPER_ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel>Master Panel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {masterPanelNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) =>
                item.items ? (
                  <Collapsible key={item.title} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
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
                                isActive={pathname === subItem.href}
                              >
                                <Link href={subItem.href}>{subItem.title}</Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                      {session?.user?.role === "SUPER_ADMIN" ? "MA" : session?.user?.name ? getInitials(session.user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium">
                      {session?.user?.role === "SUPER_ADMIN" ? "Master Panel Admin" : session?.user?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {session?.user?.role === "SUPER_ADMIN" ? "OMS Super Admin" : session?.user?.role}
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
