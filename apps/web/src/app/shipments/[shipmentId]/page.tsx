"use client";

import { use } from "react";
import {
  Package,
  MapPin,
  Clock,
  Truck,
  Building2,
  CheckCircle2,
  ArrowRight,
  Phone,
  User,
  Weight,
  Box,
  Handshake,
  AlertCircle,
} from "lucide-react";
import { Card, Badge } from "@cjdquick/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  BOOKED: "secondary",
  PICKED_UP: "info",
  IN_HUB: "primary",
  CONSOLIDATED: "primary",
  LOADED: "primary",
  IN_TRANSIT: "warning",
  WITH_PARTNER: "purple",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  DELIVERY_FAILED: "danger",
  RTO_INITIATED: "danger",
};

const LEG_TYPE_ICONS: Record<string, any> = {
  FIRST_MILE: MapPin,
  LINE_HAUL: Truck,
  TRANSSHIPMENT: Building2,
  LAST_MILE: Package,
};

interface PageProps {
  params: Promise<{ shipmentId: string }>;
}

export default function ShipmentTrackingPage({ params }: PageProps) {
  const { shipmentId } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shipment", shipmentId],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${shipmentId}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Shipment Not Found</h2>
        <p className="text-gray-500">
          AWB {shipmentId} could not be found in our system
        </p>
      </div>
    );
  }

  const shipment = data.data;
  const legs = shipment.legs || [];
  const events = shipment.events || [];
  const scans = shipment.scans || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">
              {shipment.awbNumber}
            </h1>
            <Badge
              variant={(STATUS_COLORS[shipment.status] as any) || "secondary"}
              size="lg"
            >
              {shipment.status.replace(/_/g, " ")}
            </Badge>
            {shipment.fulfillmentMode && (
              <Badge
                variant={
                  shipment.fulfillmentMode === "OWN_FLEET"
                    ? "success"
                    : shipment.fulfillmentMode === "HYBRID"
                    ? "warning"
                    : "info"
                }
              >
                {shipment.fulfillmentMode.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            Booked on {new Date(shipment.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Shipment Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* Shipper & Consignee */}
          <Card>
            <div className="p-5 space-y-6">
              {/* Shipper */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  SHIPPER
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{shipment.shipperName}</span>
                  </div>
                  {shipment.shipperPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{shipment.shipperPhone}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="text-sm text-gray-600">
                      <p>{shipment.shipperAddress}</p>
                      <p>
                        {shipment.shipperCity}, {shipment.shipperState}{" "}
                        {shipment.shipperPincode}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-gray-300 rotate-90" />
              </div>

              {/* Consignee */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  CONSIGNEE
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{shipment.consigneeName}</span>
                  </div>
                  {shipment.consigneePhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{shipment.consigneePhone}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="text-sm text-gray-600">
                      <p>{shipment.consigneeAddress}</p>
                      <p>
                        {shipment.consigneeCity}, {shipment.consigneeState}{" "}
                        {shipment.consigneePincode}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Package Details */}
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                PACKAGE DETAILS
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Pieces</p>
                    <p className="font-medium">{shipment.pieces || 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Weight className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Weight</p>
                    <p className="font-medium">
                      {shipment.chargeableWeightKg?.toFixed(2) || "-"} kg
                    </p>
                  </div>
                </div>
              </div>
              {shipment.contentDescription && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">Content</p>
                  <p className="text-sm">{shipment.contentDescription}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Partner Info (if HYBRID/PARTNER) */}
          {shipment.partner && (
            <Card>
              <div className="p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Handshake className="h-4 w-4" />
                  PARTNER DELIVERY
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partner</span>
                    <span className="font-medium">
                      {shipment.partner.displayName || shipment.partner.name}
                    </span>
                  </div>
                  {shipment.partnerAwb && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Partner AWB</span>
                      <span className="font-mono">{shipment.partnerAwb}</span>
                    </div>
                  )}
                  {shipment.handedOverToPartner && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Handover Time</span>
                      <span className="text-sm">
                        {new Date(shipment.partnerHandoverTime).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Journey & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Journey Plan Visualization */}
          {legs.length > 0 && (
            <Card>
              <div className="p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-4">
                  JOURNEY PLAN
                </h3>
                <div className="flex items-center justify-between overflow-x-auto pb-4">
                  {legs.map((leg: any, index: number) => {
                    const LegIcon = LEG_TYPE_ICONS[leg.legType] || Truck;
                    const isCompleted = leg.status === "COMPLETED";
                    const isActive = leg.status === "IN_TRANSIT";
                    const isPending = leg.status === "PENDING";

                    return (
                      <div
                        key={leg.id}
                        className="flex items-center flex-shrink-0"
                      >
                        {/* Leg Node */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? "bg-green-100 text-green-600"
                                : isActive
                                ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <LegIcon className="h-6 w-6" />
                            )}
                          </div>
                          <div className="mt-2 text-center">
                            <p className="text-xs font-medium text-gray-600">
                              {leg.legType.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-gray-500 max-w-[100px] truncate">
                              {leg.fromLocation} → {leg.toLocation}
                            </p>
                            {leg.mode === "PARTNER" && (
                              <Badge variant="purple" size="sm" className="mt-1">
                                Partner
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Connector Line */}
                        {index < legs.length - 1 && (
                          <div
                            className={`w-16 h-0.5 mx-2 ${
                              isCompleted ? "bg-green-400" : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Current Location */}
          {shipment.currentHub && (
            <Card className="bg-primary-50 border-primary-200">
              <div className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary-100 rounded-full">
                  <Building2 className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-primary-600 font-medium">
                    Current Location
                  </p>
                  <p className="text-lg font-semibold text-primary-900">
                    {shipment.currentHub.name}, {shipment.currentHub.city}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Events Timeline */}
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                TRACKING HISTORY
              </h3>
              <div className="space-y-4">
                {events.length === 0 && scans.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No tracking events yet
                  </p>
                ) : (
                  [...events]
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.eventTime).getTime() -
                        new Date(a.eventTime).getTime()
                    )
                    .map((event: any, index: number) => (
                      <div key={event.id} className="flex gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              index === 0
                                ? "bg-primary-600 ring-4 ring-primary-100"
                                : "bg-gray-300"
                            }`}
                          />
                          {index < events.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>

                        {/* Event Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {event.statusText}
                              </p>
                              {event.location && (
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">
                                {new Date(event.eventTime).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(event.eventTime).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          {event.source && (
                            <Badge
                              variant="secondary"
                              size="sm"
                              className="mt-1"
                            >
                              {event.source}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
