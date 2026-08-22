"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { EditWizardFrame } from "@/components/shipments/edit/edit-wizard-frame";
import {
  ConfirmSummary,
  useConfirmInsufficient,
} from "@/components/shipments/create/step3/confirm-summary";
import {
  expandBoxes,
  useShipmentEditFormStore,
} from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";
import { useShipmentAddresses } from "@/hooks/useShipmentAddresses";
import { useUpdateShipmentMutation } from "@/store/api/endpoints/shipmentApi";
import { useGetBookingQuestionsQuery } from "@/store/api/endpoints/chargesApi";
import { buildVasSelections } from "@/lib/utils/vas";
import { toE164Indian } from "@/lib/utils/phone";
import { unitToCmFactor } from "@/components/shipments/create/step1/dimensions-section";
import { EditSuccessModal } from "@/components/shipments/edit/edit-success-modal";

interface RtkErrorLike {
  status?: number;
  data?: { error?: { code?: string } };
}

/**
 * Step 3 of the edit wizard — assembles the same payload the create flow
 * builds and PUTs it, replacing the shipment's stored details.
 */
export default function EditConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const store = useShipmentEditFormStore();
  const { isSystemAdmin, isRole } = useRole();
  const isOutlet = isRole("outlet");
  const isAdminLike = isSystemAdmin();

  const { find } = useShipmentAddresses({
    isOutlet,
    isAdminLike,
    outletId: store.outletId,
  });

  const selectedAddr = find(store.pickupAddressId);
  const selectedRtoAddr = find(store.rtoAddressId);
  const selectedBillingAddr = find(store.billingAddressId);

  const { data: bookingQuestionsData } = useGetBookingQuestionsQuery();
  const [updateShipment, { isLoading: saving }] = useUpdateShipmentMutation();
  const insufficient = useConfirmInsufficient();

  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const detailsPath = `/shipments/${id}/edit/details`;
    if (!selectedAddr) {
      router.push(detailsPath);
      return;
    }
    if (!store.rtoSameAsPickup && !selectedRtoAddr) {
      router.push(detailsPath);
      return;
    }
    if (!store.deliveryAddressId) {
      router.push(detailsPath);
      return;
    }
    if (!store.billingSameAsDelivery && !selectedBillingAddr) {
      router.push(detailsPath);
      return;
    }

    const cmFactor = unitToCmFactor(store.dimensionUnit);
    const firstBox = store.boxes[0];
    const dims = {
      length: (parseFloat(firstBox?.length || "10") || 10) * cmFactor,
      width: (parseFloat(firstBox?.width || "10") || 10) * cmFactor,
      height: (parseFloat(firstBox?.height || "10") || 10) * cmFactor,
    };

    const pickupAddress = {
      name: selectedAddr.name,
      phone: toE164Indian(selectedAddr.phone || ""),
      email: selectedAddr.email,
      addressLine1: selectedAddr.addressLine1,
      addressLine2: selectedAddr.addressLine2,
      landmark: selectedAddr.landmark,
      city: selectedAddr.city,
      state: selectedAddr.state,
      pincode: selectedAddr.pincode,
      country: selectedAddr.country || "India",
    };

    const deliveryAddress = {
      name: store.receiverName,
      phone: toE164Indian(store.phoneNumber),
      email: store.email,
      addressLine1: store.address,
      addressLine2: "",
      landmark: store.landmark,
      city: store.city,
      state: store.state,
      pincode: store.pincode,
      country: "India",
    };

    const rtoAddress =
      store.rtoSameAsPickup || !selectedRtoAddr
        ? undefined
        : {
            name: selectedRtoAddr.name,
            phone: toE164Indian(selectedRtoAddr.phone || ""),
            addressLine1: selectedRtoAddr.addressLine1,
            addressLine2: selectedRtoAddr.addressLine2,
            landmark: selectedRtoAddr.landmark,
            city: selectedRtoAddr.city,
            state: selectedRtoAddr.state,
            pincode: selectedRtoAddr.pincode,
            country: selectedRtoAddr.country || "India",
          };

    const billingAddress =
      store.billingSameAsDelivery || !selectedBillingAddr
        ? undefined
        : {
            name: selectedBillingAddr.name,
            phone: toE164Indian(selectedBillingAddr.phone || ""),
            email: selectedBillingAddr.email,
            addressLine1: selectedBillingAddr.addressLine1,
            addressLine2: selectedBillingAddr.addressLine2,
            landmark: selectedBillingAddr.landmark,
            city: selectedBillingAddr.city,
            state: selectedBillingAddr.state,
            pincode: selectedBillingAddr.pincode,
            country: selectedBillingAddr.country || "India",
          };

    const vasSelections = buildVasSelections(
      bookingQuestionsData?.data?.questions || [],
      store.vasAnswers,
    );

    const quote = store.selectedQuote;

    try {
      await updateShipment({
        id,
        data: {
          shipmentType: store.shipmentType,
          shipmentDirection: store.shipmentDirection,
          pickupAddressId: store.pickupAddressId || undefined,
          pickupLocation: selectedAddr.label || selectedAddr.name,
          pickupAddress,
          deliveryAddress,
          deliveryAddressId: store.deliveryAddressId || undefined,
          rtoSameAsPickup: store.rtoSameAsPickup,
          rtoAddress,
          rtoAddressId: store.rtoSameAsPickup
            ? undefined
            : store.rtoAddressId || undefined,
          billingSameAsDelivery: store.billingSameAsDelivery,
          billingAddress,
          billingAddressId: store.billingSameAsDelivery
            ? undefined
            : store.billingAddressId || undefined,
          productDescription: store.productDescription || undefined,
          hsnCode: store.hsnCode || undefined,
          gstPercentage: store.gstPercentage
            ? parseFloat(store.gstPercentage)
            : undefined,
          packageDetails: {
            weight: parseFloat(store.actualWeight) || 0.5,
            dimensions: dims,
            description: store.productDescription || undefined,
            fragile: store.isFragile,
          },
          numberOfBoxes: store.numberOfBoxes,
          // The form groups boxes by dimensions (one row of 5 = five identical
          // boxes); the API stores one row per physical box, so expand the
          // groups back out here.
          boxes:
            store.shipmentType === "B2B"
              ? expandBoxes(store.boxes, store.numberOfBoxes).map((b, i) => ({
                  boxNumber: i + 1,
                  length: (parseFloat(b.length) || 0) * cmFactor,
                  width: (parseFloat(b.width) || 0) * cmFactor,
                  height: (parseFloat(b.height) || 0) * cmFactor,
                }))
              : undefined,
          invoices:
            store.shipmentType === "B2B" && store.invoices.length > 0
              ? store.invoices
                  .filter((inv) => inv.invoiceNo)
                  .map((inv) => ({
                    eWayBillNo: inv.eWayBillNo || undefined,
                    invoiceNo: inv.invoiceNo,
                    invoiceAmt: parseFloat(inv.invoiceAmt) || 0,
                    invoiceDate: inv.invoiceDate,
                  }))
              : undefined,
          paymentType: store.paymentType,
          codAmount:
            store.paymentType === "COD"
              ? parseFloat(store.codAmount)
              : undefined,
          // A saved shipment stores one concrete service type - "Select All"
          // is a quoting filter only, so it saves as STANDARD.
          serviceType:
            store.serviceType === "ALL" ? "STANDARD" : store.serviceType,
          // Explicitly null when no quote is selected, which detaches the
          // shipment's current partner and refunds it.
          selectedPartnerId: quote?.partnerId ?? null,
          quoteSnapshot: quote || undefined,
          quoteToken: quote?.quoteToken || undefined,
          vasSelections: vasSelections.length > 0 ? vasSelections : undefined,
          // Outlet markup is retired — the booking never carries one.
          markup: null,
        },
      }).unwrap();

      setSaved(true);
    } catch (err) {
      const rtkErr = err as RtkErrorLike;
      const code = rtkErr?.data?.error?.code;
      if (
        rtkErr?.status === 409 &&
        (code === "QUOTE_STALE" || code === "QUOTE_REQUIRED")
      ) {
        store.clearSelectedQuote();
        router.push(`/shipments/${id}/edit/partners`);
      }
      // Other errors: RTK error middleware surfaces a toast
    }
  }

  return (
    <EditWizardFrame
      id={id}
      step={3}
      left={{
        label: "Back",
        onClick: () => router.push(`/shipments/${id}/edit/partners`),
      }}
      right={{
        label: saving ? "Saving..." : "Save Changes",
        onClick: handleSave,
        disabled: saving || insufficient,
        loading: saving,
        icon: <CheckCircle className="h-3 w-3" />,
      }}
    >
      <ConfirmSummary mode="edit" />
      <EditSuccessModal
        open={saved}
        shipmentId={id}
        // Clear the draft on the way out so reopening this shipment reloads
        // its freshly saved values instead of resurrecting the edit draft.
        onLeave={() => store.resetForm()}
      />
    </EditWizardFrame>
  );
}
