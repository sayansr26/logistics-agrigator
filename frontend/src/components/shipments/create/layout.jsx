"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";

const STEPS = [
  {
    key: "docket",
    label: "Shipment Details",
    path: "/shipments/create/docket",
  },
  { key: "review", label: "Select Partner", path: "/shipments/create/review" },
];

export function CreateShipmentLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resetForm } = useShipmentFormStore();

  const currentIdx = STEPS.findIndex((s) => pathname.startsWith(s.path));

  const handleReset = () => {
    resetForm();
    router.push("/shipments/create/docket");
  };

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: "Create Shipment" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Create New Shipment
            </h1>
            <p className="text-muted-foreground mt-1">
              Fill in the details below to create a new shipment
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center w-full">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            return (
              <React.Fragment key={step.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (idx <= currentIdx) router.push(step.path);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : isDone
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      idx < currentIdx ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
          {/* Step 3 label (confirm is inside review page) */}
          <div className="flex-1 h-0.5 mx-2 bg-border" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground">
            <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-muted-foreground/30 text-muted-foreground">
              3
            </span>
            <span className="hidden sm:inline">Confirm &amp; Book</span>
          </div>
        </div>

        <div>{children}</div>
      </div>
    </DashboardLayout>
  );
}
