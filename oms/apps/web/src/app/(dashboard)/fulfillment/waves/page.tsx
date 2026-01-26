"use client";

import WavesPageContent from "@/components/waves/WavesPageContent";

export default function WavePlanningPage() {
  return (
    <WavesPageContent
      config={{
        title: "Wave Planning",
        description: "Manage batch picking waves for efficient order fulfillment",
        basePath: "/fulfillment/waves",
      }}
    />
  );
}
