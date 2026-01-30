import { redirect } from "next/navigation";

/**
 * Redirect to Procurement Purchase Orders
 *
 * Purchase Orders are now centralized in the Procurement section.
 * This redirect ensures users land in the right place for PO management.
 *
 * For receiving goods against POs, use:
 * - /inbound/goods-receipt (create GRN from PO)
 * - /inbound/receiving (receive items)
 */
export default function InboundPurchaseOrdersPage() {
  redirect("/procurement/purchase-orders");
}
