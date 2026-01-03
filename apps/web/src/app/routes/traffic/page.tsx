"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import {
  Navigation,
  RefreshCw,
  Clock,
  Fuel,
  AlertTriangle,
  Cloud,
  MapPin,
  TrendingUp,
  Car,
  Truck,
} from "lucide-react";

interface TrafficRoute {
  id: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  distanceMeters: number;
  durationMinutes: number;
  durationInTraffic: number;
  trafficLevel: string;
  congestionScore: number;
  estimatedTollCost: number;
  estimatedFuelCost: number;
  tollPlazaCount: number;
  weatherCondition?: string;
  weatherDelayMinutes: number;
  optimizationType: string;
  tripId?: string;
  calculatedAt: string;
  validUntil: string;
}

interface TollPlaza {
  id: string;
  name: string;
  code: string;
  highway?: string;
  state: string;
  busTruckSingleTrip: number;
}

interface WeatherAlert {
  id: string;
  region: string;
  state: string;
  alertType: string;
  severity: string;
  headline: string;
  impactOnDelivery?: string;
  effectiveFrom: string;
  effectiveUntil: string;
}

interface TrafficIncident {
  id: string;
  roadName?: string;
  city?: string;
  incidentType: string;
  severity: string;
  description?: string;
  delayMinutes: number;
}

export default function TrafficRoutePage() {
  const [routes, setRoutes] = useState<TrafficRoute[]>([]);
  const [tollPlazas, setTollPlazas] = useState<TollPlaza[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Route calculator state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await fetch("/api/routes/traffic");
      const data = await response.json();

      if (data.success) {
        setRoutes(data.data.routes || []);
        setTollPlazas(data.data.tollPlazas || []);
        setWeatherAlerts(data.data.weatherAlerts || []);
        setTrafficIncidents(data.data.trafficIncidents || []);
      }
    } catch (error) {
      console.error("Failed to fetch traffic data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function calculateRoute() {
    setCalculating(true);
    try {
      // Mock coordinates for demo (in production, use geocoding)
      const response = await fetch("/api/routes/traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CALCULATE_ROUTE",
          originLat: 28.6139 + Math.random() * 0.1,
          originLng: 77.2090 + Math.random() * 0.1,
          destinationLat: 19.0760 + Math.random() * 0.1,
          destinationLng: 72.8777 + Math.random() * 0.1,
          optimizationType: "FASTEST",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setRoutes([data.data, ...routes]);
      }
    } catch (error) {
      console.error("Failed to calculate route:", error);
    } finally {
      setCalculating(false);
    }
  }

  const getTrafficBadge = (level: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "info"> = {
      LIGHT: "success",
      NORMAL: "info",
      HEAVY: "warning",
      SEVERE: "danger",
    };
    return <Badge variant={colors[level] || "default"}>{level}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "info"> = {
      LOW: "success",
      MODERATE: "warning",
      HIGH: "danger",
      SEVERE: "danger",
    };
    return <Badge variant={colors[severity] || "default"}>{severity}</Badge>;
  };

  const getWeatherIcon = (type: string) => {
    const icons: Record<string, string> = {
      RAIN: "🌧️",
      STORM: "⛈️",
      FOG: "🌫️",
      FLOOD: "🌊",
      CYCLONE: "🌀",
      HEATWAVE: "🔥",
      CLEAR: "☀️",
    };
    return icons[type] || "🌤️";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="h-6 w-6 text-blue-500" />
            Traffic-Based Route Optimization
          </h1>
          <p className="text-muted-foreground">Real-time traffic, toll, and weather-aware routing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Toll Plazas</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tollPlazas.length}</div>
            <p className="text-xs text-muted-foreground">Registered toll points</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weather Alerts</CardTitle>
            <Cloud className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{weatherAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Traffic Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{trafficIncidents.length}</div>
            <p className="text-xs text-muted-foreground">Current incidents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Routes Calculated</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{routes.length}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Route Calculator */}
      <Card>
        <CardHeader>
          <CardTitle>Calculate Route</CardTitle>
          <p className="text-sm text-muted-foreground">Get optimized route with traffic, tolls, and weather</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">Origin</label>
              <Input
                placeholder="Enter origin address or coordinates"
                value={origin}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrigin(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">Destination</label>
              <Input
                placeholder="Enter destination address or coordinates"
                value={destination}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestination(e.target.value)}
              />
            </div>
            <Button onClick={calculateRoute} disabled={calculating}>
              {calculating ? "Calculating..." : "Calculate Route"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["overview", "weather", "incidents", "tolls"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab === "overview" ? "Recent Routes" : tab}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Route Calculations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : routes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Navigation className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No routes calculated yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Route</th>
                      <th className="px-4 py-2 text-left font-medium">Distance</th>
                      <th className="px-4 py-2 text-left font-medium">Duration</th>
                      <th className="px-4 py-2 text-left font-medium">Traffic</th>
                      <th className="px-4 py-2 text-left font-medium">Tolls</th>
                      <th className="px-4 py-2 text-left font-medium">Fuel</th>
                      <th className="px-4 py-2 text-left font-medium">Weather</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => (
                      <tr key={route.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="text-xs font-mono">
                            {route.originLat.toFixed(2)}, {route.originLng.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">to</div>
                          <div className="text-xs font-mono">
                            {route.destinationLat.toFixed(2)}, {route.destinationLng.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {(route.distanceMeters / 1000).toFixed(1)} km
                        </td>
                        <td className="px-4 py-2">
                          <div>{Math.round(route.durationMinutes)} min</div>
                          {route.durationInTraffic > route.durationMinutes && (
                            <div className="text-xs text-red-500">
                              +{route.durationInTraffic - route.durationMinutes} traffic
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2">{getTrafficBadge(route.trafficLevel)}</td>
                        <td className="px-4 py-2">
                          <div>Rs. {route.estimatedTollCost}</div>
                          <div className="text-xs text-muted-foreground">{route.tollPlazaCount} plazas</div>
                        </td>
                        <td className="px-4 py-2">Rs. {route.estimatedFuelCost}</td>
                        <td className="px-4 py-2">
                          {route.weatherCondition ? (
                            <div className="flex items-center gap-1">
                              {getWeatherIcon(route.weatherCondition)}
                              {route.weatherDelayMinutes > 0 && (
                                <span className="text-xs text-yellow-600">+{route.weatherDelayMinutes}min</span>
                              )}
                            </div>
                          ) : (
                            "Clear"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "weather" && (
        <Card>
          <CardHeader>
            <CardTitle>Active Weather Alerts</CardTitle>
            <p className="text-sm text-muted-foreground">Weather conditions affecting deliveries</p>
          </CardHeader>
          <CardContent>
            {weatherAlerts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Cloud className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No active weather alerts</p>
              </div>
            ) : (
              <div className="space-y-4">
                {weatherAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getWeatherIcon(alert.alertType)}</span>
                        <div>
                          <div className="font-medium">{alert.headline}</div>
                          <div className="text-sm text-muted-foreground">{alert.region}, {alert.state}</div>
                        </div>
                      </div>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Impact: </span>
                      {alert.impactOnDelivery || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Valid: {new Date(alert.effectiveFrom).toLocaleString()} - {new Date(alert.effectiveUntil).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "incidents" && (
        <Card>
          <CardHeader>
            <CardTitle>Traffic Incidents</CardTitle>
            <p className="text-sm text-muted-foreground">Current road incidents and delays</p>
          </CardHeader>
          <CardContent>
            {trafficIncidents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No active traffic incidents</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-left font-medium">Location</th>
                      <th className="px-4 py-2 text-left font-medium">Severity</th>
                      <th className="px-4 py-2 text-left font-medium">Delay</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficIncidents.map((incident) => (
                      <tr key={incident.id} className="border-b">
                        <td className="px-4 py-2">{incident.incidentType}</td>
                        <td className="px-4 py-2">
                          {incident.roadName || incident.city || "Unknown"}
                        </td>
                        <td className="px-4 py-2">{getSeverityBadge(incident.severity)}</td>
                        <td className="px-4 py-2">+{incident.delayMinutes} min</td>
                        <td className="px-4 py-2 text-muted-foreground">{incident.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "tolls" && (
        <Card>
          <CardHeader>
            <CardTitle>Toll Plazas</CardTitle>
            <p className="text-sm text-muted-foreground">Registered toll plazas with rates</p>
          </CardHeader>
          <CardContent>
            {tollPlazas.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No toll plazas registered</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Code</th>
                      <th className="px-4 py-2 text-left font-medium">Highway</th>
                      <th className="px-4 py-2 text-left font-medium">State</th>
                      <th className="px-4 py-2 text-left font-medium">Truck Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tollPlazas.map((plaza) => (
                      <tr key={plaza.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{plaza.name}</td>
                        <td className="px-4 py-2 font-mono text-xs">{plaza.code}</td>
                        <td className="px-4 py-2">{plaza.highway || "-"}</td>
                        <td className="px-4 py-2">{plaza.state}</td>
                        <td className="px-4 py-2">Rs. {plaza.busTruckSingleTrip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
