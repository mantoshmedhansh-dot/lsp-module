import { redirect } from "next/navigation";

// Direct Inbound was a filtered view of Receiving.
// Redirect to Goods Receipt which supports all inbound types.
export default function DirectInboundPage() {
  redirect("/inbound/goods-receipt");
}
