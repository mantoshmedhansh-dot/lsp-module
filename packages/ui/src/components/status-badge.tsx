"use client";

import { STATUS_LABELS, STATUS_COLORS } from "@cjdquick/types";
import { cn } from "../utils";
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  XCircle,
  Clock,
  MapPin,
  Send,
  ClipboardCheck,
} from "lucide-react";

const STATUS_ICONS: Record<string, React.ElementType> = {
  CREATED: Package,
  PARTNER_ASSIGNED: ClipboardCheck,
  AWB_GENERATED: ClipboardCheck,
  PICKUP_SCHEDULED: Clock,
  PICKUP_PENDING: Clock,
  PICKED: ClipboardCheck,
  PACKING: Package,
  PACKED: Package,
  LABELLED: Package,
  READY_TO_DISPATCH: Send,
  DISPATCHED: Send,
  HANDED_OVER: Send,
  IN_TRANSIT: Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle,
  NDR: AlertCircle,
  RTO_INITIATED: RotateCcw,
  RTO_IN_TRANSIT: RotateCcw,
  RTO_DELIVERED: RotateCcw,
  CANCELLED: XCircle,
  LOST: XCircle,
};

export interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  showIcon = true,
  size = "md",
  className,
}: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.CREATED;
  const label = STATUS_LABELS[status] || status;
  const Icon = STATUS_ICONS[status] || Package;

  const sizes = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-sm gap-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        colors.bg,
        colors.text,
        sizes[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  );
}
