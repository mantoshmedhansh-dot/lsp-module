"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  Truck,
  Package,
  ChevronDown,
  X,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@cjdquick/ui";

interface Client {
  id: string;
  companyName: string;
  email: string | null;
  activeShipments: number;
}

interface FilterBarProps {
  selectedClientId: string | null;
  selectedFulfillmentMode: string | null;
  onClientChange: (clientId: string | null) => void;
  onFulfillmentModeChange: (mode: string | null) => void;
}

// Fetch clients
async function fetchClients(): Promise<{
  success: boolean;
  data: { clients: Client[]; totalClients: number };
}> {
  const res = await fetch("/api/control-tower/clients");
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

// Fulfillment modes for last mile selection
const FULFILLMENT_MODES = [
  { id: "OWN_FLEET", label: "Own Fleet", icon: Truck, color: "bg-green-100 text-green-800" },
  { id: "PARTNER", label: "Partner", icon: Users, color: "bg-purple-100 text-purple-800" },
  { id: "HYBRID", label: "Hybrid", icon: Package, color: "bg-amber-100 text-amber-800" },
];

export default function FilterBar({
  selectedClientId,
  selectedFulfillmentMode,
  onClientChange,
  onFulfillmentModeChange,
}: FilterBarProps) {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["control-tower", "clients"],
    queryFn: fetchClients,
    staleTime: 60000, // 1 minute
  });

  const clients = clientsData?.data?.clients || [];

  // Filter clients by search
  const filteredClients = clients.filter((client) =>
    client.companyName.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Find selected client
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".client-dropdown")) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const hasFilters = selectedClientId || selectedFulfillmentMode;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* View Level Indicator */}
        <div className="flex items-center gap-2 pr-4 border-r">
          <Building2 className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {selectedClient ? selectedClient.companyName : "All Clients (Company View)"}
          </span>
        </div>

        {/* Client Selector */}
        <div className="relative client-dropdown">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
            className="min-w-[200px] justify-between"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {selectedClient ? selectedClient.companyName : "Select Client"}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isClientDropdownOpen ? "rotate-180" : ""}`} />
          </Button>

          {isClientDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* All Clients Option */}
              <div
                onClick={() => {
                  onClientChange(null);
                  setIsClientDropdownOpen(false);
                  setClientSearch("");
                }}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b ${
                  !selectedClientId ? "bg-primary-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">All Clients (Company View)</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {clients.reduce((sum, c) => sum + c.activeShipments, 0)} shipments
                  </span>
                </div>
              </div>

              {/* Client List */}
              <div className="max-h-64 overflow-y-auto">
                {clientsLoading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    Loading clients...
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        onClientChange(client.id);
                        setIsClientDropdownOpen(false);
                        setClientSearch("");
                      }}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                        selectedClientId === client.id ? "bg-primary-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{client.companyName}</p>
                          {client.email && (
                            <p className="text-xs text-gray-500">{client.email}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          client.activeShipments > 0
                            ? "bg-primary-100 text-primary-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {client.activeShipments} active
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fulfillment Mode / Last Mile Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Last Mile:</span>
          <div className="flex gap-1">
            <Button
              variant={selectedFulfillmentMode === null ? "default" : "outline"}
              size="sm"
              onClick={() => onFulfillmentModeChange(null)}
            >
              All
            </Button>
            {FULFILLMENT_MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedFulfillmentMode === mode.id;
              return (
                <Button
                  key={mode.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFulfillmentModeChange(isSelected ? null : mode.id)}
                  className="gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {mode.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClientChange(null);
              onFulfillmentModeChange(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filter Tags */}
      {hasFilters && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500">Active filters:</span>
          {selectedClient && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
              Client: {selectedClient.companyName}
              <X
                className="h-3 w-3 cursor-pointer hover:text-primary-600"
                onClick={() => onClientChange(null)}
              />
            </span>
          )}
          {selectedFulfillmentMode && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              Mode: {FULFILLMENT_MODES.find((m) => m.id === selectedFulfillmentMode)?.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-purple-600"
                onClick={() => onFulfillmentModeChange(null)}
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
