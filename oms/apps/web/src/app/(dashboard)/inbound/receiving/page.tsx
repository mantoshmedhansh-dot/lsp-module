import { redirect } from "next/navigation";

// Inbound Receiving deprecated — GRN is the single inbound system that creates inventory.
// Redirect to Goods Receipt page.
export default function InboundReceivingPage() {
  redirect("/inbound/goods-receipt");
}
