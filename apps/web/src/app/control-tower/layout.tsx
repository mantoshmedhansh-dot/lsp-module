"use client";

import { ReactNode } from "react";

export default function ControlTowerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto p-6">{children}</div>
    </div>
  );
}
