"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { EditWizardFrame } from "@/components/shipments/edit/edit-wizard-frame";
import { DocketSection } from "@/components/shipments/create/step1/docket-section";
import { OrderSection } from "@/components/shipments/create/step1/order-section";
import { InvoicePaymentSection } from "@/components/shipments/create/step1/invoice-payment-section";
import { AddressSection } from "@/components/shipments/create/step1/address-section";
import { DimensionsSection } from "@/components/shipments/create/step1/dimensions-section";
import { DocumentsSection } from "@/components/shipments/create/step1/documents-section";
import { VasSection } from "@/components/shipments/create/step1/vas-section";
import { AwbSection } from "@/components/shipments/create/step1/awb-section";
// Markup section hidden — keep the import so it can be re-enabled in one step.
// import { MarkupSection } from "@/components/shipments/create/step1/markup-section";
import { useShipmentEditFormStore } from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";

/**
 * Step 1 of the edit wizard — the exact section set the create wizard's step 1
 * renders, driven by the edit form store instead of the create one.
 */
export default function EditShipmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { isSystemAdmin, isRole } = useRole();
  const isOutlet = isRole("outlet");
  const isAdminLike = isSystemAdmin();

  function handleNext() {
    if (!useShipmentEditFormStore.getState().validateStep1()) return;
    router.push(`/shipments/${id}/edit/partners`);
  }

  return (
    <EditWizardFrame
      id={id}
      step={1}
      left={{
        label: "Cancel",
        onClick: () => router.push(`/shipments/${id}`),
      }}
      right={{
        label: "Next",
        onClick: handleNext,
        icon: <ArrowRight className="h-3 w-3" />,
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Docket, Order & Invoice */}
        <div className="lg:col-span-7 space-y-6">
          <DocketSection isAdminLike={isAdminLike} />
          <OrderSection />
          <InvoicePaymentSection />
        </div>

        {/* RIGHT COLUMN: Addresses, Dimensions, Documents, VAS */}
        <div className="lg:col-span-5 space-y-6">
          <AddressSection isOutlet={isOutlet} isAdminLike={isAdminLike} />
          <DimensionsSection />
          <DocumentsSection />
          <VasSection />
          <AwbSection />
          {/* Markup section hidden — uncomment to re-enable. */}
          {/* <MarkupSection isOutlet={isOutlet} isAdminLike={isAdminLike} /> */}
        </div>
      </div>
    </EditWizardFrame>
  );
}
