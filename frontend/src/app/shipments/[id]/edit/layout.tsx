"use client";

import React from "react";
import { ShipmentFormStoreProvider } from "@/components/shipments/create/form-store-context";
import { useShipmentEditFormStore } from "@/store/shipment-form-store";

/**
 * Points the whole edit wizard at the edit form store.
 *
 * This has to sit in a layout rather than inside the wizard frame: the step
 * pages call context-backed hooks (`useBookingWallet`,
 * `useConfirmInsufficient`) in their own bodies, which render above anything
 * the frame provides. Without the provider here those hooks would silently
 * read the create wizard's draft instead.
 */
export default function EditShipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShipmentFormStoreProvider store={useShipmentEditFormStore}>
      {children}
    </ShipmentFormStoreProvider>
  );
}
