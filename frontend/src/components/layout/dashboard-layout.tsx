"use client";

import React from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <div className={`min-h-screen bg-background p-6 ${className || ""}`}>
      {children}
    </div>
  );
}
