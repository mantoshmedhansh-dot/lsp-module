"use client";

import { cn } from "../utils";
import { Check, Circle } from "lucide-react";

export interface TimelineStep {
  id: string;
  label: string;
  description?: string;
  timestamp?: string;
  status: "completed" | "current" | "pending";
}

export interface OrderTimelineProps {
  steps: TimelineStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function OrderTimeline({
  steps,
  orientation = "horizontal",
  className,
}: OrderTimelineProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("relative", className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex gap-4 pb-8 last:pb-0">
            {/* Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-[15px] top-8 w-0.5 h-[calc(100%-2rem)]",
                  step.status === "completed" ? "bg-green-500" : "bg-gray-200"
                )}
              />
            )}

            {/* Icon */}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                step.status === "completed" && "bg-green-500 text-white",
                step.status === "current" &&
                  "bg-primary-500 text-white ring-4 ring-primary-100",
                step.status === "pending" && "bg-gray-200 text-gray-400"
              )}
            >
              {step.status === "completed" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>

            {/* Content */}
            <div className="pt-0.5">
              <p
                className={cn(
                  "font-medium",
                  step.status === "pending" ? "text-gray-400" : "text-gray-900"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-sm text-gray-500">{step.description}</p>
              )}
              {step.timestamp && (
                <p className="text-xs text-gray-400 mt-1">{step.timestamp}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal orientation
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            {/* Icon */}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                step.status === "completed" && "bg-green-500 text-white",
                step.status === "current" &&
                  "bg-primary-500 text-white ring-4 ring-primary-100",
                step.status === "pending" && "bg-gray-200 text-gray-400"
              )}
            >
              {step.status === "completed" ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>

            {/* Label */}
            <p
              className={cn(
                "mt-2 text-sm font-medium text-center max-w-[100px]",
                step.status === "pending" ? "text-gray-400" : "text-gray-900"
              )}
            >
              {step.label}
            </p>
            {step.timestamp && (
              <p className="text-xs text-gray-400 text-center">
                {step.timestamp}
              </p>
            )}
          </div>

          {/* Connector */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-16 mx-2",
                step.status === "completed" ? "bg-green-500" : "bg-gray-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
