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
  Bot,
  Bell,
  MessageSquare,
  AlertTriangle,
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

// Analytics Section - Dashboard & Monitoring
const analyticsNav = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Overview", href: "/dashboard" },
      { title: "Seller Panel", href: "/dashboard/seller-panel" },
    ],
  },
  {
    title: "Control Tower",
    icon: Gauge,
    items: [
      { title: "Overview", href: "/control-tower" },
      { title: "NDR Command Center", href: "/control-tower/ndr" },
      { title: "Proactive Communication", href: "/control-tower/proactive" },
      { title: "AI Actions", href: "/control-tower/ai-actions" },
    ],
  },
];

// Channels Section - Marketplace Integrations
const channelsNav = [
  {
    title: "Channels",
    icon: Layers,
    items: [
      { title: "Marketplace Integrations", href: "/channels" },
      { title: "Order Sync", href: "/channels/sync" },
    ],
  },
];

// Order Management Section
const ordersNav = [
  {
    title: "Orders",
    icon: ShoppingCart,
    href: "/orders",
  },
];

// Inventory Management Section
const inventoryNav = [
  {
    title: "Inventory",
    icon: Boxes,
    items: [
      { title: "Inventory View", href: "/inventory" },
      { title: "Stock Adjustment", href: "/inventory/adjustment" },
      { title: "Cycle Count", href: "/inventory/cycle-count" },
      { title: "Movement History", href: "/inventory/movements" },
      { title: "Virtual Inventory", href: "/inventory/virtual" },
    ],
  },
  {
    title: "Inbound",
    icon: PackageCheck,
    items: [
      { title: "Purchase Orders", href: "/inbound/purchase-orders" },
      { title: "ASN/Receiving", href: "/inbound/receiving" },
      { title: "Inbound QC", href: "/inbound/qc" },
    ],
  },
];

// WMS Section - Warehouse Operations (includes Locations, SKU Master, Bundles)
const wmsNav = [
  {
    title: "WMS",
    icon: Warehouse,
    items: [
      { title: "Locations/Warehouses", href: "/settings/locations" },
      { title: "SKU Master", href: "/settings/skus" },
      { title: "SKU Bundles", href: "/settings/bundles" },
      { title: "Wave Picking", href: "/wms/waves" },
      { title: "Picklist", href: "/wms/picklist" },
      { title: "Packing", href: "/wms/packing" },
      { title: "QC Templates", href: "/wms/qc/templates" },
      { title: "QC Queue", href: "/wms/qc/executions" },
      { title: "Manifest", href: "/wms/manifest" },
      { title: "Gate Pass", href: "/wms/gate-pass" },
    ],
  },
];

// Logistics Section - Expanded (Industry Standard) - Includes Integrations
const logisticsNav = [
  {
    title: "Logistics",
    icon: Truck,
    items: [
      { title: "Shipping Dashboard", href: "/logistics/dashboard" },
      { title: "Courier Partners", href: "/logistics/transporters" },
      { title: "AWB Management", href: "/logistics/awb" },
      { title: "Rate Cards", href: "/logistics/rate-cards" },
      { title: "Shipping Rules", href: "/logistics/shipping-rules" },
      { title: "Allocation Rules", href: "/logistics/allocation-rules" },
      { title: "Service Pincodes", href: "/logistics/pincodes" },
      { title: "Tracking", href: "/logistics/tracking" },
      { title: "Integrations", href: "/settings/integrations" },
    ],
  },
];

// Returns & RTO Section - Expanded
const returnsNav = [
  {
    title: "Returns & RTO",
    icon: RotateCcw,
    items: [
      { title: "Return Requests", href: "/returns" },
      { title: "RTO Management", href: "/returns/rto" },
      { title: "Return QC", href: "/returns/qc" },
      { title: "Refund Processing", href: "/returns/refunds" },
    ],
  },
];

// Finance & Reconciliation Section - Expanded
const financeNav = [
  {
    title: "Finance",
    icon: CreditCard,
    items: [
      { title: "Finance Dashboard", href: "/finance/dashboard" },
      { title: "COD Reconciliation", href: "/finance/cod-reconciliation" },
      { title: "Weight Discrepancy", href: "/finance/weight-discrepancy" },
      { title: "Freight Billing", href: "/finance/freight-billing" },
      { title: "Invoices", href: "/finance/invoices" },
      { title: "Payment Ledger", href: "/finance/payment-ledger" },
    ],
  },
];

// B2B Section
const b2bNav = [
  {
    title: "B2B",
    icon: Building2,
    items: [
      { title: "Customers", href: "/b2b/customers" },
      { title: "Price Lists", href: "/b2b/price-lists" },
      { title: "Quotations", href: "/b2b/quotations" },
      { title: "Credit Management", href: "/b2b/credit" },
    ],
  },
];

// Reports Section
const reportsNav = [
  {
    title: "Reports",
    icon: BarChart3,
    items: [
      { title: "Sales Reports", href: "/reports/sales" },
      { title: "Inventory Reports", href: "/reports/inventory" },
      { title: "Logistics Reports", href: "/reports/logistics" },
      { title: "Finance Reports", href: "/reports/finance" },
      { title: "Scheduled Reports", href: "/reports/scheduled" },
    ],
  },
];

// Master Panel - Only Clients/Brands (Companies rarely needed, accessible via direct URL)
const masterPanelNav = [
  {
    title: "Clients/Brands",
    icon: Users,
    href: "/master/brands",
  },
];

// Configuration Section - Slimmed (only Company Profile and User Management)
const settingsNav = [
  {
    title: "Company Profile",
    icon: Building2,
    href: "/settings/company",
  },
  {
    title: "User Management",
    icon: Users,
    href: "/settings/users",
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

        {/* Analytics & Monitoring */}
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Channels & Integrations */}
        <SidebarGroup>
          <SidebarGroupLabel>Channels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {channelsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Order Management */}
        <SidebarGroup>
          <SidebarGroupLabel>Order Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ordersNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + "/")}>
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

        {/* Inventory & Inbound */}
        <SidebarGroup>
          <SidebarGroupLabel>Inventory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {inventoryNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Warehouse Operations */}
        <SidebarGroup>
          <SidebarGroupLabel>Warehouse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {wmsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Logistics & Shipping */}
        <SidebarGroup>
          <SidebarGroupLabel>Logistics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {logisticsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Returns & RTO */}
        <SidebarGroup>
          <SidebarGroupLabel>Returns</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {returnsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Finance & Reconciliation */}
        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* B2B */}
        <SidebarGroup>
          <SidebarGroupLabel>B2B</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {b2bNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Reports */}
        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsNav.map((item) =>
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
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
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

        {/* Configuration */}
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
