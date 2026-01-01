"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Search,
  RefreshCw,
  Building2,
  Package,
  Truck,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";

interface HubWithPincodes {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  servicedPincodes: {
    id: string;
    pincode: string;
    type: string;
    priority: number;
  }[];
}

async function fetchHubsWithPincodes() {
  const res = await fetch("/api/hubs?pageSize=100&includePincodes=true");
  return res.json();
}

async function checkPincodeServiceability(pincode: string) {
  const res = await fetch(`/api/hubs/nearest?pincode=${pincode}`);
  return res.json();
}

export default function AdminPincodesPage() {
  const [searchPincode, setSearchPincode] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-hubs-pincodes"],
    queryFn: fetchHubsWithPincodes,
  });

  const hubs = data?.data?.items || [];

  // Calculate coverage stats
  const allPincodes = new Set<string>();
  const pickupPincodes = new Set<string>();
  const deliveryPincodes = new Set<string>();

  hubs.forEach((hub: HubWithPincodes) => {
    hub.servicedPincodes?.forEach((p) => {
      allPincodes.add(p.pincode);
      if (p.type === "PICKUP" || p.type === "BOTH") pickupPincodes.add(p.pincode);
      if (p.type === "DELIVERY" || p.type === "BOTH") deliveryPincodes.add(p.pincode);
    });
  });

  const handleSearch = async () => {
    if (!searchPincode || searchPincode.length !== 6) return;
    setSearching(true);
    try {
      const result = await checkPincodeServiceability(searchPincode);
      setSearchResult(result);
    } catch (error) {
      setSearchResult({ success: false, error: "Failed to check" });
    }
    setSearching(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pincode Coverage</h1>
        <p className="text-gray-500">
          View and manage pincode serviceability across hub network
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allPincodes.size}</p>
              <p className="text-sm text-gray-500">Total Pincodes</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pickupPincodes.size}</p>
              <p className="text-sm text-gray-500">Pickup Enabled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{deliveryPincodes.size}</p>
              <p className="text-sm text-gray-500">Delivery Enabled</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{hubs.length}</p>
              <p className="text-sm text-gray-500">Active Hubs</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pincode Checker */}
      <Card>
        <div className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4">
            Check Pincode Serviceability
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter 6-digit pincode"
                value={searchPincode}
                onChange={(e) => {
                  setSearchPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setSearchResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Check"
              )}
            </Button>
          </div>

          {searchResult && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50">
              {searchResult.success && searchResult.data ? (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <MapPin className="h-5 w-5" />
                    <span className="font-medium">
                      Pincode {searchPincode} is serviceable!
                    </span>
                  </div>
                  {searchResult.data.pickup && (
                    <p className="text-sm">
                      <span className="font-medium">Pickup Hub:</span>{" "}
                      {searchResult.data.pickup.name} ({searchResult.data.pickup.code})
                    </p>
                  )}
                  {searchResult.data.delivery && (
                    <p className="text-sm">
                      <span className="font-medium">Delivery Hub:</span>{" "}
                      {searchResult.data.delivery.name} ({searchResult.data.delivery.code})
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <MapPin className="h-5 w-5" />
                  <span>Pincode {searchPincode} is not currently serviceable</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Hub Coverage Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <p className="ml-2 text-gray-500">Loading coverage data...</p>
        </div>
      ) : (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Hub Coverage</h2>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {hubs.map((hub: HubWithPincodes) => (
                <div
                  key={hub.id}
                  className="p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {hub.code} - {hub.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {hub.city}, {hub.state}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary-600">
                      {hub.servicedPincodes?.length || 0} pincodes
                    </span>
                  </div>
                  {hub.servicedPincodes && hub.servicedPincodes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {hub.servicedPincodes.slice(0, 20).map((p) => (
                        <span
                          key={p.id}
                          className={`px-2 py-1 text-xs rounded ${
                            p.type === "BOTH"
                              ? "bg-purple-100 text-purple-700"
                              : p.type === "PICKUP"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {p.pincode}
                          <span className="text-xs opacity-70 ml-1">
                            ({p.type === "BOTH" ? "P+D" : p.type[0]})
                          </span>
                        </span>
                      ))}
                      {hub.servicedPincodes.length > 20 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{hub.servicedPincodes.length - 20} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {hubs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No hubs configured yet</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
