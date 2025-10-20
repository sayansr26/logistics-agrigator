import React from "react";
import type { Metadata } from "next";
import { ReduxProvider } from "@/providers/ReduxProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer } from "@/components/ui/toast";
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
        <ReduxProvider>
          <ErrorBoundary>
            {children}
            <ToastContainer />
          </ErrorBoundary>
        </ReduxProvider>
      </body>
    </html>
  );
}
