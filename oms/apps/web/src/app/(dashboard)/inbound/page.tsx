import { redirect } from "next/navigation";

/**
 * Inbound Landing Page
 *
 * Redirects to Goods Receipt as the primary inbound function.
 * GRN is the source of truth for inventory creation.
 */
export default function InboundPage() {
  redirect("/inbound/goods-receipt");
}
