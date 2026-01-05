"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Search,
  X,
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

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  client: {
    id: string;
    companyName: string;
  };
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Fetch user data on mount
  useEffect(() => {
    const token = localStorage.getItem("client_token");
    if (!token) {
      router.push("/client-login");
      return;
    }

    fetch("/api/client/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data);
        } else {
          localStorage.removeItem("client_token");
          router.push("/client-login");
        }
      })
      .catch(() => {
        localStorage.removeItem("client_token");
        router.push("/client-login");
      });
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    const token = localStorage.getItem("client_token");
    try {
      await fetch("/api/client/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("client_token");
    router.push("/client-login");
  };

  // Handle search
  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    const token = localStorage.getItem("client_token");

    try {
      const res = await fetch(`/api/client/orders?search=${encodeURIComponent(query)}&pageSize=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.items || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
    setIsSearching(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const client = {
    companyName: user?.client?.companyName || "Loading...",
    userName: user?.name || "Loading...",
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
              <span className="font-bold text-lg text-gray-900">CJDQuick B2B Client</span>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search AWB or Order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                className="w-64 pl-10 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No orders found
                    </div>
                  ) : (
                    <div>
                      {searchResults.map((order: any) => (
                        <Link
                          key={order.id}
                          href={`/client/orders/${order.id}`}
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery("");
                          }}
                          className="block px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{order.orderNumber}</p>
                              {order.awbNumber && (
                                <p className="text-xs text-gray-500">{order.awbNumber}</p>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              order.status === "DELIVERED" ? "bg-green-100 text-green-700" :
                              order.status === "IN_TRANSIT" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {order.customerName} - {order.deliveryCity}
                          </p>
                        </Link>
                      ))}
                      <Link
                        href={`/client/orders?search=${encodeURIComponent(searchQuery)}`}
                        onClick={() => {
                          setShowSearchResults(false);
                          setSearchQuery("");
                        }}
                        className="block px-4 py-2 text-center text-sm text-primary-600 hover:bg-primary-50 font-medium"
                      >
                        View all results
                      </Link>
                    </div>
                  )}
                </div>
              )}
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
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Logout"
            >
              <LogOut className={`h-5 w-5 ${isLoggingOut ? "animate-pulse" : ""}`} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
