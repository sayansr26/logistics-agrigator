"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

interface BookingSuccessModalProps {
  open: boolean;
  shipmentId?: string;
  awbNumber?: string | null;
}

export function BookingSuccessModal({
  open,
  shipmentId,
  awbNumber,
}: BookingSuccessModalProps) {
  const router = useRouter();
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            Shipment Booked Successfully!
          </h3>
          <p className="text-xs text-muted-foreground">
            {awbNumber
              ? "Your shipping label and manifest have been generated."
              : "Your shipment has been created and is ready for partner assignment."}
          </p>
        </div>
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
