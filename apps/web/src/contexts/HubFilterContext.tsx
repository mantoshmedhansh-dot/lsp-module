"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "./AdminAuthContext";

export interface Hub {
  id: string;
  code: string;
  name: string;
  type: string;
  parentHubId: string | null;
}

interface HubFilterContextType {
  selectedHubId: string | null; // null means "All Hubs"
  setSelectedHubId: (hubId: string | null) => void;
  allowedHubs: Hub[];
  isLoadingHubs: boolean;
  isAllHubsAllowed: boolean;
  selectedHub: Hub | null;
  getHubQueryParam: () => string | undefined;
}

const HubFilterContext = createContext<HubFilterContextType | undefined>(undefined);

export function HubFilterProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAdminAuth();
  const [selectedHubId, setSelectedHubIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Fetch allowed hubs based on user role
  const { data: hubsData, isLoading: isLoadingHubs } = useQuery({
    queryKey: ["allowed-hubs", user?.id],
    queryFn: async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) return { data: [] };

      const res = await fetch("/api/admin/hubs/allowed", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const allowedHubs: Hub[] = hubsData?.data || [];
  const isAllHubsAllowed = user?.role === "SUPER_ADMIN";

  // For operators, auto-select their hub
  useEffect(() => {
    if (user?.role === "OPERATOR" && user.hubId && !initialized) {
      setSelectedHubIdState(user.hubId);
      setInitialized(true);
    }
  }, [user, initialized]);

  // Load from localStorage on mount (for non-operators)
  useEffect(() => {
    if (user && user.role !== "OPERATOR" && !initialized && allowedHubs.length > 0) {
      const stored = localStorage.getItem("selected_hub_id");
      if (stored && stored !== "null") {
        // Validate stored hub is still allowed
        const isAllowed = allowedHubs.some((h) => h.id === stored) || isAllHubsAllowed;
        if (isAllowed) {
          setSelectedHubIdState(stored);
        }
      }
      setInitialized(true);
    }
  }, [allowedHubs, isAllHubsAllowed, user, initialized]);

  // Persist to localStorage
  const setSelectedHubId = useCallback((hubId: string | null) => {
    // Operators can't change their hub
    if (user?.role === "OPERATOR") return;

    setSelectedHubIdState(hubId);
    if (hubId) {
      localStorage.setItem("selected_hub_id", hubId);
    } else {
      localStorage.removeItem("selected_hub_id");
    }
  }, [user?.role]);

  // Get the currently selected hub object
  const selectedHub = selectedHubId
    ? allowedHubs.find((h) => h.id === selectedHubId) || null
    : null;

  // Helper to get hubId query parameter for API calls
  const getHubQueryParam = useCallback(() => {
    return selectedHubId || undefined;
  }, [selectedHubId]);

  return (
    <HubFilterContext.Provider
      value={{
        selectedHubId,
        setSelectedHubId,
        allowedHubs,
        isLoadingHubs,
        isAllHubsAllowed,
        selectedHub,
        getHubQueryParam,
      }}
    >
      {children}
    </HubFilterContext.Provider>
  );
}

export function useHubFilter() {
  const context = useContext(HubFilterContext);
  if (!context) {
    throw new Error("useHubFilter must be used within HubFilterProvider");
  }
  return context;
}
