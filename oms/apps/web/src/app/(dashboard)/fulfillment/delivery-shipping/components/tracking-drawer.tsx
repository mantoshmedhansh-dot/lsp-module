"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface TrackingEvent {
  timestamp: string | null;
  statusCode: string;
  statusDescription: string;
  location: string;
  remark: string;
  omsStatus: string;
  isTerminal: boolean;
}

interface TrackingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string | null;
  deliveryNo: string;
  awbNo: string | null;
}

function getEventIcon(status: string) {
  if (status.includes("DELIVER")) return CheckCircle;
  if (status.includes("TRANSIT") || status.includes("SHIP")) return Truck;
  if (status.includes("OUT_FOR")) return Truck;
  if (status.includes("RTO")) return RefreshCw;
  if (status.includes("NDR")) return AlertCircle;
  if (status.includes("PACK")) return Package;
  return Clock;
}

export function TrackingDrawer({
  open,
  onOpenChange,
  deliveryId,
  deliveryNo,
  awbNo,
}: TrackingDrawerProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [currentStatus, setCurrentStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && deliveryId) {
      fetchTimeline();
    }
  }, [open, deliveryId]);

  async function fetchTimeline() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/shipping/tracking-timeline/${deliveryId}`);
      const data = await res.json();
      if (data.success !== false) {
        setEvents(data.events || []);
        setCurrentStatus(data.currentStatus || "");
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Tracking Timeline</SheetTitle>
          <SheetDescription>
            {deliveryNo}{awbNo ? ` — AWB: ${awbNo}` : ""}
          </SheetDescription>
        </SheetHeader>

        {currentStatus && (
          <div className="mt-4 mb-2">
            <Badge variant="outline" className="text-sm">
              {currentStatus}
            </Badge>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading tracking...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No tracking events yet</p>
            </div>
          ) : (
            <div className="space-y-0">
              {events.map((event, i) => {
                const isFirst = i === 0;
                const isLast = i === events.length - 1;
                const Icon = getEventIcon(event.omsStatus || event.statusCode);

                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isFirst
                            ? "bg-primary text-primary-foreground"
                            : event.isTerminal
                            ? "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 flex-1 min-h-[32px] bg-border" />
                      )}
                    </div>

                    <div className="pb-5 min-w-0">
                      <p className={`text-sm ${isFirst ? "font-medium" : ""}`}>
                        {event.statusDescription}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                      )}
                      {event.remark && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.remark}
                        </p>
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
