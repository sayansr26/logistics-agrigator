"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Loader2 } from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";

const STEPS = [
  { key: 1, label: "Shipment Details", path: "/shipments/create/details" },
  { key: 2, label: "Partner Selection", path: "/shipments/create/partners" },
  { key: 3, label: "Confirm & Book", path: "/shipments/create/confirm" },
] as const;

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
}

export function WizardLayout({
  step,
  children,
  left,
  right,
}: WizardLayoutProps) {
  const router = useRouter();
  const { resetForm, lastSavedAt } = useShipmentFormStore();

  function handleReset() {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Are you sure you want to reset the shipment form? All entered data will be lost.",
      );
      if (!ok) return;
    }
    resetForm();
    router.push("/shipments/create/details");
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
                  Create New Shipment
                </h1>
                {lastSavedAt != null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Draft saved
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fill in the details below to create a new shipment and
                optionally assign a partner
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RotateCw className="h-3 w-3" /> Reset
            </button>
          </div>

          {/* Progress Stepper */}
          <div className="pt-2">
            <div className="flex items-center justify-between w-full">
              {STEPS.map((s, idx) => (
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
                  {idx < STEPS.length - 1 && (
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

      <main className="pt-6 flex-1 w-full">{children}</main>

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
