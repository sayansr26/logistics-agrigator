"use client";

import { useEffect } from "react";
import { useGetShipmentByIdQuery } from "@/store/api/endpoints/shipmentApi";
import { useShipmentEditFormStore } from "@/store/shipment-form-store";

/**
 * Loads a shipment and pours it into the edit wizard's form store.
 *
 * Hydration is keyed on `editingShipmentId`: it runs once when a different
 * shipment is opened and then stays out of the way, so moving between the
 * three wizard steps keeps whatever the user has typed rather than snapping
 * the fields back to the saved values on every navigation.
 */
export function useEditShipment(id: string) {
  const { data, isLoading, error, refetch } = useGetShipmentByIdQuery(id, {
    skip: !id,
  });

  const shipment = data?.data?.shipment;
  const editingShipmentId = useShipmentEditFormStore(
    (s) => s.editingShipmentId,
  );
  const hydrateFromShipment = useShipmentEditFormStore(
    (s) => s.hydrateFromShipment,
  );

  const needsHydration = Boolean(shipment) && editingShipmentId !== id;

  useEffect(() => {
    if (shipment && editingShipmentId !== id) {
      hydrateFromShipment(shipment);
    }
  }, [shipment, editingShipmentId, id, hydrateFromShipment]);

  /**
   * Structural edits are only safe before the shipment becomes a real parcel:
   * once an AWB exists the courier holds its own copy of these details. The
   * server enforces the same rule (SHIPMENT_NOT_EDITABLE); this just keeps the
   * UI from offering fields that would be rejected.
   */
  const isEditable = Boolean(
    shipment && shipment.status === "CREATED" && !shipment.awbNumber,
  );

  return {
    shipment,
    isLoading: isLoading || needsHydration,
    error,
    refetch,
    isEditable,
    /** Re-pour the saved values over the current draft, discarding edits. */
    revert: () => shipment && hydrateFromShipment(shipment),
  };
}
