"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/wallet/copy-button";
import { usePaymentProvider } from "@/hooks/usePaymentProvider";
import { useWalletTopup, type TopupPhase } from "@/hooks/useWalletTopup";
import { useGetMyWalletInfoQuery } from "@/store/api/endpoints/walletApi";
import type { PaymentProviderName } from "@/store/api/endpoints/paymentApi";
import { readWalletBalance } from "@/hooks/useBookingWallet";
import { formatINR } from "@/lib/utils";

/** Friendly label for the "Taking you to <provider>…" redirect copy. */
const PROVIDER_LABELS: Partial<Record<PaymentProviderName, string>> = {
  razorpay: "Razorpay",
  ccavenue: "CCAvenue",
  ccavenue_upi_qr: "CCAvenue",
  cashfree: "Cashfree",
  payu: "PayU",
  stripe: "Stripe",
};

function formatProviderName(provider: PaymentProviderName | null): string {
  if (!provider) return "the payment gateway";
  return PROVIDER_LABELS[provider] ?? "the payment gateway";
}

/**
 * Self-serve recharge only — it always tops up the SIGNED-IN user's wallet.
 *
 * There is deliberately no `targetUserId`: `POST /topup/self/initiate` derives
 * the wallet identity from the JWT and ignores any client-supplied id, so a
 * "top up someone else" variant of this modal would show one wallet's balance
 * while crediting another. Admins fund another wallet with a Razorpay payment
 * link (Wallet -> Topup -> "Send payment link"), never with this checkout.
 */
export interface RechargeModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. the shortfall from the booking screen. */
  suggestedAmount?: number;
  onSuccess?: (amount: number) => void;
}

/**
 * Phases where a Razorpay checkout / verify call is genuinely in flight.
 * Dismissing the dialog here would strand the user mid-payment with no way
 * back in, so `onOpenChange` is a no-op while the phase is one of these.
 * `polling` is deliberately excluded - the hook's localStorage resume
 * record and the backend webhook both recover it if the user leaves.
 */
const NON_DISMISSABLE_PHASES: TopupPhase[] = [
  "creating",
  "loading-sdk",
  "checkout",
  "redirecting",
  "verifying",
];

export function RechargeModal({
  open,
  onClose,
  suggestedAmount,
  onSuccess,
}: RechargeModalProps) {
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);

  const {
    isTestMode,
    quickAmounts,
    minAmount,
    maxAmount,
    validateAmount,
    provider,
  } = usePaymentProvider();

  const {
    phase,
    errorMessage,
    amountPaid,
    balanceAfter,
    orderId,
    isTest,
    elapsedSeconds,
    start,
    retry,
    reset,
    checkStatusNow,
  } = useWalletTopup({});

  const { data: myWalletInfo } = useGetMyWalletInfoQuery();
  const balance = readWalletBalance(myWalletInfo);

  // Prefill from suggestedAmount whenever the modal opens; clear local
  // (component-owned) state whenever it closes. All payment-flow state
  // lives in useWalletTopup and is left alone here - it manages its own
  // lifecycle (including surviving a close during `polling`).
  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount != null ? String(suggestedAmount) : "");
      setTouched(false);
    } else {
      setAmount("");
      setTouched(false);
    }
  }, [open, suggestedAmount]);

  const numericAmount = Number(amount);
  const validationError = validateAmount(numericAmount);
  const canPay =
    (phase === "idle" || phase === "cancelled") && validationError === null;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (NON_DISMISSABLE_PHASES.includes(phase)) return;
      onClose();
    }
  };

  const handlePay = () => {
    setTouched(true);
    if (!canPay) return;
    void start(numericAmount);
  };

  const handleDone = () => {
    const paid = amountPaid;
    reset();
    if (paid != null) onSuccess?.(paid);
    onClose();
  };

  const title = "Add Money to Wallet";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {renderBody({
          phase,
          balance,
          isTestMode,
          quickAmounts,
          minAmount,
          maxAmount,
          amount,
          setAmount,
          touched,
          setTouched,
          validationError,
          amountPaid,
          balanceAfter,
          isTest,
          orderId,
          elapsedSeconds,
          errorMessage,
          providerLabel: formatProviderName(provider),
        })}

        {renderFooter({
          phase,
          amount: numericAmount,
          canPay,
          onCancel: onClose,
          onPay: handlePay,
          onCheckAgain: checkStatusNow,
          onClose,
          onDone: handleDone,
          onRetry: retry,
        })}
      </DialogContent>
    </Dialog>
  );
}

interface RenderBodyArgs {
  phase: TopupPhase;
  balance: number | null;
  isTestMode: boolean;
  quickAmounts: number[];
  minAmount: number;
  maxAmount: number;
  amount: string;
  setAmount: (v: string) => void;
  touched: boolean;
  setTouched: (v: boolean) => void;
  validationError: string | null;
  amountPaid: number | null;
  balanceAfter: number | null;
  isTest: boolean;
  orderId: string | null;
  elapsedSeconds: number;
  errorMessage: string | null;
  providerLabel: string;
}

function renderBody(args: RenderBodyArgs): ReactNode {
  const {
    phase,
    balance,
    isTestMode,
    quickAmounts,
    minAmount,
    maxAmount,
    amount,
    setAmount,
    touched,
    setTouched,
    validationError,
    amountPaid,
    balanceAfter,
    isTest,
    orderId,
    elapsedSeconds,
    errorMessage,
    providerLabel,
  } = args;

  if (phase === "idle" || phase === "cancelled") {
    return (
      <div className="space-y-4">
        {balance !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current balance</span>
            <span className="font-semibold">{formatINR(balance)}</span>
          </div>
        )}

        {isTestMode && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Test mode — no real money will be charged, and your wallet balance
            will not change.
          </div>
        )}

        {phase === "cancelled" && (
          <p className="text-sm text-muted-foreground">
            Payment cancelled. You have not been charged.
          </p>
        )}

        {quickAmounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((v) => (
              <Button
                key={v}
                type="button"
                variant={amount === String(v) ? "default" : "outline"}
                size="sm"
                onClick={() => setAmount(String(v))}
              >
                {formatINR(v)}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="recharge-amount">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ₹
            </span>
            <Input
              id="recharge-amount"
              type="number"
              inputMode="decimal"
              className="pl-7"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Enter amount"
            />
          </div>
          {touched && validationError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Min {formatINR(minAmount)} · Max {formatINR(maxAmount)}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "creating" || phase === "loading-sdk") {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Setting up your payment…
        </p>
      </div>
    );
  }

  if (phase === "checkout") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm">Complete the payment in the Razorpay window.</p>
        <p className="text-xs text-muted-foreground">
          It&apos;s safe to leave this tab open — closing it will not affect
          your payment.
        </p>
      </div>
    );
  }

  if (phase === "redirecting") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm">
          Taking you to {providerLabel} to complete the payment…
        </p>
        <p className="text-xs text-muted-foreground">
          Do not close this window.
        </p>
      </div>
    );
  }

  if (phase === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm">Confirming your payment…</p>
        <p className="text-xs text-muted-foreground">
          Do not close this window.
        </p>
      </div>
    );
  }

  if (phase === "polling") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm">Payment received. Crediting your wallet…</p>
        {amountPaid != null && (
          <p className="text-lg font-semibold">{formatINR(amountPaid)}</p>
        )}
        {elapsedSeconds > 15 && (
          <p className="text-xs text-muted-foreground">
            This is taking a little longer than usual — your money is safe.
          </p>
        )}
      </div>
    );
  }

  if (phase === "credited") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        {isTest ? (
          <p className="text-sm">
            Test payment successful — no balance was credited.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {amountPaid != null ? formatINR(amountPaid) : ""} added to your
              wallet
            </p>
            {balanceAfter != null && (
              <p className="text-xs text-muted-foreground">
                New balance: {formatINR(balanceAfter)}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  if (phase === "reconciling") {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            We&apos;ve received your payment of{" "}
            {amountPaid != null ? formatINR(amountPaid) : ""}. Your wallet will
            be credited automatically within a few minutes.
          </p>
        </div>
        {orderId && (
          <div className="flex items-center gap-1.5 text-xs">
            <span>Reference: {orderId}</span>
            <CopyButton value={orderId} label="Copy reference" size="sm" />
          </div>
        )}
      </div>
    );
  }

  // phase === "failed"
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
      <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
    </div>
  );
}

interface RenderFooterArgs {
  phase: TopupPhase;
  amount: number;
  canPay: boolean;
  onCancel: () => void;
  onPay: () => void;
  onCheckAgain: () => void;
  onClose: () => void;
  onDone: () => void;
  onRetry: () => void;
}

function renderFooter(args: RenderFooterArgs): ReactNode {
  const {
    phase,
    amount,
    canPay,
    onCancel,
    onPay,
    onCheckAgain,
    onClose,
    onDone,
    onRetry,
  } = args;

  if (phase === "idle" || phase === "cancelled") {
    return (
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onPay} disabled={!canPay}>
          Pay {formatINR(amount)}
        </Button>
      </DialogFooter>
    );
  }

  if (phase === "reconciling") {
    return (
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onCheckAgain}>
          Check again
        </Button>
      </DialogFooter>
    );
  }

  if (phase === "credited") {
    return (
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    );
  }

  if (phase === "failed") {
    return (
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={onRetry}>
          Try again
        </Button>
      </DialogFooter>
    );
  }

  // creating / loading-sdk / checkout / redirecting / verifying / polling -
  // no footer.
  return null;
}
