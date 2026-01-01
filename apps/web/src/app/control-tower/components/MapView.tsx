"use client";

import { useState, useCallback, useMemo } from "react";
import Map, { Marker, Source, Layer, Popup, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Truck,
  MapPin,
  Navigation,
  RefreshCw,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@cjdquick/ui";

// Import Mapbox CSS
import "mapbox-gl/dist/mapbox-gl.css";

interface Hub {
  id: string;
  code: string;
  name: string;
  type: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  utilizationPercent: number;
  shipmentsInHub: number;
  capacity: number;
}

interface Vehicle {
  id: string;
  regNo: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  lastUpdate: string | null;
  currentTripId: string | null;
  tripNumber: string | null;
}

interface TripRoute {
  id: string;
  tripNumber: string;
  status: string;
  isDelayed: boolean;
  originHub: { code: string; lat: number; lng: number };
  destHub: { code: string; lat: number; lng: number };
  currentPosition: { lat: number; lng: number } | null;
}

interface MapData {
  hubs: Hub[];
  vehicles: Vehicle[];
  tripRoutes: TripRoute[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

// Fetch map data
async function fetchMapData(): Promise<{ success: boolean; data: MapData }> {
  const res = await fetch("/api/control-tower/map-data");
  if (!res.ok) throw new Error("Failed to fetch map data");
  return res.json();
}

// Hub marker component
function HubMarker({ hub, onClick }: { hub: Hub; onClick: () => void }) {
  const color =
    hub.utilizationPercent > 90
      ? "bg-red-500"
      : hub.utilizationPercent > 70
      ? "bg-amber-500"
      : "bg-green-500";

  return (
    <Marker latitude={hub.lat} longitude={hub.lng} onClick={onClick}>
      <div
        className={`w-8 h-8 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center shadow-lg cursor-pointer border-2 border-white hover:scale-110 transition-transform`}
        title={`${hub.name} (${hub.utilizationPercent}%)`}
      >
        {hub.code.slice(0, 2)}
      </div>
    </Marker>
  );
}

// Vehicle marker component
function VehicleMarker({ vehicle, onClick }: { vehicle: Vehicle; onClick: () => void }) {
  const isMoving = vehicle.status === "IN_TRANSIT";

  return (
    <Marker latitude={vehicle.lat} longitude={vehicle.lng} onClick={onClick}>
      <div
        className={`relative cursor-pointer hover:scale-110 transition-transform ${
          isMoving ? "animate-pulse" : ""
        }`}
        title={`${vehicle.regNo} - ${vehicle.status}`}
      >
        <Truck
          className={`h-6 w-6 ${isMoving ? "text-blue-600" : "text-gray-500"}`}
        />
        {isMoving && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </div>
    </Marker>
  );
}

export default function MapView({ autoRefresh = true }: { autoRefresh?: boolean }) {
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [visibleLayers, setVisibleLayers] = useState({
    hubs: true,
    vehicles: true,
    routes: true,
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["control-tower", "map-data"],
    queryFn: fetchMapData,
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 25000,
  });

  const mapData = data?.data;

  // Generate route lines GeoJSON
  const routeLinesGeoJSON = useMemo(() => {
    if (!mapData?.tripRoutes) return null;

    const features = mapData.tripRoutes.map((route) => ({
      type: "Feature" as const,
      properties: {
        id: route.id,
        tripNumber: route.tripNumber,
        status: route.status,
        isDelayed: route.isDelayed,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [route.originHub.lng, route.originHub.lat],
          ...(route.currentPosition
            ? [[route.currentPosition.lng, route.currentPosition.lat]]
            : []),
          [route.destHub.lng, route.destHub.lat],
        ],
      },
    }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [mapData?.tripRoutes]);

  const toggleLayer = useCallback((layer: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  // Show placeholder if no Mapbox token
  if (!mapboxToken) {
    return (
      <div className="h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Map Configuration Required
        </h3>
        <p className="text-gray-600 text-center mb-4 max-w-md">
          Add your Mapbox token to enable the interactive map. Get a free token at{" "}
          <a
            href="https://www.mapbox.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 underline"
          >
            mapbox.com
          </a>
        </p>
        <code className="bg-gray-800 text-green-400 px-4 py-2 rounded text-sm">
          NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
        </code>

        {/* Show summary stats */}
        {mapData && (
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600">{mapData.hubs.length} Hubs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-gray-600">{mapData.vehicles.length} Vehicles</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-gray-600">{mapData.tripRoutes.length} Active Routes</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
        <span className="ml-2 text-gray-600">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded-lg overflow-hidden">
      {/* Layer Controls */}
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-md z-10">
        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Layers
        </h4>
        <div className="space-y-2">
          {Object.entries(visibleLayers).map(([layer, visible]) => (
            <label key={layer} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggleLayer(layer as keyof typeof visibleLayers)}
                className="rounded text-primary-600"
              />
              <span className="capitalize">{layer}</span>
            </label>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={() => refetch()}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Map */}
      <Map
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: 78.9629,
          latitude: 20.5937,
          zoom: 4.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
      >
        <NavigationControl position="top-right" />

        {/* Route Lines */}
        {visibleLayers.routes && routeLinesGeoJSON && (
          <Source id="routes" type="geojson" data={routeLinesGeoJSON}>
            <Layer
              id="route-lines"
              type="line"
              paint={{
                "line-color": [
                  "case",
                  ["get", "isDelayed"],
                  "#EF4444", // Red for delayed
                  "#3B82F6", // Blue for on-time
                ],
                "line-width": 2,
                "line-opacity": 0.7,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {/* Hub Markers */}
        {visibleLayers.hubs &&
          mapData?.hubs.map((hub) => (
            <HubMarker
              key={hub.id}
              hub={hub}
              onClick={() => setSelectedHub(hub)}
            />
          ))}

        {/* Vehicle Markers */}
        {visibleLayers.vehicles &&
          mapData?.vehicles.map((vehicle) => (
            <VehicleMarker
              key={vehicle.id}
              vehicle={vehicle}
              onClick={() => setSelectedVehicle(vehicle)}
            />
          ))}

        {/* Hub Popup */}
        {selectedHub && (
          <Popup
            latitude={selectedHub.lat}
            longitude={selectedHub.lng}
            onClose={() => setSelectedHub(null)}
            closeButton={true}
            closeOnClick={false}
            offset={15}
          >
            <div className="p-2 min-w-[180px]">
              <h4 className="font-semibold text-gray-900">{selectedHub.name}</h4>
              <p className="text-xs text-gray-500">{selectedHub.code}</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium">{selectedHub.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilization:</span>
                  <span
                    className={`font-medium ${
                      selectedHub.utilizationPercent > 90
                        ? "text-red-600"
                        : selectedHub.utilizationPercent > 70
                        ? "text-amber-600"
                        : "text-green-600"
                    }`}
                  >
                    {selectedHub.utilizationPercent}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipments:</span>
                  <span className="font-medium">{selectedHub.shipmentsInHub}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-medium">{selectedHub.capacity}/hr</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* Vehicle Popup */}
        {selectedVehicle && (
          <Popup
            latitude={selectedVehicle.lat}
            longitude={selectedVehicle.lng}
            onClose={() => setSelectedVehicle(null)}
            closeButton={true}
            closeOnClick={false}
            offset={15}
          >
            <div className="p-2 min-w-[180px]">
              <h4 className="font-semibold text-gray-900">{selectedVehicle.regNo}</h4>
              <p className="text-xs text-gray-500">{selectedVehicle.type}</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span
                    className={`font-medium ${
                      selectedVehicle.status === "IN_TRANSIT"
                        ? "text-blue-600"
                        : "text-gray-600"
                    }`}
                  >
                    {selectedVehicle.status.replace(/_/g, " ")}
                  </span>
                </div>
                {selectedVehicle.tripNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trip:</span>
                    <span className="font-medium">{selectedVehicle.tripNumber}</span>
                  </div>
                )}
                {selectedVehicle.lastUpdate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Update:</span>
                    <span className="font-medium text-xs">
                      {new Date(selectedVehicle.lastUpdate).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-md z-10">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Hub (&lt;70% util)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Hub (70-90% util)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>Hub (&gt;90% util)</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-3 w-3 text-blue-600" />
            <span>Vehicle (In Transit)</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-3 w-3 text-gray-500" />
            <span>Vehicle (Available)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
