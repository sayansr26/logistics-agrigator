"use client";

import React, { createContext, useContext } from "react";
import {
  useShipmentFormStore,
  type ShipmentFormState,
  type ShipmentFormStoreApi,
} from "@/store/shipment-form-store";

/**
 * Which form store the surrounding wizard is driving.
 *
 * The create wizard and the edit wizard render the same section components
 * against two independent stores. Rather than threading a store prop through
 * every section, the route provides its instance here and the sections read it
 * with `useShipmentForm()`.
 *
 * Defaults to the create store so any component rendered outside a provider
 * keeps its previous behaviour.
 */
const ShipmentFormStoreContext =
  createContext<ShipmentFormStoreApi>(useShipmentFormStore);

export function ShipmentFormStoreProvider({
  store,
  children,
}: {
  store: ShipmentFormStoreApi;
  children: React.ReactNode;
}) {
  return (
    <ShipmentFormStoreContext.Provider value={store}>
      {children}
    </ShipmentFormStoreContext.Provider>
  );
}

/**
 * The whole form state from the wizard's active store.
 *
 * Calling the bound store as a hook is safe here because a given subtree is
 * always provided the same instance — the value never changes across renders
 * of the same wizard.
 */
export function useShipmentForm(): ShipmentFormState {
  return useContext(ShipmentFormStoreContext)();
}

/** Same, but subscribing to a single slice. */
export function useShipmentFormSelector<T>(
  selector: (state: ShipmentFormState) => T,
): T {
  return useContext(ShipmentFormStoreContext)(selector);
}

/** The raw store instance, for imperative reads/writes outside render. */
export function useShipmentFormStoreApi(): ShipmentFormStoreApi {
  return useContext(ShipmentFormStoreContext);
}
