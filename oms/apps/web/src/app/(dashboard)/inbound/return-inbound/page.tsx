import { redirect } from "next/navigation";

// Return Inbound was a filtered view of Returns.
// Redirect to Returns page which handles all return inbound flows.
export default function ReturnInboundPage() {
  redirect("/returns");
}
