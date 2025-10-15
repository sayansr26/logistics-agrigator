import React from "react";
import type { Metadata } from "next";
import { ReduxProvider } from "@/providers/ReduxProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logistics Aggregator Portal",
  description:
    "Complete logistics management solution for e-commerce businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
