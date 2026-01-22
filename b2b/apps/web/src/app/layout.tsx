import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CJDQuick B2B Logistics",
  description: "B2B Freight Transport Services - FTL/PTL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
