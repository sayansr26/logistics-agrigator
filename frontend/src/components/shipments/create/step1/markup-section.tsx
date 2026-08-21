"use client";

import { useEffect, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";
import {
  useGetMyOutletQuery,
  useGetOutletQuery,
} from "@/store/api/endpoints/outletApi";

/**
 * Outlet markup/commission added on top of the system price at booking.
 * - outlet role: always shown, caps/defaults from the outlet's own record
 * - admin booking on behalf of an outlet: shown once an outlet is selected,
 *   caps/defaults loaded from the SELECTED outlet
 * The actual "Total = system price + markup" preview needs a fetched
 * quote, which doesn't exist until Step 2 - shown here as a rate preview
 * only; the authoritative split appears on the Confirm step.
 */
export function MarkupSection({
  isOutlet,
  isAdminLike = false,
}: {
  isOutlet: boolean;
  isAdminLike?: boolean;
}) {
  const store = useShipmentForm();
  const selectedOutletId = store.outletId;

  const { data: myOutletData } = useGetMyOutletQuery(undefined, {
    skip: !isOutlet,
  });
  const { data: selectedOutletData } = useGetOutletQuery(selectedOutletId, {
    skip: !isAdminLike || !selectedOutletId,
  });

  const outlet = isOutlet
    ? myOutletData?.data?.outlet
    : selectedOutletData?.data?.outlet;

  const maxFlat =
    outlet?.maxMarkupFlat != null ? Number(outlet.maxMarkupFlat) : null;
  const maxPercent =
    outlet?.maxMarkupPercent != null ? Number(outlet.maxMarkupPercent) : null;

  // Prefill from the outlet's stored default the first time it loads.
  useEffect(() => {
    if (!outlet || store.markupType !== null) return;
    if (outlet.defaultMarkupType && outlet.defaultMarkupValue != null) {
      store.setField("markupType", outlet.defaultMarkupType);
      store.setField("markupValue", String(outlet.defaultMarkupValue));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet]);

  // Anyone booking can set markup: outlets for themselves, admins for the
  // outlet they're booking on behalf of (outlet selection is mandatory for
  // admin bookings anyway; caps are re-enforced server-side).
  const visible = isOutlet || isAdminLike;

  const cap = store.markupType === "PERCENTAGE" ? maxPercent : maxFlat;
  const value = parseFloat(store.markupValue) || 0;
  const overCap = cap != null && value > cap;

  const preview = useMemo(() => {
    if (!store.markupType || value <= 0) return null;
    return store.markupType === "PERCENTAGE"
      ? `+${value}% on the system price`
      : `+₹${value.toFixed(2)} flat on the system price`;
  }, [store.markupType, value]);

  if (!visible) return null;

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-bold text-foreground">
          {isOutlet ? "Your Markup" : "Outlet Markup"}
        </h2>
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
          Optional
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {isOutlet
          ? "Add your margin on top of the system freight price. This amount is not debited from your wallet - it's your revenue from the end customer."
          : "Margin added on top of the system freight price. It is not debited from the wallet - it accrues to the outlet's earnings ledger."}
      </p>

      {!isOutlet && !selectedOutletId && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Select an outlet above to load its saved default and markup limits.
        </p>
      )}

      <div className="flex items-center gap-1.5 bg-muted rounded-xl p-1 w-fit">
        {(["FLAT", "PERCENTAGE"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() =>
              store.setField("markupType", store.markupType === t ? null : t)
            }
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              store.markupType === t
                ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "FLAT" ? "Flat ₹" : "Percentage %"}
          </button>
        ))}
      </div>

      {store.markupType && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            {store.markupType === "FLAT"
              ? "Flat markup amount (₹)"
              : "Markup percentage (%)"}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={store.markupValue}
            onChange={(e) => store.setField("markupValue", e.target.value)}
            className={`w-full text-xs px-3 py-2 rounded-xl border bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium text-foreground ${
              overCap ? "border-red-400" : "border-input"
            }`}
          />
          {cap != null && (
            <p
              className={`text-[11px] ${overCap ? "text-red-600" : "text-muted-foreground"}`}
            >
              Max allowed:{" "}
              {store.markupType === "PERCENTAGE" ? `${cap}%` : `₹${cap}`}
            </p>
          )}
          {preview && (
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {preview}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
