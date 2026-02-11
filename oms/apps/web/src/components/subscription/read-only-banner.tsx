"use client";

import { useSubscription } from "@/contexts/subscription-context";
import { Eye } from "lucide-react";

/**
 * Shows a read-only banner for brand users under an LSP
 * who can view but not modify WMS/inventory data.
 */
export function ReadOnlyBanner() {
  const { isBrandUnderLsp, isSuperAdmin } = useSubscription();

  if (isSuperAdmin || !isBrandUnderLsp) return null;

  return (
    <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 mb-4 flex items-center gap-2">
      <Eye className="h-4 w-4 text-blue-600 shrink-0" />
      <p className="text-sm text-blue-800">
        <span className="font-medium">Read-only view</span> — Your LSP manages
        this data. Contact them for changes.
      </p>
    </div>
  );
}

/**
 * Hook to check if the current user should have read-only access.
 * Brand users under an LSP get read-only on WMS pages.
 */
export function useBrandReadOnly(): boolean {
  const { isBrandUnderLsp, isSuperAdmin } = useSubscription();
  return !isSuperAdmin && isBrandUnderLsp;
}
