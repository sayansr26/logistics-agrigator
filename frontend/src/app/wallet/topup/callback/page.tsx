"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Wallet } from "lucide-react";
import { CopyButton } from "@/components/wallet/copy-button";

/**
 * Razorpay payment-link return page (`PAYMENT_CALLBACK_URL`).
 *
 * This page is PUBLIC by necessity: an admin generates a payment link and
 * shares it with a customer, who pays from their own device and may have no
 * account on this panel at all. Bouncing them to a login screen after they
 * have just paid would be the worst possible moment to ask for credentials.
 *
 * It is deliberately a RECEIPT, not a source of truth:
 *   - The query parameters here are attacker-controllable, and the signature
 *     Razorpay appends can only be verified with the key secret, which must
 *     never reach the browser. So nothing on this page is trusted.
 *   - The wallet is credited by the signed `payment_link.paid` webhook hitting
 *     wallet-service, which is the only authority. This page therefore says
 *     the credit is on its way, never that it has happened.
 */
function CallbackContent() {
  const params = useSearchParams();

  const status = (
    params.get("razorpay_payment_link_status") || ""
  ).toLowerCase();
  const paymentId = params.get("razorpay_payment_id") || "";
  const referenceId = params.get("razorpay_payment_link_reference_id") || "";
  const linkId = params.get("razorpay_payment_link_id") || "";

  const paid = status === "paid";
  const failed = status === "failed" || status === "cancelled";

  const Icon = paid ? CheckCircle2 : failed ? XCircle : Clock;
  const tone = paid
    ? "text-emerald-600 dark:text-emerald-400"
    : failed
      ? "text-red-600 dark:text-red-400"
      : "text-amber-600 dark:text-amber-400";

  const heading = paid
    ? "Payment received"
    : failed
      ? "Payment not completed"
      : "Payment status pending";

  const body = paid
    ? "Thank you. Your payment has gone through and the wallet will be credited automatically within a few minutes. You do not need to pay again."
    : failed
      ? "The payment was not completed, so nothing has been charged. You can reopen the payment link to try again."
      : "We have not had a final confirmation from the payment gateway yet. If money has left your account, the wallet will still be credited automatically — please do not pay twice.";

  const reference = referenceId || paymentId || linkId;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Icon className={`h-7 w-7 ${tone}`} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{heading}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>

        {reference && (
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reference
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-xs text-foreground">
                {reference}
              </code>
              <CopyButton value={reference} size="icon" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Quote this reference if you need to contact support about this
              payment.
            </p>
          </div>
        )}

        <Link
          href="/wallet"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
        >
          <Wallet className="h-3.5 w-3.5" /> Go to wallet
        </Link>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Signed out? You can safely close this page — the credit does not
          depend on it.
        </p>
      </div>
    </main>
  );
}

export default function TopupCallbackPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-sm text-muted-foreground">
            Checking your payment…
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
