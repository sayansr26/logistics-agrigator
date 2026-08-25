/**
 * Razorpay Checkout.js loader + thin wrapper.
 *
 * Keeps the third-party script and its `window.Razorpay` surface isolated
 * to one module so callers (checkout button, retry flows) never touch the
 * global directly.
 */

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_LOAD_TIMEOUT_MS = 15000;

/** Single-flight promise so concurrent callers share one script tag / load. */
let loadPromise: Promise<boolean> | null = null;

/**
 * Ensures the Razorpay Checkout.js script is loaded, resolving `true` once
 * `window.Razorpay` is available.
 *
 * - SSR-safe: resolves `false` immediately when there is no `window`.
 * - Idempotent: if `window.Razorpay` already exists (e.g. a previous mount
 *   loaded it), resolves `true` without injecting another script tag.
 * - On error or a 15s timeout, resolves `false` AND resets the in-flight
 *   promise so a later retry can genuinely re-attempt instead of replaying
 *   a stale failure.
 */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`,
    );

    const settle = (ok: boolean) => {
      clearTimeout(timeoutId);
      if (!ok) loadPromise = null;
      resolve(ok);
    };

    const timeoutId = setTimeout(() => settle(false), SCRIPT_LOAD_TIMEOUT_MS);

    if (existing) {
      existing.addEventListener("load", () => settle(true), { once: true });
      existing.addEventListener("error", () => settle(false), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => settle(true);
    script.onerror = () => settle(false);
    document.body.appendChild(script);
  });

  return loadPromise;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    confirm_close?: boolean;
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySuccessPayload) => void;
}

export interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailurePayload {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

/**
 * Opens the Razorpay checkout modal.
 *
 * Callers must ensure `loadRazorpayScript()` has resolved `true` first -
 * this does not load the script itself.
 *
 * `modal.confirm_close` defaults to `true` so a stray Escape/backdrop click
 * cannot silently kill a live OTP flow mid-payment.
 */
export function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
  onFailed: (payload: RazorpayFailurePayload) => void,
): { close: () => void } {
  const rzp = new window.Razorpay({
    ...options,
    modal: { confirm_close: true, ...options.modal },
  });

  rzp.on("payment.failed", onFailed);
  rzp.open();

  return {
    close: () => rzp.close(),
  };
}
