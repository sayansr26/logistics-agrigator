"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Truck, ArrowRight, Search } from "lucide-react";
import { EditWizardFrame } from "@/components/shipments/edit/edit-wizard-frame";
import { WalletCard } from "@/components/shipments/create/step2/wallet-card";
import { ShipmentSummaryCard } from "@/components/shipments/create/step2/shipment-summary-card";
import { QuoteSkeleton } from "@/components/shipments/create/step2/quote-skeleton";
import { QuoteList } from "@/components/shipments/create/step2/quote-list";
import { useShipmentEditFormStore } from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";
import { useShipmentAddresses } from "@/hooks/useShipmentAddresses";
import { useGetShipmentQuotesMutation } from "@/store/api/endpoints/shipmentApi";
import type { PartnerQuote } from "@/store/api/endpoints/shipmentApi";
import { useGetBookingQuestionsQuery } from "@/store/api/endpoints/chargesApi";
import { buildVasSelections } from "@/lib/utils/vas";
import { unitToCmFactor } from "@/components/shipments/create/step1/dimensions-section";

/**
 * Step 2 of the edit wizard.
 *
 * Editing anything that moves the price invalidates the shipment's stored
 * quote, so this step always re-quotes rather than pre-selecting the partner
 * the shipment already carries — the server likewise refuses a priced change
 * that arrives without a fresh signed token.
 */
export default function EditPartnerSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const store = useShipmentEditFormStore();
  const { isSystemAdmin, isRole } = useRole();
  const isOutlet = isRole("outlet");
  const isAdminLike = isSystemAdmin();

  const [quotesLoaded, setQuotesLoaded] = useState(false);

  const { find } = useShipmentAddresses({
    isOutlet,
    isAdminLike,
    outletId: store.outletId,
  });

  const pickupAddr = find(store.pickupAddressId);
  const rtoAddr = find(store.rtoAddressId);

  const { data: bookingQuestionsData } = useGetBookingQuestionsQuery();

  const [
    getQuotes,
    { data: quotesData, isLoading: quotesLoading, error: quotesError },
  ] = useGetShipmentQuotesMutation();
  const quotes = quotesData?.data?.quotes || [];
  const recommended = quotesData?.data?.recommended || null;

  async function handleFetchQuotes() {
    if (!pickupAddr) return;
    // Must match the cm conversion applied when saving, so the quoted price
    // reflects the same physical dimensions being persisted.
    const cmFactor = unitToCmFactor(store.dimensionUnit);
    const firstBox = store.boxes[0];
    const dims = {
      length: (parseFloat(firstBox?.length || "10") || 10) * cmFactor,
      width: (parseFloat(firstBox?.width || "10") || 10) * cmFactor,
      height: (parseFloat(firstBox?.height || "10") || 10) * cmFactor,
    };
    const totalDeclaredValue = store.invoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.invoiceAmt) || 0),
      0,
    );
    const vasSelections = buildVasSelections(
      bookingQuestionsData?.data?.questions || [],
      store.vasAnswers,
    );

    try {
      await getQuotes({
        fromPincode: pickupAddr.pincode,
        toPincode: store.pincode,
        weight: parseFloat(store.actualWeight) || 0.5,
        numberOfBoxes: store.numberOfBoxes,
        dimensions: dims,
        // "Select All" means quote every service type, so send no filter.
        serviceType:
          store.serviceType === "ALL" ? undefined : store.serviceType,
        paymentType: store.paymentType,
        codAmount:
          store.paymentType === "COD" ? parseFloat(store.codAmount) : undefined,
        shipmentType: store.shipmentType,
        declaredValue: totalDeclaredValue > 0 ? totalDeclaredValue : undefined,
        isFragile: store.isFragile || undefined,
        outletId: store.outletId || undefined,
        vasSelections: vasSelections.length > 0 ? vasSelections : undefined,
        // Outlet markup is retired — the form no longer collects one.
        // NOTE: omitting it is not enough on its own. resolveEffectiveMarkup
        // falls back REQUEST -> OUTLET_DEFAULT -> PLATFORM_DEFAULT, so the
        // platform env default must stay unset for quotes to carry no markup.
        markup: undefined,
      }).unwrap();
      setQuotesLoaded(true);
    } catch {
      // RTK error middleware surfaces a toast
    }
  }

  function handleSelect(quote: PartnerQuote) {
    store.selectQuote(quote);
  }

  function handleSkipPartner() {
    store.clearSelectedQuote();
    router.push(`/shipments/${id}/edit/confirm`);
  }

  const rightAction = !quotesLoaded
    ? {
        label: "Get Partner Quotes",
        onClick: handleFetchQuotes,
        loading: quotesLoading,
        disabled: !pickupAddr,
        icon: <Search className="h-3 w-3" />,
      }
    : {
        label: "Proceed to Confirm",
        onClick: () => router.push(`/shipments/${id}/edit/confirm`),
        disabled: !store.selectedPartnerId,
        icon: <ArrowRight className="h-3 w-3" />,
      };

  return (
    <EditWizardFrame
      id={id}
      step={2}
      left={{
        label: "Back",
        onClick: () => router.push(`/shipments/${id}/edit/details`),
      }}
      right={rightAction}
    >
      <div className="space-y-6">
        <WalletCard requiredAmount={store.selectedQuote?.totalAmount} />
        <ShipmentSummaryCard pickupAddr={pickupAddr} rtoAddr={rtoAddr} />

        {!quotesLoaded && !quotesLoading && (
          <div className="bg-card rounded-2xl p-8 border border-border shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto text-xl">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Re-quote This Shipment
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Your changes may have moved the price, so a fresh quote is
              required before saving. Click{" "}
              <span className="font-bold text-blue-600">
                &quot;Get Partner Quotes&quot;
              </span>{" "}
              below to re-price this shipment across logistics partners.
            </p>
            {quotesError && (
              <p className="text-xs text-red-600">
                Failed to fetch quotes. Please check your inputs and try again.
              </p>
            )}
            <button
              type="button"
              onClick={handleSkipPartner}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground underline"
            >
              Skip partner selection - save without a partner
            </button>
          </div>
        )}

        {quotesLoading && <QuoteSkeleton />}

        {quotesLoaded && !quotesLoading && (
          <>
            <QuoteList
              quotes={quotes}
              recommended={recommended}
              selectedPartnerId={store.selectedPartnerId}
              onSelect={handleSelect}
            />
            <div className="text-center">
              <button
                type="button"
                onClick={handleSkipPartner}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground underline"
              >
                Skip partner selection - save without a partner
              </button>
            </div>
          </>
        )}
      </div>
    </EditWizardFrame>
  );
}
