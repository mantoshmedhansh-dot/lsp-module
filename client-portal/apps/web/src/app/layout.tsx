import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CJDQuick - Client Portal",
  description: "Choose your service: OMS + WMS, B2C Courier, or B2B Logistics",
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
