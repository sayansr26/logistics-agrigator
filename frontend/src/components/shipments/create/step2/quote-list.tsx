"use client";

import { AlertCircle } from "lucide-react";
import type { PartnerQuote } from "@/store/api/endpoints/shipmentApi";
import { QuoteCard } from "./quote-card";

interface QuoteListProps {
  quotes: PartnerQuote[];
  recommended: PartnerQuote | null;
  selectedPartnerId: string;
  onSelect: (quote: PartnerQuote) => void;
}

export function QuoteList({
  quotes,
  recommended,
  selectedPartnerId,
  onSelect,
}: QuoteListProps) {
  if (quotes.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-8 border border-border shadow-sm text-center space-y-2">
        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No partner quotes available for this route.
        </p>
        <p className="text-xs text-muted-foreground">
          You can still create the shipment without a partner and assign one
          later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          Available Logistics Partners ({quotes.length})
        </h3>
        <span className="text-xs text-muted-foreground">
          Sorted by lowest cost
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quotes.map((q) => (
          <QuoteCard
            key={q.partnerId}
            quote={q}
            isRecommended={recommended?.partnerId === q.partnerId}
            isSelected={selectedPartnerId === q.partnerId}
            onSelect={() => onSelect(q)}
          />
        ))}
      </div>
    </div>
  );
}
