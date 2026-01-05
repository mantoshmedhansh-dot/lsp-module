"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Package } from "lucide-react";

const ADMIN_ROLES = ["SUPER_ADMIN", "HUB_MANAGER", "OPERATOR"];

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip redirect for login page
    if (pathname === "/admin/login") {
      return;
    }

    if (!isLoading && !isAuthenticated) {
      router.push("/admin/login");
    }

    if (!isLoading && user && !ADMIN_ROLES.includes(user.role)) {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, user, router, pathname]);

  // Allow login page to render without auth
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Package className="h-12 w-12 text-primary-600 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !ADMIN_ROLES.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
