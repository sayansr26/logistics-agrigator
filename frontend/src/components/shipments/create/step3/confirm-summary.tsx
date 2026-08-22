"use client";

import { FileCheck2, Wallet, Route } from "lucide-react";
import Link from "next/link";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";
import { useBookingWallet } from "@/hooks/useBookingWallet";

function fmt(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * `mode` only swaps the wording — an edit re-saves an existing shipment
 * rather than dispatching a brand-new one, and (for PREPAID) settles the
 * difference against the wallet instead of debiting from scratch.
 */
export function ConfirmSummary({
  mode = "create",
}: {
  mode?: "create" | "edit";
}) {
  const store = useShipmentForm();
  const isEdit = mode === "edit";
  const quote = store.selectedQuote;
  // Same wallet the booking will debit — an admin booking for an outlet spends
  // the outlet's balance, not their own.
  const { balance: walletBalance, isKnown: walletKnown } = useBookingWallet();

  // The charges engine prices markup as a taxable line inside the quoted
  // subtotal, so totalAmount is the whole story: it already carries the
  // markup and the GST on it, and it is what the wallet is debited.
  const systemCharge = quote?.totalAmount ?? 0;
  // Outlet markup is retired — forced to 0 so the "Includes your markup"
  // row never renders. Restore the read from quote?.pricing?.markup to
  // bring it back.
  const markupAmount = 0;
  const finalTotal = systemCharge;
  const breakdown = quote?.chargeBreakdown ?? [];
  const codCollectable = quote?.pricing
    ? quote.pricing.codCollectable
    : store.paymentType === "COD"
      ? parseFloat(store.codAmount) || 0
      : 0;

  const isPrepaid = store.paymentType === "PREPAID";
  const shortBy =
    isPrepaid && quote && walletKnown
      ? Math.max(0, systemCharge - walletBalance)
      : 0;
  // Never call a booking short while the balance is still loading.
  const insufficient = isPrepaid && !!quote && walletKnown && shortBy > 0;

  return (
    <div className="bg-card rounded-2xl p-8 border border-border shadow-sm max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
          <FileCheck2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? "Confirm Changes" : "Final Confirmation"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Review the updated shipment details before saving"
              : "Review your final shipment details before dispatching the order"}
            {quote ? " to your chosen logistics partner." : "."}
          </p>
        </div>
      </div>

      <div className="bg-muted/40 rounded-xl p-4 border border-border text-left text-xs space-y-2">
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">Docket Reference ID:</span>
          <span className="font-mono font-bold text-foreground">
            {store.referenceNo}
          </span>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">
            Selected Logistics Partner:
          </span>
          <span className="font-bold text-blue-600">
            {quote ? quote.partnerName : "Not assigned - will book manually"}
          </span>
        </div>
        <div className="flex justify-between border-b border-border pb-2">
          <span className="text-muted-foreground">
            Total Weight &amp; Boxes:
          </span>
          <span className="font-medium text-foreground">
            {store.actualWeight || 0} Kg ({store.numberOfBoxes} boxes)
          </span>
        </div>

        {quote && (
          <>
            {/* Same charge lines the quote card showed at partner selection —
                confirming should not be the step where the pricing detail
                disappears. */}
            {breakdown.length > 0 && (
              <div className="space-y-1 border-b border-border pb-2 pt-1">
                <span className="text-muted-foreground">Charge breakdown:</span>
                {breakdown.map((cb, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between pl-3"
                  >
                    <span className="text-muted-foreground">{cb.name}</span>
                    <span className="font-medium text-foreground tabular-nums">
                      ₹{fmt(cb.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground tabular-nums">
                ₹{fmt(systemCharge)}
              </span>
            </div>
            {markupAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Includes your markup:
                </span>
                <span className="font-medium text-blue-600">
                  ₹{fmt(markupAmount)}
                </span>
              </div>
            )}
            {store.paymentType === "COD" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">COD Collectable:</span>
                <span className="font-medium text-amber-600">
                  ₹{fmt(codCollectable)}
                </span>
              </div>
            )}
          </>
        )}

        <div className="flex justify-between pt-1">
          <span className="font-bold text-foreground">
            Total Payable Amount:
          </span>
          <span className="font-black text-emerald-600 text-sm">
            ₹{fmt(quote ? finalTotal : 0)}
          </span>
        </div>
      </div>

      {quote && (
        <div
          className={`rounded-xl p-3 text-xs flex items-center justify-between ${
            insufficient
              ? "bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800"
              : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2 text-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span>Wallet: ₹{fmt(walletBalance)}</span>
          </div>
          {isPrepaid ? (
            insufficient ? (
              <span className="text-red-700 dark:text-red-300 font-medium">
                Short by ₹{fmt(shortBy)} ·{" "}
                <Link href="/wallet" className="underline">
                  Top up
                </Link>
              </span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                Sufficient — ₹{fmt(systemCharge)} will be debited
              </span>
            )
          ) : (
            <span className="text-muted-foreground">COD — no wallet debit</span>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <Route className="h-3 w-3" />
        {isEdit ? (
          <>
            Saving replaces this shipment&apos;s stored details
            {quote && isPrepaid
              ? ` and settles the difference against your wallet (new charge ₹${fmt(systemCharge)}).`
              : "."}
          </>
        ) : (
          <>
            By clicking &quot;Book Shipment&quot;, you agree to manifest this
            shipment
            {quote && isPrepaid
              ? ` and deduct ₹${fmt(systemCharge)} from your wallet.`
              : "."}
          </>
        )}
      </p>
    </div>
  );
}

export function useConfirmInsufficient() {
  const store = useShipmentForm();
  const { balance: walletBalance, isKnown: walletKnown } = useBookingWallet();
  const quote = store.selectedQuote;
  const isPrepaid = store.paymentType === "PREPAID";
  if (!quote || !isPrepaid || !walletKnown) return false;
  return walletBalance < quote.totalAmount;
}
