"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ChannelSyncPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/channels/order-sync");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">Redirecting to Order Sync...</p>
    </div>
  );
}
