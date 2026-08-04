"use client";

import { MapPin } from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { useShipmentAddresses } from "@/hooks/useShipmentAddresses";
import { sanitizeIndianPhone } from "@/lib/utils/phone";
import type { OutletAddress } from "@/store/api/endpoints/outletApi";
import { AddressPicker } from "./address-picker";

interface AddressSectionProps {
  isOutlet: boolean;
  isAdminLike: boolean;
}

export function AddressSection({ isOutlet, isAdminLike }: AddressSectionProps) {
  const store = useShipmentFormStore();

  const { activeAddresses, isLoading, needsOutletFirst } = useShipmentAddresses(
    {
      isOutlet,
      isAdminLike,
      outletId: store.outletId,
    },
  );

  // Delivery is select-only from the address book now. Syncing these legacy
  // fields keeps validation and the confirm/partners payload builders (which
  // still read store.receiverName/phoneNumber/address/etc.) working without
  // a second source of truth.
  function syncDeliveryFields(addr: OutletAddress) {
    store.setField("deliveryAddressId", addr.id);
    store.setField("receiverName", addr.name);
    store.setField("phoneNumber", sanitizeIndianPhone(addr.phone));
    store.setField("email", addr.email || "");
    store.setField(
      "address",
      addr.addressLine2
        ? `${addr.addressLine1}, ${addr.addressLine2}`
        : addr.addressLine1,
    );
    store.setField("landmark", addr.landmark || "");
    store.setField("pincode", addr.pincode);
    store.setField("city", addr.city);
    store.setField("state", addr.state);
    // Billing mirrors delivery by default — keep the id in step if same-as is on.
    if (store.billingSameAsDelivery)
      store.setField("billingAddressId", addr.id);
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Address Details</h2>
        </div>
      </div>

      {/* 1. PICKUP */}
      <AddressPicker
        slot="pickup"
        label="1. Pickup Address"
        required
        allowedTypes={["PICKUP", "GENERAL"]}
        addresses={activeAddresses}
        value={store.pickupAddressId}
        onSelect={(a) => {
          store.setField("pickupAddressId", a.id);
          store.setField("pickupAddress", a.id);
          if (store.rtoSameAsPickup) store.setField("rtoAddressId", a.id);
        }}
        isOutlet={isOutlet}
        outletId={store.outletId}
        disabled={needsOutletFirst}
        disabledHint="Please select an outlet first to load pickup addresses."
        isLoading={isLoading}
        error={store.errors.pickupAddress}
      />

      {/* 2. RTO / RETURN */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-foreground">
            2. RTO / Return Address
          </label>
          <label className="inline-flex items-center cursor-pointer text-xs text-blue-600 hover:text-blue-700 font-medium">
            <input
              type="checkbox"
              checked={store.rtoSameAsPickup}
              onChange={(e) => {
                const checked = e.target.checked;
                store.setField("rtoSameAsPickup", checked);
                // Re-checking mirrors the *current* pickup id again instead
                // of leaving rtoAddressId stale from a previous manual pick.
                store.setField(
                  "rtoAddressId",
                  checked ? store.pickupAddressId : "",
                );
              }}
              className="w-3.5 h-3.5 rounded text-blue-600 border-input focus:ring-primary"
            />
            <span className="ml-1.5">Same as Pickup Address</span>
          </label>
        </div>

        {store.rtoSameAsPickup ? (
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 p-3 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-medium">
              RTO address matches Pickup Address
            </span>
          </div>
        ) : (
          <AddressPicker
            slot="rto"
            label="RTO Address"
            allowedTypes={["RETURN", "PICKUP", "GENERAL"]}
            addresses={activeAddresses}
            value={store.rtoAddressId}
            onSelect={(a) => store.setField("rtoAddressId", a.id)}
            isOutlet={isOutlet}
            outletId={store.outletId}
            disabled={needsOutletFirst}
            disabledHint="Please select an outlet first to load RTO addresses."
            isLoading={isLoading}
            error={store.errors.rtoAddressId}
          />
        )}
      </div>

      {/* 3. DELIVERY */}
      <div className="pt-2 border-t border-border">
        <AddressPicker
          slot="delivery"
          label="3. Delivery Address"
          required
          allowedTypes={["DELIVERY", "GENERAL"]}
          addresses={activeAddresses}
          value={store.deliveryAddressId}
          onSelect={syncDeliveryFields}
          isOutlet={isOutlet}
          outletId={store.outletId}
          disabled={needsOutletFirst}
          disabledHint="Please select an outlet first to load delivery addresses."
          isLoading={isLoading}
          error={store.errors.deliveryAddressId}
        />
      </div>

      {/* 4. BILLING */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-foreground">
            4. Billing Address
          </label>
          <label className="inline-flex items-center cursor-pointer text-xs text-blue-600 hover:text-blue-700 font-medium">
            <input
              type="checkbox"
              checked={store.billingSameAsDelivery}
              onChange={(e) => {
                const checked = e.target.checked;
                store.setField("billingSameAsDelivery", checked);
                store.setField(
                  "billingAddressId",
                  checked ? store.deliveryAddressId : "",
                );
              }}
              className="w-3.5 h-3.5 rounded text-blue-600 border-input focus:ring-primary"
            />
            <span className="ml-1.5">Same as Delivery Address</span>
          </label>
        </div>

        {store.billingSameAsDelivery ? (
          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 p-3 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-medium">
              Billing address matches Delivery Address
            </span>
          </div>
        ) : (
          <AddressPicker
            slot="billing"
            label="Billing Address"
            allowedTypes={["BILLING", "GENERAL"]}
            addresses={activeAddresses}
            value={store.billingAddressId}
            onSelect={(a) => store.setField("billingAddressId", a.id)}
            isOutlet={isOutlet}
            outletId={store.outletId}
            disabled={needsOutletFirst}
            disabledHint="Please select an outlet first to load billing addresses."
            isLoading={isLoading}
            error={store.errors.billingAddressId}
          />
        )}
      </div>
    </div>
  );
}
