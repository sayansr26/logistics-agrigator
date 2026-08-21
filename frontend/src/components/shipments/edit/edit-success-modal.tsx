"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

/**
 * Edit-wizard counterpart to BookingSuccessModal — same shape and actions,
 * worded for a save rather than a first booking.
 */
export function EditSuccessModal({
  open,
  shipmentId,
  onLeave,
}: {
  open: boolean;
  shipmentId: string;
  /**
   * Runs just before navigating away. The draft is cleared here rather than
   * on save, because clearing it mid-save would drop the wizard back into its
   * loading state and unmount this modal.
   */
  onLeave?: () => void;
}) {
  const router = useRouter();
  if (!open) return null;

  const leaveTo = (href: string) => () => {
    onLeave?.();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            Shipment Updated Successfully!
          </h3>
          <p className="text-xs text-muted-foreground">
            The shipment now carries your updated details and pricing.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={leaveTo("/shipments")}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground border border-border hover:bg-accent"
          >
            View All Orders
          </button>
          <button
            type="button"
            onClick={leaveTo(`/shipments/${shipmentId}`)}
            className="px-5 py-2 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 shadow-sm"
          >
            View Shipment
          </button>
        </div>
      </div>
    </div>
  );
}
