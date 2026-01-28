import { redirect } from "next/navigation";

// Fulfillment picklist redirects to WMS picklist which has the full implementation
// This maintains URL flexibility while avoiding code duplication
export default function FulfillmentPicklistPage() {
  redirect("/wms/picklist");
}
