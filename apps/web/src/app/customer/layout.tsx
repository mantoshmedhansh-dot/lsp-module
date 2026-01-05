"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Package,
  LayoutDashboard,
  Truck,
  PlusCircle,
  Search,
  LogOut,
  Menu,
  X,
  User,
  Home,
} from "lucide-react";

interface CustomerData {
  id: string;
  companyName: string;
  name: string;
  email: string;
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/customer/login") {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("customer_token");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    // Verify token and get customer data
    fetch("/api/customer/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCustomer(data.data);
        } else {
          localStorage.removeItem("customer_token");
          router.push("/customer/login");
        }
      })
      .catch(() => {
        localStorage.removeItem("customer_token");
        router.push("/customer/login");
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("customer_token");
    router.push("/customer/login");
  };

  // Show only children for login page
  if (pathname === "/customer/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const navItems = [
    { href: "/customer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customer/book", label: "Book Consignment", icon: PlusCircle },
    { href: "/customer/shipments", label: "My Shipments", icon: Package },
    { href: "/customer/tracking", label: "Track", icon: Search },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Home Button & Logo */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Home className="h-4 w-4" />
                <span className="font-medium text-sm">Home</span>
              </Link>
              <Link href="/customer/dashboard" className="flex items-center gap-2">
                <Truck className="h-8 w-8 text-blue-600" />
                <span className="font-bold text-xl text-gray-900">CJDarcl Quick</span>
              </Link>
              <span className="hidden sm:inline-block text-sm text-gray-500 border-l pl-3 ml-3">
                Customer Portal
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{customer?.companyName || customer?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-3 space-y-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-blue-50 text-blue-700"
              >
                <Home className="h-5 w-5" />
                Home
              </Link>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="pt-3 mt-3 border-t border-gray-200">
                <div className="px-4 py-2 text-sm text-gray-500">
                  {customer?.companyName}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
