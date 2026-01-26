"use client";

import WavesPageContent from "@/components/waves/WavesPageContent";

export default function WavesPage() {
  return (
    <WavesPageContent
      config={{
        title: "Wave Picking",
        description: "Manage batch picking waves for efficient order fulfillment",
        basePath: "/wms/waves",
      }}
    />
  );
}
