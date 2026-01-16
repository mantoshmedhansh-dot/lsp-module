"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Loader2,
} from "lucide-react";

interface LocationMetrics {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  avgProcessingTime: number;
  fulfillmentRate: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
}

export default function ByLocationPage() {
  const [locations, setLocations] = useState<LocationMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/client/fulfillment/by-location");
      if (!response.ok) throw new Error("Failed to fetch location data");

      const data = await response.json();
      setLocations(data.locations || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalOrders = locations.reduce((sum, loc) => sum + loc.totalOrders, 0);
  const avgFulfillmentRate = locations.length > 0
    ? locations.reduce((sum, loc) => sum + loc.fulfillmentRate, 0) / locations.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Fulfillment by Location
          </h1>
          <p className="text-gray-600">
            Compare performance across warehouse locations
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Locations</p>
              <p className="text-2xl font-bold">{locations.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Fulfillment Rate</p>
              <p className="text-2xl font-bold">{avgFulfillmentRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold">
                {locations
                  .reduce((sum, loc) => sum + loc.pendingOrders, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Location Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <div
            key={location.id}
            className={`bg-white rounded-xl p-6 shadow-sm border cursor-pointer transition-all ${
              selectedLocation === location.id
                ? "ring-2 ring-blue-500"
                : "hover:shadow-md"
            }`}
            onClick={() =>
              setSelectedLocation(
                selectedLocation === location.id ? null : location.id
              )
            }
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{location.name}</h3>
                <p className="text-sm text-gray-500">
                  {location.city}, {location.state}
                </p>
                <p className="text-xs text-gray-400 mt-1">Code: {location.code}</p>
              </div>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  location.trend === "up"
                    ? "text-green-600"
                    : location.trend === "down"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {location.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : location.trend === "down" ? (
                  <TrendingDown className="w-4 h-4" />
                ) : null}
                {location.trendPercent > 0 ? "+" : ""}
                {location.trendPercent}%
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Orders</span>
                <span className="font-semibold">
                  {location.totalOrders.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Fulfillment Rate</span>
                <span
                  className={`font-semibold ${
                    location.fulfillmentRate >= 95
                      ? "text-green-600"
                      : location.fulfillmentRate >= 90
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {location.fulfillmentRate}%
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Processing</span>
                <span className="font-semibold">{location.avgProcessingTime}h</span>
              </div>

              {/* Mini progress bars */}
              <div className="pt-2 border-t">
                <div className="flex gap-2 text-xs">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">Pending</span>
                      <span>{location.pendingOrders}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{
                          width: `${(location.pendingOrders / location.totalOrders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">Shipped</span>
                      <span>{location.shippedOrders}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(location.shippedOrders / location.totalOrders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">Delivered</span>
                      <span>{location.deliveredOrders}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: `${(location.deliveredOrders / location.totalOrders) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
