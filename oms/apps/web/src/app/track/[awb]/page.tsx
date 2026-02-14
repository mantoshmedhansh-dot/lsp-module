"use client";

import { useState, useEffect, use } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface TrackingEvent {
  timestamp: string | null;
  status: string;
  location: string;
  isTerminal: boolean;
}

interface TrackingData {
  success: boolean;
  awbNumber: string;
  currentStatus: string;
  carrierName: string;
  expectedDelivery: string | null;
  consigneeName: string;
  deliveryCity: string;
  events: TrackingEvent[];
  branding: {
    companyName?: string;
    logo?: string;
    brandColor?: string;
  };
  error?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "text-gray-700", bgColor: "bg-gray-100", icon: Clock },
  PACKED: { label: "Packed", color: "text-blue-700", bgColor: "bg-blue-100", icon: Package },
  MANIFESTED: { label: "Manifested", color: "text-blue-700", bgColor: "bg-blue-100", icon: Package },
  SHIPPED: { label: "Shipped", color: "text-blue-700", bgColor: "bg-blue-100", icon: Truck },
  IN_TRANSIT: { label: "In Transit", color: "text-yellow-700", bgColor: "bg-yellow-100", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-orange-700", bgColor: "bg-orange-100", icon: Truck },
  DELIVERED: { label: "Delivered", color: "text-green-700", bgColor: "bg-green-100", icon: CheckCircle },
  NDR: { label: "Delivery Exception", color: "text-red-700", bgColor: "bg-red-100", icon: AlertCircle },
  RTO: { label: "Return to Origin", color: "text-red-700", bgColor: "bg-red-100", icon: RefreshCw },
  RTO_INITIATED: { label: "RTO Initiated", color: "text-red-700", bgColor: "bg-red-100", icon: RefreshCw },
  RTO_IN_TRANSIT: { label: "RTO In Transit", color: "text-red-700", bgColor: "bg-red-100", icon: RefreshCw },
  RTO_DELIVERED: { label: "RTO Delivered", color: "text-red-700", bgColor: "bg-red-100", icon: RefreshCw },
};

function getStatusIcon(status: string) {
  const config = statusConfig[status];
  if (config) return config.icon;
  if (status.includes("DELIVER")) return CheckCircle;
  if (status.includes("TRANSIT") || status.includes("SHIP")) return Truck;
  return Package;
}

export default function TrackingPage({
  params,
}: {
  params: Promise<{ awb: string }>;
}) {
  const { awb } = use(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracking();
  }, [awb]);

  async function fetchTracking() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/public/track/${awb}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Shipment not found");
      }
      const result = await res.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tracking");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading tracking information...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Shipment Not Found</h2>
        <p className="text-muted-foreground text-center">
          {error || "No tracking information available for this AWB number."}
        </p>
        <p className="text-sm text-muted-foreground font-mono">{awb}</p>
      </div>
    );
  }

  const statusInfo = statusConfig[data.currentStatus] || {
    label: data.currentStatus,
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Package,
  };
  const StatusIcon = statusInfo.icon;

  const brandColor = data.branding?.brandColor || "#2563eb";

  return (
    <div className="space-y-6">
      {/* Header with branding */}
      <div className="text-center space-y-2">
        {data.branding?.logo ? (
          <img
            src={data.branding.logo}
            alt={data.branding.companyName || "Company"}
            className="h-10 mx-auto"
          />
        ) : data.branding?.companyName ? (
          <h1 className="text-xl font-bold" style={{ color: brandColor }}>
            {data.branding.companyName}
          </h1>
        ) : null}
        <p className="text-sm text-muted-foreground">Shipment Tracking</p>
      </div>

      {/* AWB + Status */}
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">AWB Number</p>
            <p className="text-lg font-mono font-bold">{data.awbNumber}</p>
          </div>

          <Badge className={`${statusInfo.bgColor} ${statusInfo.color} text-base px-4 py-2`}>
            <StatusIcon className="mr-2 h-5 w-5" />
            {statusInfo.label}
          </Badge>

          {data.expectedDelivery && (
            <div>
              <p className="text-sm text-muted-foreground">Expected Delivery</p>
              <p className="font-medium">{data.expectedDelivery}</p>
            </div>
          )}

          {data.carrierName && (
            <p className="text-sm text-muted-foreground">
              Shipped via <span className="font-medium text-foreground">{data.carrierName}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delivery Info */}
      {(data.consigneeName || data.deliveryCity) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                {data.consigneeName && (
                  <p className="font-medium">{data.consigneeName}</p>
                )}
                {data.deliveryCity && (
                  <p className="text-sm text-muted-foreground">{data.deliveryCity}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {data.events.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-4">Tracking Timeline</h3>
            <div className="space-y-0">
              {data.events.map((event, i) => {
                const isFirst = i === 0;
                const isLast = i === data.events.length - 1;
                const EventIcon = event.isTerminal ? CheckCircle : getStatusIcon(event.status);

                return (
                  <div key={i} className="flex gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isFirst
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <EventIcon className="h-4 w-4" />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 h-full min-h-[40px] bg-border" />
                      )}
                    </div>

                    {/* Event content */}
                    <div className={`pb-6 ${isFirst ? "font-medium" : ""}`}>
                      <p className="text-sm">{event.status}</p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground">{event.location}</p>
                      )}
                      {event.timestamp && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.timestamp).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Powered by {data.branding?.companyName || "CJDQuick OMS"}
      </p>
    </div>
  );
}
