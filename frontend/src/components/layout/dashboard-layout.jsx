"use client";

import React from "react";
import { Header } from "./header.jsx";
import { Sidebar } from "./sidebar.jsx";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { cn } from "@/lib/utils";

export function DashboardLayout({
  children,
  className = "",
  showBreadcrumbs = true,
  customBreadcrumbs = undefined,
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header className="" />

      <div className="flex">
        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:top-14 bg-background border-r z-30 overflow-y-auto">
          <Sidebar className="" />
        </aside>

        {/* Main Content */}
        <main className={cn("flex-1 md:ml-64 relative z-10", className)}>
          {/* Breadcrumbs */}
          {showBreadcrumbs && (
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container py-3">
                <BreadcrumbNav customBreadcrumbs={customBreadcrumbs} />
              </div>
            </div>
          )}

          {/* Page Content */}
          <div className="container py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
