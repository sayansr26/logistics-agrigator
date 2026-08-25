import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a rupee amount as "en-IN" currency (e.g. "₹1,23,456.00").
 *
 * Note: `src/app/wallet/page.jsx:77-84` has its own module-local
 * `formatCurrency` with the same behaviour - left alone deliberately
 * (that page predates this shared helper and is out of scope here).
 */
export function formatINR(amount?: number | string | null): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (value == null || Number.isNaN(value)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Convert a rupee amount to the integer paise value Razorpay's API expects. */
export function rupeesToPaise(n: number): number {
  return Math.round(n * 100);
}

/** Convert a paise amount (as returned by Razorpay/the payment gateway) back to rupees. */
export function paiseToRupees(n: number): number {
  return n / 100;
}

/**
 * Pull a human-readable message out of an RTK Query error.
 *
 * Backend services wrap failures with `APIResponse.error(message, code, details,
 * statusCode)` (shared/lib/response.js), which serialises as
 * `{ status: "error", error: { code, message, details } }` — so the message is
 * NOT at `data.message`. Some older controllers pass a status code where `code`
 * belongs and shapes vary, so probe both nestings before falling back.
 */
export function extractApiError(err: unknown, fallback: string): string {
  const e = err as
    | {
        data?: { error?: { message?: string }; message?: string };
        error?: string;
      }
    | undefined;
  return e?.data?.error?.message || e?.data?.message || fallback;
}

/** The backend error `code` (e.g. "SELF_APPROVAL_FORBIDDEN"), when present. */
export function extractApiErrorCode(err: unknown): string | null {
  const e = err as
    { data?: { error?: { code?: string | number } } } | undefined;
  const code = e?.data?.error?.code;
  return typeof code === "string" ? code : null;
}
