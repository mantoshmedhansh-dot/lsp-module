"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  MapPin,
  Truck,
  Route,
  Radio,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const mainNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/shipments", label: "Shipments", icon: Package },
  { href: "/hubs", label: "Hubs", icon: MapPin },
  { href: "/fleet", label: "Fleet", icon: Truck },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/control-tower", label: "Control Tower", icon: Radio },
  { href: "/admin", label: "Admin", icon: Settings },
];

export default function GlobalHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show on admin pages (they have their own header)
  if (pathname?.startsWith("/admin")) return null;
  // Don't show on control-tower pages (they have their own header)
  if (pathname?.startsWith("/control-tower")) return null;
  // Don't show on customer pages (they have their own header)
  if (pathname?.startsWith("/customer")) return null;
  // Don't show on operations pages (they have their own header)
  if (pathname?.startsWith("/operations")) return null;
  // Don't show on compliance pages (they have their own header)
  if (pathname?.startsWith("/compliance")) return null;
  // Don't show on client pages (they have their own header)
  if (pathname?.startsWith("/client")) return null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo & Home - hidden on home page */}
          {pathname !== "/" && (
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
              >
                <Home className="h-4 w-4" />
                <span className="font-medium">Home</span>
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <Package className="h-7 w-7 text-primary-600" />
                <span className="font-bold text-lg text-gray-900 hidden sm:inline">CJDarcl Quick</span>
              </Link>
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {mainNavItems.slice(1).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-3 space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
