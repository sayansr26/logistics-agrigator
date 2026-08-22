"use client";

import { useState, type MouseEvent } from "react";
import { Building, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import type { PartnerQuote } from "@/store/api/endpoints/shipmentApi";
import { useExplainQuoteMutation } from "@/store/api/endpoints/shipmentApi";
import { useShipmentForm } from "@/components/shipments/create/form-store-context";

function fmt(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Delivery estimate line. The carrier's own date (Delhivery TAT and friends)
 * wins when we have it — it accounts for lane cutoffs and holidays; otherwise
 * we show the day count, and only fall back to "TBD" when the partner has
 * neither a live TAT nor configured default delivery days.
 */
function formatDeliveryEstimate(quote: PartnerQuote): string {
  const days = quote.deliveryDays;
  const dayLabel = days ? `${days} day${days !== 1 ? "s" : ""}` : null;

  if (quote.estimatedDeliveryDate) {
    const date = new Date(quote.estimatedDeliveryDate);
    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      return dayLabel
        ? `Est. delivery ${formatted} (${dayLabel})`
        : `Est. delivery ${formatted}`;
    }
  }

  return dayLabel ? `Est. ${dayLabel}` : "Est. delivery TBD";
}

interface QuoteCardProps {
  quote: PartnerQuote;
  isRecommended: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

export function QuoteCard({
  quote,
  isRecommended,
  isSelected,
  onSelect,
}: QuoteCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [explanation, setExplanation] = useState<{
    explanation: string;
    highlights: string[];
  } | null>(null);
  const [explainQuote, { isLoading: explaining }] = useExplainQuoteMutation();
  const store = useShipmentForm();

  // Markup is priced by the charges engine as a taxable line INSIDE the
  // quoted subtotal, so quote.totalAmount already contains it (and the GST on
  // it). Nothing is added on top here — the card just reports what was quoted.
  const markupAmount = quote.pricing?.markup ?? 0;
  const finalTotal = quote.totalAmount;

  async function handleExplain(e: MouseEvent) {
    e.stopPropagation();
    if (explanation) {
      setExplanation(null);
      return;
    }
    try {
      const res = await explainQuote({
        breakdown: quote.chargeBreakdown || [],
        pricing: quote.pricing || { grandTotal: quote.totalAmount },
        context: { partnerName: quote.partnerName },
      }).unwrap();
      setExplanation(res.data);
    } catch {
      // AI unavailable - fail silently, button stays available to retry
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`bg-card rounded-2xl p-5 border-2 shadow-sm cursor-pointer relative transition-all ${
        isSelected
          ? "border-blue-600 shadow-md"
          : "border-border hover:border-primary/40"
      }`}
    >
      {isRecommended && (
        <span className="absolute top-3 right-3 bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
          Best Value
        </span>
      )}

      <div className="flex items-center gap-3 mb-3">
        <input
          type="radio"
          checked={isSelected}
          onChange={onSelect}
          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5 text-muted-foreground" />{" "}
            {quote.partnerName}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDeliveryEstimate(quote)} · Chargeable:{" "}
            {quote.chargeableWeight} kg
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-border space-y-1">
        {/* Badge-tier discount already applied inside the system price */}
        {quote.discount && quote.discount.totalDiscount > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground line-through">
              ₹{fmt(quote.discount.originalTotal)}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {quote.discount.badge} tier · you save ₹
              {fmt(quote.discount.totalDiscount)}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-muted-foreground">Subtotal</span>
          <span className="text-sm font-bold text-foreground">
            ₹{fmt(quote.totalAmount)}
          </span>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[10px] text-muted-foreground font-semibold">
            Total
          </span>
          <span className="text-xl font-black text-foreground">
            ₹{fmt(finalTotal)}
          </span>
        </div>
        {store.paymentType === "COD" && quote.pricing && (
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] text-muted-foreground">
              COD collectable
            </span>
            <span className="text-xs font-semibold text-amber-600">
              ₹{fmt(quote.pricing.codCollectable)}
            </span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {markupAmount > 0
            ? "Includes GST + Freight + Handling + your markup"
            : "Includes GST + Freight + Handling"}
        </p>
      </div>

      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowBreakdown((v) => !v);
          }}
          className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Charge breakdown{" "}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={handleExplain}
          disabled={explaining}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
        >
          {explaining ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Why this price?
        </button>
      </div>

      {showBreakdown &&
        quote.chargeBreakdown &&
        quote.chargeBreakdown.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-2 pt-2 border-t border-dashed border-border space-y-1"
          >
            {quote.chargeBreakdown.map((cb, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground">{cb.name}</span>
                <span className="font-medium text-foreground tabular-nums">
                  ₹{fmt(cb.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

      {explanation && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 pt-2 border-t border-dashed border-blue-200 dark:border-blue-800 text-[11px] text-muted-foreground space-y-1"
        >
          <p>{explanation.explanation}</p>
        </div>
      )}
    </div>
  );
}
