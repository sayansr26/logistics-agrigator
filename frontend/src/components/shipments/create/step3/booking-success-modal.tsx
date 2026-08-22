"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface BookingSuccessModalProps {
  open: boolean;
  shipmentId?: string;
  awbNumber?: string | null;
  /**
   * Courier rejection returned by the create call. Booking with the courier is
   * non-blocking server-side: the shipment is saved either way, so without this
   * a rejected booking still reported an unqualified success.
   */
  bookingError?: string | null;
}

export function BookingSuccessModal({
  open,
  shipmentId,
  awbNumber,
  bookingError,
}: BookingSuccessModalProps) {
  const router = useRouter();
  if (!open) return null;

  const bookingFailed = !awbNumber && !!bookingError;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 text-center space-y-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl ${
            bookingFailed
              ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600"
              : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600"
          }`}
        >
          {bookingFailed ? (
            <AlertTriangle className="h-7 w-7" />
          ) : (
            <CheckCircle2 className="h-7 w-7" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {bookingFailed
              ? "Shipment created — courier booking failed"
              : "Shipment Booked Successfully!"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {bookingFailed
              ? "The shipment is saved and the wallet is debited, but the courier did not accept it. Retry the booking from the shipment page."
              : awbNumber
                ? "Your shipping label and manifest have been generated."
                : "Your shipment has been created and is ready for partner assignment."}
          </p>
        </div>
        {bookingFailed && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="block text-[10px] font-semibold uppercase tracking-wide">
              Courier response
            </span>
            <span className="mt-0.5 block">{bookingError}</span>
          </div>
        )}
        {awbNumber && (
          <div className="bg-muted/40 rounded-xl p-3 text-xs border border-border">
            <span className="text-muted-foreground block text-[10px]">
              WAYBILL / DOCKET NUMBER
            </span>
            <span className="font-mono font-bold text-blue-600 text-sm">
              {awbNumber}
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/shipments")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground border border-border hover:bg-accent"
          >
            View All Orders
          </button>
          {shipmentId && (
            <button
              type="button"
              onClick={() => router.push(`/shipments/${shipmentId}`)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm"
            >
              View Shipment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
