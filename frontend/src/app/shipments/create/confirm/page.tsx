"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { WizardLayout } from "@/components/shipments/create/wizard-layout";
import {
  ConfirmSummary,
  useConfirmInsufficient,
} from "@/components/shipments/create/step3/confirm-summary";
import { BookingSuccessModal } from "@/components/shipments/create/step3/booking-success-modal";
import { expandBoxes, useShipmentFormStore } from "@/store/shipment-form-store";
import { useRole } from "@/hooks/useRole";
import { useShipmentAddresses } from "@/hooks/useShipmentAddresses";
import { useCreateShipmentMutation } from "@/store/api/endpoints/shipmentApi";
import type { CreateShipmentRequest } from "@/store/api/endpoints/shipmentApi";
import { useGetBookingQuestionsQuery } from "@/store/api/endpoints/chargesApi";
import { buildVasSelections } from "@/lib/utils/vas";
import { toE164Indian } from "@/lib/utils/phone";
import { unitToCmFactor } from "@/components/shipments/create/step1/dimensions-section";

const customBreadcrumbs = [
  { title: "Dashboard", href: "/dashboard" },
  { title: "Shipments", href: "/shipments" },
  { title: "Create Shipment" },
];

interface RtkErrorLike {
  status?: number;
  data?: { error?: { code?: string } };
}

export default function ConfirmBookPage() {
  const router = useRouter();
  const store = useShipmentFormStore();
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
  const [createShipment, { isLoading: creating }] = useCreateShipmentMutation();
  const insufficient = useConfirmInsufficient();

  const [success, setSuccess] = useState<{
    shipmentId?: string;
    awbNumber?: string | null;
  } | null>(null);

  async function handleBook() {
    if (!selectedAddr) {
      router.push("/shipments/create/details");
      return;
    }
    if (!store.rtoSameAsPickup && !selectedRtoAddr) {
      router.push("/shipments/create/details");
      return;
    }
    if (!store.deliveryAddressId) {
      router.push("/shipments/create/details");
      return;
    }
    if (!store.billingSameAsDelivery && !selectedBillingAddr) {
      router.push("/shipments/create/details");
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

    const payload: CreateShipmentRequest = {
      orderId: store.referenceNo,
      shipmentType: store.shipmentType,
      shipmentDirection: store.shipmentDirection,
      outletId: isOutlet ? undefined : store.outletId || undefined,
      outletUserId: isOutlet ? undefined : store.outletUserId || undefined,
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
      poNumber: store.poNumber || undefined,
      poExpiryDate: store.poExpiryDate || undefined,
      packageDetails: {
        weight: parseFloat(store.actualWeight) || 0.5,
        dimensions: dims,
        description: store.productDescription || undefined,
        fragile: store.isFragile,
      },
      numberOfBoxes: store.numberOfBoxes,
      // The form groups boxes by dimensions (one row of 5 = five identical
      // boxes); the API stores one row per physical box, so expand the groups
      // back out here.
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
        store.paymentType === "COD" ? parseFloat(store.codAmount) : undefined,
      // A booked shipment stores one concrete service type - "Select All" is
      // a quoting filter only, so it books as STANDARD.
      serviceType: store.serviceType === "ALL" ? "STANDARD" : store.serviceType,
      selectedPartnerId: quote?.partnerId,
      quoteSnapshot: quote || undefined,
      quoteToken: quote?.quoteToken || undefined,
      vasSelections: vasSelections.length > 0 ? vasSelections : undefined,
      markup:
        quote && store.markupType && parseFloat(store.markupValue) > 0
          ? { type: store.markupType, value: parseFloat(store.markupValue) }
          : null,
    };

    try {
      const result = await createShipment(payload).unwrap();
      const createdShipment = result?.data?.shipment;
      store.resetForm();
      setSuccess({
        shipmentId: createdShipment?.id,
        awbNumber: createdShipment?.awbNumber,
      });
    } catch (err) {
      const rtkErr = err as RtkErrorLike;
      if (
        rtkErr?.status === 409 &&
        rtkErr?.data?.error?.code === "QUOTE_STALE"
      ) {
        store.clearSelectedQuote();
        router.push("/shipments/create/partners");
      }
      // Other errors: RTK error middleware surfaces a toast
    }
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <WizardLayout
        step={3}
        left={{
          label: "Back",
          onClick: () => router.push("/shipments/create/partners"),
        }}
        right={{
          label: creating ? "Booking..." : "Book Shipment",
          onClick: handleBook,
          disabled: creating || insufficient,
          loading: creating,
          icon: <CheckCircle className="h-3 w-3" />,
        }}
      >
        <ConfirmSummary />
        <BookingSuccessModal
          open={success !== null}
          shipmentId={success?.shipmentId}
          awbNumber={success?.awbNumber}
        />
      </WizardLayout>
    </DashboardLayout>
  );
}
