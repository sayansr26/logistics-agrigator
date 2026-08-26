import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Colour map mirrors `getStatusColor` in `src/app/wallet/page.jsx:97-118`
 * (bg-100/text-800/border-200 in light mode) so payment-gateway statuses
 * look native next to the rest of the wallet UI, extended with dark-mode
 * variants for the newer surfaces this chip is used on.
 */
const STATUS_STYLES: Record<string, string> = {
  // Amber - awaiting something (payer action, admin review, gateway reconcile).
  PENDING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  PENDING_APPROVAL:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  RECONCILE_PENDING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  // Static-QR collection ledger statuses (qrCollectionApi.ts QrCollectionStatus).
  UNATTRIBUTED:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  CREDIT_PENDING:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  ASSIGN_PENDING:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  ATTRIBUTED:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  IGNORED:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  // Emerald - money has landed / request approved.
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  CREDITED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  APPROVED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  // Blue - captured by the gateway but not yet credited to the wallet.
  CAPTURED:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  // Slate - terminal, uneventful.
  EXPIRED:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  CANCELLED:
    "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  // Red - needs attention.
  FAILED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  REJECTED:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
  // Indigo - a channel/source label rather than a lifecycle state (static UPI
  // QR collection source, as opposed to a Razorpay/CCAvenue payment link).
  UPI_QR:
    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900",
};

const DEFAULT_STYLE =
  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900";

interface PaymentStatusChipProps {
  status: string;
  className?: string;
}

export function PaymentStatusChip({
  status,
  className,
}: PaymentStatusChipProps) {
  const key = status?.toUpperCase?.() ?? "";
  const style = STATUS_STYLES[key] ?? DEFAULT_STYLE;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", style, className)}
    >
      {key === "RECONCILE_PENDING" && <Clock className="h-3 w-3" />}
      {status}
    </Badge>
  );
}
