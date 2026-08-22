"use client";

/**
 * Public tracking entry point.
 *
 * The per-shipment page needs a number in the URL, which is fine for a link we
 * send to a customer but useless for someone arriving from the site nav. This
 * is the front door: type the number, land on /track/<awb>.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/landing/chrome/logo";

export default function TrackLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const awb = value.trim();
    if (!awb) {
      setError("Enter the tracking number from your shipping label.");
      return;
    }
    setError(null);
    router.push(`/track/${encodeURIComponent(awb)}`);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <header className="space-y-4 text-center">
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
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-foreground">
              Track your shipment
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the tracking number printed on your shipping label.
            </p>
          </div>
        </header>

        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="awb" className="sr-only">
            Tracking number
          </label>
          <input
            id="awb"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 40299710288466"
            autoComplete="off"
            autoFocus
            className="h-11 w-full rounded-xl border border-border bg-card px-4 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Search className="h-4 w-4" />
            Track shipment
          </button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground">
          Shipped with{" "}
          <Link href="/" className="font-medium hover:underline">
            SUB Solution
          </Link>
        </p>
      </div>
    </main>
  );
}
