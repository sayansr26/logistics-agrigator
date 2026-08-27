"use client";

import { useMemo } from "react";
import { useGetActivePaymentProviderQuery } from "@/store/api/endpoints/paymentApi";
import type {
  PaymentMode,
  PaymentProviderName,
} from "@/store/api/endpoints/paymentApi";
import { formatINR } from "@/lib/utils";

/**
 * Conservative fallbacks used only when the server response omits a field
 * (or the query hasn't resolved yet). These must never be used to decide
 * `isAvailable` - that flag is strictly driven by the server response.
 */
const DEFAULT_MIN_AMOUNT = 100;
const DEFAULT_MAX_AMOUNT = 200000;
const DEFAULT_QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export interface ActiveProvider {
  /** enabled && provider !== null && keyId non-empty. The single gate every "Add Money" surface should consult. */
  isAvailable: boolean;
  /**
   * The CCAvenue static UPI QR channel is switched on and fully configured.
   * Independent of `isAvailable` (it is its own provider row), and the single
   * gate every QR surface should consult - the admin QR Collections /
   * Unattributed queues and the outlet's "My QR" page.
   */
  isStaticQrAvailable: boolean;
  isLoading: boolean;
  provider: PaymentProviderName | null;
  keyId: string;
  mode: PaymentMode;
  isTestMode: boolean;
  currency: string;
  minAmount: number;
  maxAmount: number;
  quickAmounts: number[];
  /** Returns a human-readable error, or null when `amount` is a valid rupee amount to charge. */
  validateAmount(amount: number): string | null;
}

/**
 * Wraps `useGetActivePaymentProviderQuery` (GET /payment-providers/active).
 *
 * Server returns `{ enabled: false, provider: null }` (HTTP 200, not an
 * error) when nothing is configured - so `isAvailable` is derived, not just
 * forwarded, and callers should gate all top-up UI on `isAvailable`, not on
 * `!isLoading` alone.
 */
export function usePaymentProvider(): ActiveProvider {
  const { data, isLoading } = useGetActivePaymentProviderQuery();

  return useMemo<ActiveProvider>(() => {
    const provider = data?.provider ?? null;
    const keyId = data?.keyId ?? "";
    const mode: PaymentMode = data?.mode ?? "TEST";
    const currency = data?.currency ?? "INR";
    const minAmount = data?.minAmount ?? DEFAULT_MIN_AMOUNT;
    const maxAmount = data?.maxAmount ?? DEFAULT_MAX_AMOUNT;
    const quickAmounts =
      data?.quickAmounts && data.quickAmounts.length > 0
        ? data.quickAmounts
        : DEFAULT_QUICK_AMOUNTS;

    const isAvailable = Boolean(
      data?.enabled && provider !== null && keyId.length > 0,
    );

    // Server-driven only: an older backend omits `staticQr`, which reads as
    // OFF and hides the QR surfaces rather than showing queues that can never
    // fill.
    const isStaticQrAvailable = Boolean(data?.staticQr?.enabled);

    function validateAmount(amount: number): string | null {
      if (!Number.isFinite(amount)) {
        return "Enter a valid amount";
      }
      if (amount <= 0) {
        return "Enter an amount greater than ₹0";
      }
      // Reject more than 2 decimal places (paise is the smallest unit).
      const decimals = (amount.toString().split(".")[1] ?? "").length;
      if (decimals > 2) {
        return "Amount cannot have more than 2 decimal places";
      }
      if (amount < minAmount) {
        return `Minimum recharge is ${formatINR(minAmount)}`;
      }
      if (amount > maxAmount) {
        return `Maximum recharge is ${formatINR(maxAmount)}`;
      }
      return null;
    }

    return {
      isAvailable,
      isStaticQrAvailable,
      isLoading,
      provider,
      keyId,
      mode,
      isTestMode: mode === "TEST",
      currency,
      minAmount,
      maxAmount,
      quickAmounts,
      validateAmount,
    };
  }, [data, isLoading]);
}
