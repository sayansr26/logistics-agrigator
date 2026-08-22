"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Loader2 } from "lucide-react";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";
import { useHasMounted } from "@/hooks/useHasMounted";

const STEP_LABELS = [
  "Shipment Details",
  "Partner Selection",
  "Confirm & Book",
] as const;

const STEP_SEGMENTS = ["details", "partners", "confirm"] as const;

export interface WizardActionButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

interface WizardLayoutProps {
  step: 1 | 2 | 3;
  children: React.ReactNode;
  left: WizardActionButton;
  right: WizardActionButton;
  /**
   * Route prefix the stepper navigates within — "/shipments/create" for a new
   * shipment, "/shipments/<id>/edit" when editing an existing one. The three
   * step segments are appended to it.
   */
  basePath?: string;
  title?: string;
  subtitle?: string;
  /** Label for the header's discard action. */
  resetLabel?: string;
  /** Confirmation text shown before discarding. */
  resetConfirmMessage?: string;
  /**
   * Discard handler. Defaults to clearing the form; the edit wizard passes one
   * that reloads the shipment's saved values instead.
   */
  onReset?: () => void;
}

export function WizardLayout({
  step,
  children,
  left,
  right,
  basePath = "/shipments/create",
  title = "Create New Shipment",
  subtitle = "Fill in the details below to create a new shipment and optionally assign a partner",
  resetLabel = "Reset",
  resetConfirmMessage = "Are you sure you want to reset the shipment form? All entered data will be lost.",
  onReset,
}: WizardLayoutProps) {
  const router = useRouter();
  const { resetForm, lastSavedAt } = useShipmentForm();
  // The form store is restored from localStorage, which the server cannot
  // see: it renders DEFAULT_STATE while the browser renders the saved draft.
  // Every persisted field mismatches on hydration (referenceNo loudest, since
  // it is generated from the clock and Math.random), and React bails the whole
  // root to client rendering. Holding the draft-dependent parts back until
  // after mount keeps the server and first client render identical.
  const hasMounted = useHasMounted();

  const steps = STEP_LABELS.map((label, idx) => ({
    key: (idx + 1) as 1 | 2 | 3,
    label,
    path: `${basePath}/${STEP_SEGMENTS[idx]}`,
  }));

  function handleReset() {
    if (typeof window !== "undefined") {
      const ok = window.confirm(resetConfirmMessage);
      if (!ok) return;
    }
    if (onReset) {
      onReset();
      return;
    }
    resetForm();
    router.push(`${basePath}/details`);
  }

  return (
    <div className="flex flex-col pb-24">
      {/* TOP HEADER */}
      <header className="bg-card border border-border rounded-xl">
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {title}
                </h1>
                {hasMounted && lastSavedAt !== null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Draft saved
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RotateCw className="h-3 w-3" /> {resetLabel}
            </button>
          </div>

          {/* Progress Stepper */}
          <div className="pt-2">
            <div className="flex items-center justify-between w-full">
              {steps.map((s, idx) => (
                <React.Fragment key={s.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (s.key < step) router.push(s.path);
                    }}
                    disabled={s.key > step}
                    className={[
                      "flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                      s.key === step
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : s.key < step
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-muted text-muted-foreground cursor-not-allowed",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold",
                        s.key === step
                          ? "bg-white/20"
                          : s.key < step
                            ? "bg-emerald-600 text-white"
                            : "bg-accent text-muted-foreground",
                      ].join(" ")}
                    >
                      {s.key}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div
                      className={[
                        "flex-1 mx-3 h-0.5",
                        s.key < step ? "bg-emerald-400" : "bg-border",
                      ].join(" ")}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-6 flex-1 w-full">
        {hasMounted ? children : <div className="min-h-[50vh]" />}
      </main>

      {/* STICKY BOTTOM ACTION FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 md:left-64 bg-background/95 backdrop-blur border-t border-border py-3.5 z-20 shadow-lg">
        <div className="container flex items-center justify-between">
          <button
            type="button"
            onClick={left.onClick}
            disabled={left.disabled}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {left.label}
          </button>
          <button
            type="button"
            onClick={right.onClick}
            disabled={right.disabled || right.loading}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <span>{right.label}</span>
            {right.loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              right.icon
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
