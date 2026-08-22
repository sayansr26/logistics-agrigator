"use client";

/**
 * Public parcel tracking — no login, no dashboard chrome.
 *
 * This is the link we give customers instead of sending them to the courier's
 * own site: it stays on our domain and shows the fixed six-stage ladder from
 * the public API, which deliberately excludes courier scans and every internal
 * operational or financial detail.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, AlertTriangle, Truck } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/landing/chrome/logo";

interface Milestone {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
  reachedAt: string | null;
}

interface PublicTracking {
  awbNumber: string | null;
  status: string | null;
  milestones: Milestone[];
  currentIndex: number;
  terminal: string | null;
  estimatedDelivery: string | null;
  actualDelivery: string | null;
  destination: { city: string | null; state: string | null } | null;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublicTrackPage({
  params,
}: {
  params: { awb: string };
}) {
  const { awb } = params;
  const [data, setData] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/shipments/track/${encodeURIComponent(awb)}`,
          { headers: { accept: "application/json" } },
        );
        const body = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(
            res.status === 404
              ? "We couldn't find a shipment with that tracking number. Check the number and try again."
              : "Tracking is temporarily unavailable. Please try again shortly.",
          );
        } else {
          setData(body.data);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Tracking is temporarily unavailable. Please try again shortly.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [awb]);

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label="SUB Solution home"
          >
            <LogoMark size={30} />
            <Wordmark
              className="text-[19px]"
              secondaryClassName="text-foreground"
            />
          </Link>
          <h1 className="text-lg font-bold text-foreground">
            Track your shipment
          </h1>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Tracking number
          </p>
          <p className="font-mono text-xl font-bold text-foreground">{awb}</p>

          {data?.destination?.city && (
            <p className="mt-1 text-xs text-muted-foreground">
              Delivering to {data.destination.city}
              {data.destination.state ? `, ${data.destination.state}` : ""}
            </p>
          )}

          {data?.actualDelivery ? (
            <p className="mt-3 text-xs font-medium text-emerald-600">
              Delivered on {formatWhen(data.actualDelivery)}
            </p>
          ) : data?.estimatedDelivery ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Expected by {formatWhen(data.estimatedDelivery)}
            </p>
          ) : null}
        </section>

        {loading && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading tracking details…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {data && !loading && !error && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-foreground">Progress</h2>
            </div>

            {data.terminal && (
              <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {data.terminal}
              </p>
            )}

            <ol className="space-y-0">
              {data.milestones.map((m, i) => {
                const isLast = i === data.milestones.length - 1;
                const done = m.state === "done";
                const current = m.state === "current";
                return (
                  <li key={m.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {done || current ? (
                        <CheckCircle2
                          className={`h-5 w-5 ${
                            current ? "text-blue-600" : "text-emerald-600"
                          }`}
                        />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                      {!isLast && (
                        <span
                          className={`w-px flex-1 ${
                            done ? "bg-emerald-600" : "bg-border"
                          }`}
                          style={{ minHeight: "1.75rem" }}
                        />
                      )}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-6"}>
                      <p
                        className={`text-sm ${
                          done || current
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {m.label}
                        {current && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Current
                          </span>
                        )}
                      </p>
                      {m.reachedAt && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatWhen(m.reachedAt)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <footer className="pt-2 text-center text-[11px] text-muted-foreground">
          Shipped with{" "}
          <Link href="/" className="font-medium hover:underline">
            SUB Solution
          </Link>
        </footer>
      </div>
    </main>
  );
}
