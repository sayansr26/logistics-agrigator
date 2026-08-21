"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Lock, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WizardLayout } from "@/components/shipments/create/wizard-layout";
import type { WizardActionButton } from "@/components/shipments/create/wizard-layout";
import { LimitedEditForm } from "@/components/shipments/edit/limited-edit-form";
import { useEditShipment } from "@/components/shipments/edit/use-edit-shipment";

interface EditWizardFrameProps {
  id: string;
  step: 1 | 2 | 3;
  left: WizardActionButton;
  right: WizardActionButton;
  children: React.ReactNode;
}

function breadcrumbsFor(id: string, label: string) {
  return [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Shipments", href: "/shipments" },
    { title: `#${label}`, href: `/shipments/${id}` },
    { title: "Edit" },
  ];
}

/**
 * Chrome shared by all three edit-wizard steps.
 *
 * Renders the same `WizardLayout` the create flow uses — stepper header,
 * sticky action footer — pointed at the shipment's own edit routes, and only
 * hands over to the step's content once the form store holds the saved values.
 *
 * A shipment that is already booked cannot be restructured (the courier holds
 * its own copy of the details), so it falls back to the status / instructions
 * form inside the same chrome rather than offering fields the server would
 * reject.
 */
export function EditWizardFrame({
  id,
  step,
  left,
  right,
  children,
}: EditWizardFrameProps) {
  const router = useRouter();
  const { shipment, isLoading, error, refetch, isEditable, revert } =
    useEditShipment(id);

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={breadcrumbsFor(id, "…")}>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="h-96 lg:col-span-7 rounded-2xl" />
            <Skeleton className="h-96 lg:col-span-5 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !shipment) {
    return (
      <DashboardLayout customBreadcrumbs={breadcrumbsFor(id, "…")}>
        <div className="bg-card rounded-2xl p-12 border border-border shadow-sm text-center max-w-lg mx-auto">
          <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            {error ? "Failed to load shipment" : "Shipment Not Found"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error
              ? "Check your connection and try again."
              : "The shipment doesn't exist."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
            {error && (
              <Button onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const label = shipment.awbNumber || shipment.orderId;
  const subtitle = `AWB: ${shipment.awbNumber || "Pending"} · Order: ${shipment.orderId}`;

  if (!isEditable) {
    return (
      <DashboardLayout customBreadcrumbs={breadcrumbsFor(id, label)}>
        <div className="space-y-6">
          <header className="bg-card border border-border rounded-xl px-4 sm:px-6 py-4">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Edit Shipment
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </header>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 max-w-2xl mx-auto">
            <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">
                This shipment can no longer be restructured
              </p>
              <p>
                {shipment.awbNumber
                  ? "It is already booked with the courier, who holds its own copy of the weight, dimensions and addresses. Use re-rate to correct weight or dimensions."
                  : `A shipment in ${shipment.status.replace(/_/g, " ").toLowerCase()} status is past the point where its details can be changed.`}
              </p>
              <p>
                You can still update its status and handling instructions below.
              </p>
            </div>
          </div>

          <LimitedEditForm shipment={shipment} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={breadcrumbsFor(id, label)}>
      <WizardLayout
        step={step}
        basePath={`/shipments/${id}/edit`}
        title="Edit Shipment"
        subtitle={subtitle}
        resetLabel="Revert"
        resetConfirmMessage="Discard your changes and reload this shipment's saved details?"
        onReset={revert}
        left={left}
        right={right}
      >
        {children}
      </WizardLayout>
    </DashboardLayout>
  );
}
