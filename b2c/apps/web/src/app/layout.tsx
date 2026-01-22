import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CJDQuick B2C Courier",
  description: "Direct-to-Consumer Parcel Delivery Services",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
