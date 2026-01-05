"use client";

import { useState, useRef, useEffect } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { User, LogOut, ChevronDown, Shield, Building2, UserCog } from "lucide-react";

export function UserMenu() {
  const { user, logout } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return {
          label: "Super Admin",
          className: "bg-purple-100 text-purple-700",
          icon: Shield,
        };
      case "HUB_MANAGER":
        return {
          label: "Hub Manager",
          className: "bg-blue-100 text-blue-700",
          icon: Building2,
        };
      case "OPERATOR":
        return {
          label: "Operator",
          className: "bg-green-100 text-green-700",
          icon: UserCog,
        };
      default:
        return {
          label: role,
          className: "bg-gray-100 text-gray-700",
          icon: User,
        };
    }
  };

  const roleBadge = getRoleBadge(user.role);
  const RoleIcon = roleBadge.icon;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium text-sm">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
            {user.name}
          </div>
          <div className={`text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${roleBadge.className}`}>
            <RoleIcon className="h-3 w-3" />
            {roleBadge.label}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="font-medium text-gray-900">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
            <div className={`mt-2 text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${roleBadge.className}`}>
              <RoleIcon className="h-3 w-3" />
              {roleBadge.label}
            </div>
            {user.hubName && (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {user.hubCode} - {user.hubName}
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
