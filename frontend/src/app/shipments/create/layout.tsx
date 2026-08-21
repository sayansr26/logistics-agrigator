"use client";

import React from "react";
import { ShipmentFormStoreProvider } from "@/components/shipments/create/form-store-context";
import { useShipmentFormStore } from "@/store/shipment-form-store";

/**
 * Points the create wizard at the create form store — the mirror of the edit
 * wizard's layout, so both flows resolve their store the same way rather than
 * one of them relying on the context default.
 */
export default function CreateShipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShipmentFormStoreProvider store={useShipmentFormStore}>
      {children}
    </ShipmentFormStoreProvider>
  );
}
