"use client";

import { Button } from "@/components/ui/button";
import {
  Truck,
  FileText,
  Download,
  Package,
  X,
} from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onAssignCarrier: () => void;
  onCreateManifest: () => void;
  onDownloadLabels: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClear,
  onAssignCarrier,
  onCreateManifest,
  onDownloadLabels,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-primary text-primary-foreground shadow-lg rounded-lg px-6 py-3 flex items-center gap-4">
        <span className="text-sm font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-primary-foreground/30" />

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onAssignCarrier}
          >
            <Truck className="mr-1.5 h-3.5 w-3.5" />
            Assign Carrier
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCreateManifest}
          >
            <Package className="mr-1.5 h-3.5 w-3.5" />
            Create Manifest
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownloadLabels}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Labels
          </Button>
        </div>

        <div className="h-4 w-px bg-primary-foreground/30" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
