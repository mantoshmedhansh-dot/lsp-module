"use client";

import { Building2, ChevronDown, Globe } from "lucide-react";
import { useHubFilter } from "@/contexts/HubFilterContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export function HubSelector() {
  const { user } = useAdminAuth();
  const {
    selectedHubId,
    setSelectedHubId,
    allowedHubs,
    isAllHubsAllowed,
    isLoadingHubs,
    selectedHub,
  } = useHubFilter();

  // Don't show for operators (single hub - display only)
  if (user?.role === "OPERATOR") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm">
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="font-medium">{user.hubCode || "Hub"}</span>
        <span className="text-gray-500 hidden sm:inline">- {user.hubName}</span>
      </div>
    );
  }

  if (isLoadingHubs) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm animate-pulse">
        <div className="h-4 w-4 bg-gray-300 rounded"></div>
        <div className="h-4 w-24 bg-gray-300 rounded"></div>
      </div>
    );
  }

  const getHubTypeColor = (type: string) => {
    switch (type) {
      case "GATEWAY":
        return "text-purple-600";
      case "TRANSSHIPMENT":
        return "text-blue-600";
      case "SPOKE":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Building2 className="h-3 w-3" />
          <span>Hub:</span>
        </div>
        <div className="relative">
          <select
            value={selectedHubId || ""}
            onChange={(e) => setSelectedHubId(e.target.value || null)}
            className="appearance-none flex items-center gap-2 pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all min-w-[200px]"
          >
            {isAllHubsAllowed && (
              <option value="">All Hubs (Aggregated View)</option>
            )}
            {allowedHubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.code} - {hub.name} ({hub.type})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Visual indicator of current selection */}
      {selectedHub && (
        <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs">
          <span className={`font-medium ${getHubTypeColor(selectedHub.type)}`}>
            {selectedHub.type}
          </span>
        </div>
      )}
      {!selectedHubId && isAllHubsAllowed && (
        <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-xs text-purple-600">
          <Globe className="h-3 w-3" />
          <span className="font-medium">All Hubs</span>
        </div>
      )}
    </div>
  );
}
