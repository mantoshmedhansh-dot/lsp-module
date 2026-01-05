"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Home } from "lucide-react";

export default function ControlTowerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar with Home Button */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Home className="h-4 w-4" />
              <span className="font-medium">Home</span>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Control Tower</h1>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Admin Panel
          </Link>
        </div>
      </div>
      <div className="max-w-[1800px] mx-auto p-6">{children}</div>
    </div>
  );
}
