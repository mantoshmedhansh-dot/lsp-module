"use client";

import { redirect } from "next/navigation";

export default function ClientInboundPage() {
  redirect("/client/inbound/purchase-orders");
}
