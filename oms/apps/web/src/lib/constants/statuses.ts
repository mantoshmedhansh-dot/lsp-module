/**
 * Centralized Status Configurations
 * Single source of truth for all status definitions across the application.
 *
 * Usage:
 * import { ORDER_STATUSES, getStatusConfig } from "@/lib/constants/statuses";
 *
 * // Get badge color for a status
 * const config = getStatusConfig(ORDER_STATUSES, order.status);
 * <Badge className={config.color}>{config.label}</Badge>
 *
 * // Filter dropdown
 * ORDER_STATUSES.map(s => <SelectItem value={s.value}>{s.label}</SelectItem>)
 */

export interface StatusConfig {
  value: string;
  label: string;
  color: string;
  description?: string;
}

// ============================================================================
// ORDER STATUSES
// ============================================================================

export const ORDER_STATUSES: StatusConfig[] = [
  { value: "CREATED", label: "Created", color: "bg-blue-100 text-blue-800" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-indigo-100 text-indigo-800" },
  { value: "PROCESSING", label: "Processing", color: "bg-cyan-100 text-cyan-800" },
  { value: "ALLOCATED", label: "Allocated", color: "bg-purple-100 text-purple-800" },
  { value: "PICKING", label: "Picking", color: "bg-violet-100 text-violet-800" },
  { value: "PICKED", label: "Picked", color: "bg-fuchsia-100 text-fuchsia-800" },
  { value: "PACKING", label: "Packing", color: "bg-pink-100 text-pink-800" },
  { value: "PACKED", label: "Packed", color: "bg-rose-100 text-rose-800" },
  { value: "READY_TO_SHIP", label: "Ready to Ship", color: "bg-amber-100 text-amber-800" },
  { value: "MANIFESTED", label: "Manifested", color: "bg-orange-100 text-orange-800" },
  { value: "SHIPPED", label: "Shipped", color: "bg-lime-100 text-lime-800" },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-teal-100 text-teal-800" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", color: "bg-emerald-100 text-emerald-800" },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "RETURNED", label: "Returned", color: "bg-yellow-100 text-yellow-800" },
  { value: "RTO", label: "RTO", color: "bg-orange-100 text-orange-800" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-gray-100 text-gray-800" },
  { value: "FAILED", label: "Failed", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// WAVE STATUSES
// ============================================================================

export const WAVE_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PLANNED", label: "Planned", color: "bg-blue-100 text-blue-800" },
  { value: "RELEASED", label: "Released", color: "bg-indigo-100 text-indigo-800" },
  { value: "PICKING", label: "Picking", color: "bg-yellow-100 text-yellow-800" },
  { value: "PICKED", label: "Picked", color: "bg-purple-100 text-purple-800" },
  { value: "PACKING", label: "Packing", color: "bg-pink-100 text-pink-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// PICKLIST STATUSES
// ============================================================================

export const PICKLIST_STATUSES: StatusConfig[] = [
  { value: "CREATED", label: "Created", color: "bg-gray-100 text-gray-800" },
  { value: "ASSIGNED", label: "Assigned", color: "bg-blue-100 text-blue-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// DELIVERY / SHIPMENT STATUSES
// ============================================================================

export const DELIVERY_STATUSES: StatusConfig[] = [
  { value: "CREATED", label: "Created", color: "bg-gray-100 text-gray-800" },
  { value: "LABEL_GENERATED", label: "Label Generated", color: "bg-blue-100 text-blue-800" },
  { value: "MANIFESTED", label: "Manifested", color: "bg-indigo-100 text-indigo-800" },
  { value: "PICKED_UP", label: "Picked Up", color: "bg-purple-100 text-purple-800" },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-yellow-100 text-yellow-800" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", color: "bg-orange-100 text-orange-800" },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "FAILED", label: "Failed", color: "bg-red-100 text-red-800" },
  { value: "RTO_INITIATED", label: "RTO Initiated", color: "bg-amber-100 text-amber-800" },
  { value: "RTO_IN_TRANSIT", label: "RTO In Transit", color: "bg-orange-100 text-orange-800" },
  { value: "RTO_DELIVERED", label: "RTO Delivered", color: "bg-teal-100 text-teal-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// NDR STATUSES
// ============================================================================

export const NDR_STATUSES: StatusConfig[] = [
  { value: "OPEN", label: "Open", color: "bg-red-100 text-red-800" },
  { value: "ACTION_REQUIRED", label: "Action Required", color: "bg-orange-100 text-orange-800" },
  { value: "REATTEMPT_SCHEDULED", label: "Reattempt Scheduled", color: "bg-blue-100 text-blue-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  { value: "RESOLVED", label: "Resolved", color: "bg-green-100 text-green-800" },
  { value: "RTO_INITIATED", label: "RTO Initiated", color: "bg-purple-100 text-purple-800" },
  { value: "CLOSED", label: "Closed", color: "bg-gray-100 text-gray-800" },
];

export const NDR_REASONS: StatusConfig[] = [
  { value: "CUSTOMER_UNAVAILABLE", label: "Customer Unavailable", color: "bg-yellow-100 text-yellow-800" },
  { value: "WRONG_ADDRESS", label: "Wrong Address", color: "bg-orange-100 text-orange-800" },
  { value: "ADDRESS_INCOMPLETE", label: "Address Incomplete", color: "bg-orange-100 text-orange-800" },
  { value: "PHONE_UNREACHABLE", label: "Phone Unreachable", color: "bg-red-100 text-red-800" },
  { value: "CUSTOMER_REFUSED", label: "Customer Refused", color: "bg-red-100 text-red-800" },
  { value: "COD_NOT_READY", label: "COD Not Ready", color: "bg-amber-100 text-amber-800" },
  { value: "DELIVERY_RESCHEDULED", label: "Delivery Rescheduled", color: "bg-blue-100 text-blue-800" },
  { value: "DAMAGED_PACKAGE", label: "Damaged Package", color: "bg-red-100 text-red-800" },
  { value: "OTHER", label: "Other", color: "bg-gray-100 text-gray-800" },
];

// ============================================================================
// RETURN STATUSES
// ============================================================================

export const RETURN_STATUSES: StatusConfig[] = [
  { value: "INITIATED", label: "Initiated", color: "bg-blue-100 text-blue-800" },
  { value: "PICKUP_SCHEDULED", label: "Pickup Scheduled", color: "bg-indigo-100 text-indigo-800" },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-yellow-100 text-yellow-800" },
  { value: "RECEIVED", label: "Received", color: "bg-purple-100 text-purple-800" },
  { value: "QC_PENDING", label: "QC Pending", color: "bg-orange-100 text-orange-800" },
  { value: "QC_PASSED", label: "QC Passed", color: "bg-green-100 text-green-800" },
  { value: "QC_FAILED", label: "QC Failed", color: "bg-red-100 text-red-800" },
  { value: "PROCESSED", label: "Processed", color: "bg-teal-100 text-teal-800" },
  { value: "REFUND_INITIATED", label: "Refund Initiated", color: "bg-emerald-100 text-emerald-800" },
  { value: "REFUND_COMPLETED", label: "Refund Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-gray-100 text-gray-800" },
];

export const RETURN_TYPES: StatusConfig[] = [
  { value: "CUSTOMER_RETURN", label: "Customer Return", color: "bg-blue-100 text-blue-800" },
  { value: "RTO", label: "RTO", color: "bg-orange-100 text-orange-800" },
  { value: "EXCHANGE", label: "Exchange", color: "bg-purple-100 text-purple-800" },
];

// ============================================================================
// QC STATUSES
// ============================================================================

export const QC_STATUSES: StatusConfig[] = [
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800" },
  { value: "PASSED", label: "Passed", color: "bg-green-100 text-green-800" },
  { value: "FAILED", label: "Failed", color: "bg-red-100 text-red-800" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-gray-100 text-gray-800" },
];

// ============================================================================
// INBOUND STATUSES
// ============================================================================

export const INBOUND_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received", color: "bg-blue-100 text-blue-800" },
  { value: "RECEIVED", label: "Received", color: "bg-purple-100 text-purple-800" },
  { value: "QC_IN_PROGRESS", label: "QC In Progress", color: "bg-orange-100 text-orange-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

export const PO_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "SUBMITTED", label: "Submitted", color: "bg-blue-100 text-blue-800" },
  { value: "APPROVED", label: "Approved", color: "bg-indigo-100 text-indigo-800" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received", color: "bg-yellow-100 text-yellow-800" },
  { value: "RECEIVED", label: "Received", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "CLOSED", label: "Closed", color: "bg-gray-100 text-gray-800" },
];

// ============================================================================
// FTL INDENT STATUSES
// ============================================================================

export const FTL_INDENT_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "REQUESTED", label: "Requested", color: "bg-blue-100 text-blue-800" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-indigo-100 text-indigo-800" },
  { value: "VEHICLE_ASSIGNED", label: "Vehicle Assigned", color: "bg-purple-100 text-purple-800" },
  { value: "IN_TRANSIT", label: "In Transit", color: "bg-yellow-100 text-yellow-800" },
  { value: "DELIVERED", label: "Delivered", color: "bg-green-100 text-green-800" },
  { value: "POD_RECEIVED", label: "POD Received", color: "bg-teal-100 text-teal-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// INVOICE / FINANCE STATUSES
// ============================================================================

export const INVOICE_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "SENT", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "PARTIALLY_PAID", label: "Partially Paid", color: "bg-orange-100 text-orange-800" },
  { value: "PAID", label: "Paid", color: "bg-green-100 text-green-800" },
  { value: "OVERDUE", label: "Overdue", color: "bg-red-100 text-red-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-gray-100 text-gray-800" },
];

export const COD_STATUSES: StatusConfig[] = [
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "COLLECTED", label: "Collected", color: "bg-blue-100 text-blue-800" },
  { value: "REMITTED", label: "Remitted", color: "bg-green-100 text-green-800" },
  { value: "DISPUTED", label: "Disputed", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// QUOTATION STATUSES
// ============================================================================

export const QUOTATION_STATUSES: StatusConfig[] = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "SENT", label: "Sent", color: "bg-blue-100 text-blue-800" },
  { value: "VIEWED", label: "Viewed", color: "bg-indigo-100 text-indigo-800" },
  { value: "ACCEPTED", label: "Accepted", color: "bg-green-100 text-green-800" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
  { value: "EXPIRED", label: "Expired", color: "bg-gray-100 text-gray-800" },
  { value: "CONVERTED", label: "Converted to Order", color: "bg-emerald-100 text-emerald-800" },
];

// ============================================================================
// CHANNEL SYNC STATUSES
// ============================================================================

export const SYNC_STATUSES: StatusConfig[] = [
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800" },
  { value: "SUCCESS", label: "Success", color: "bg-green-100 text-green-800" },
  { value: "PARTIAL", label: "Partial", color: "bg-orange-100 text-orange-800" },
  { value: "FAILED", label: "Failed", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// GENERIC / COMMON STATUSES
// ============================================================================

export const ACTIVE_STATUSES: StatusConfig[] = [
  { value: "ACTIVE", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "INACTIVE", label: "Inactive", color: "bg-gray-100 text-gray-800" },
];

export const BOOLEAN_STATUSES: StatusConfig[] = [
  { value: "true", label: "Yes", color: "bg-green-100 text-green-800" },
  { value: "false", label: "No", color: "bg-gray-100 text-gray-800" },
];

// ============================================================================
// PAYMENT MODES
// ============================================================================

export const PAYMENT_MODES: StatusConfig[] = [
  { value: "PREPAID", label: "Prepaid", color: "bg-green-100 text-green-800" },
  { value: "COD", label: "COD", color: "bg-yellow-100 text-yellow-800" },
  { value: "CREDIT", label: "Credit", color: "bg-blue-100 text-blue-800" },
];

// ============================================================================
// PRIORITY LEVELS
// ============================================================================

export const PRIORITY_LEVELS: StatusConfig[] = [
  { value: "LOW", label: "Low", color: "bg-gray-100 text-gray-800" },
  { value: "MEDIUM", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-100 text-red-800" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status configuration by value
 * @param statuses - Array of status configurations
 * @param value - Status value to find
 * @returns Status configuration or default gray badge
 */
export function getStatusConfig(
  statuses: StatusConfig[],
  value: string | null | undefined
): StatusConfig {
  if (!value) {
    return { value: "", label: "-", color: "bg-gray-100 text-gray-800" };
  }

  const found = statuses.find(
    (s) => s.value.toLowerCase() === value.toLowerCase()
  );

  return (
    found || {
      value,
      label: value.replace(/_/g, " "),
      color: "bg-gray-100 text-gray-800",
    }
  );
}

/**
 * Get status badge color by value
 * @param statuses - Array of status configurations
 * @param value - Status value to find
 * @returns CSS class string for badge color
 */
export function getStatusColor(
  statuses: StatusConfig[],
  value: string | null | undefined
): string {
  return getStatusConfig(statuses, value).color;
}

/**
 * Get status label by value
 * @param statuses - Array of status configurations
 * @param value - Status value to find
 * @returns Human-readable label
 */
export function getStatusLabel(
  statuses: StatusConfig[],
  value: string | null | undefined
): string {
  return getStatusConfig(statuses, value).label;
}

/**
 * Filter statuses for select dropdown
 * @param statuses - Array of status configurations
 * @param excludeValues - Array of values to exclude
 * @returns Filtered status array
 */
export function filterStatuses(
  statuses: StatusConfig[],
  excludeValues: string[] = []
): StatusConfig[] {
  return statuses.filter((s) => !excludeValues.includes(s.value));
}
