"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  RefreshCcw,
  Store,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useListOutletsQuery,
  useLazyListOutletsQuery,
} from "@/store/api/endpoints/outletApi";
import type { Outlet } from "@/store/api/endpoints/outletApi";

const inputClass =
  "w-full text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium text-foreground";
const selectClass = `${inputClass} cursor-pointer pr-8`;

export function DocketSection({ isAdminLike }: { isAdminLike: boolean }) {
  const store = useShipmentFormStore();
  const isB2B = store.shipmentType === "B2B";

  const {
    data: outletsData,
    isLoading: outletsLoading,
    error: outletsError,
  } = useListOutletsQuery(
    { isActive: true, limit: 100 },
    { skip: !isAdminLike },
  );
  const outlets: Outlet[] = useMemo(
    () => outletsData?.data?.outlets || [],
    [outletsData],
  );

  // Server-side search fallback for installs with >100 outlets — the base
  // query above only returns the first page, so typing a name not in it
  // wouldn't otherwise surface anything.
  const [triggerSearch] = useLazyListOutletsQuery();
  const [searchResults, setSearchResults] = useState<Outlet[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleOutletQueryChange(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await triggerSearch({
          isActive: true,
          limit: 50,
          search: query.trim(),
        }).unwrap();
        setSearchResults(result?.data?.outlets || []);
      } catch {
        // ignore — SearchableSelect just shows "no results"
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  const mergedOutlets = useMemo(() => {
    const byId = new Map<string, Outlet>();
    for (const o of outlets) byId.set(o.id, o);
    for (const o of searchResults) byId.set(o.id, o);
    return Array.from(byId.values());
  }, [outlets, searchResults]);

  const selectedOutlet =
    mergedOutlets.find((o) => o.id === store.outletId) || null;

  // B2C is locked to a single box (and invoice row) — if the shipment type
  // flips from B2B to B2C, trim numberOfBoxes back to 1 (which also trims
  // boxes[]/invoices[] via setNumberOfBoxes).
  useEffect(() => {
    if (!store.hasHydrated) return;
    if (!isB2B && store.numberOfBoxes !== 1) {
      store.setNumberOfBoxes(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isB2B, store.hasHydrated]);

  function handleOutletSelect(outlet: Outlet) {
    store.setField("outletId", outlet.id);
    store.setField("outletUserId", outlet.phone || "");
    // Cascade: a different outlet has a different address book, so every
    // previously-picked address (and the same-as flags that depend on them)
    // must be cleared rather than silently pointing at the old outlet's ids.
    store.setField("pickupAddress", "");
    store.setField("pickupAddressId", "");
    store.setField("rtoSameAsPickup", true);
    store.setField("rtoAddressId", "");
    store.setField("deliveryAddressId", "");
    store.setField("billingSameAsDelivery", true);
    store.setField("billingAddressId", "");
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">
            Docket Information
          </h2>
        </div>
      </div>

      {/* Reference Number */}
      <div className="bg-muted/40 p-3.5 rounded-xl border border-border space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-foreground">
            Reference Number
          </label>
        </div>
        <div className="relative">
          <input
            value={store.referenceNo}
            readOnly
            className={`${inputClass} pr-10 bg-muted font-mono`}
          />
          <button
            type="button"
            onClick={() => store.regenerateReferenceNo()}
            title="Regenerate reference number"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        {store.errors.referenceNo && (
          <p className="text-[11px] text-red-600">{store.errors.referenceNo}</p>
        )}
      </div>

      {/* Weight + Shipment type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            Actual Weight
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              placeholder="0.00"
              value={store.actualWeight}
              onChange={(e) => store.setField("actualWeight", e.target.value)}
              className={`${inputClass} pr-10 ${store.errors.actualWeight ? "border-red-400" : ""}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
              Kg
            </span>
          </div>
          {store.errors.actualWeight && (
            <p className="text-[11px] text-red-600">
              {store.errors.actualWeight}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            Shipment Type
          </label>
          <select
            value={store.shipmentType}
            onChange={(e) => store.setField("shipmentType", e.target.value)}
            className={selectClass}
          >
            <option value="B2C">B2C (Business to Consumer)</option>
            <option value="B2B">B2B (Business to Business)</option>
          </select>
        </div>
      </div>

      {/* Direction + Service type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            Shipment Direction
          </label>
          <select
            value={store.shipmentDirection}
            onChange={(e) =>
              store.setField("shipmentDirection", e.target.value)
            }
            className={selectClass}
          >
            <option value="FORWARD">Forward</option>
            <option value="REVERSE">Reverse</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            Service Type
          </label>
          <select
            value={store.serviceType}
            onChange={(e) => store.setField("serviceType", e.target.value)}
            className={selectClass}
          >
            <option value="ALL">Select All</option>
            <option value="STANDARD">Standard Delivery</option>
            <option value="EXPRESS">Express Delivery</option>
            <option value="ECONOMY">Economy Cargo</option>
          </select>
        </div>
      </div>

      {/* Number of boxes */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-foreground">
          Number of boxes
        </label>
        <input
          type="number"
          min={1}
          max={100}
          disabled={!isB2B}
          value={store.numberOfBoxes}
          onChange={(e) =>
            store.setNumberOfBoxes(parseInt(e.target.value, 10) || 1)
          }
          className={`${inputClass} ${!isB2B ? "bg-muted disabled:opacity-70" : ""}`}
        />
        {!isB2B && (
          <p className="text-[11px] text-muted-foreground">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            B2C shipments are locked to a single box.
          </p>
        )}
      </div>

      {/* Outlet select (admin/superadmin only) */}
      {isAdminLike && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-foreground">
            Select Outlet
          </label>
          {outletsLoading ? (
            <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              outlets...
            </div>
          ) : outletsError ? (
            <div className="flex items-center gap-2 p-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" /> Failed to load outlets.
            </div>
          ) : mergedOutlets.length === 0 && !store.outletId ? (
            <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground border border-border rounded-lg">
              <AlertCircle className="h-3.5 w-3.5" /> No active outlets found.
            </div>
          ) : (
            <SearchableSelect<Outlet>
              options={mergedOutlets}
              value={selectedOutlet}
              onSelect={handleOutletSelect}
              onQueryChange={handleOutletQueryChange}
              loading={searching}
              getOptionText={(o) => `${o.name} ${o.email} ${o.phone}`}
              getDisplayText={(o) => `${o.name} (${o.email})`}
              placeholder="Search or select outlet..."
              icon={<Store className="h-3.5 w-3.5" />}
              noResults="No outlets match your search"
              renderOption={(o) => (
                <div>
                  <div className="font-semibold text-foreground">{o.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {o.email}
                  </div>
                </div>
              )}
            />
          )}
          {store.errors.outletId && (
            <p className="text-[11px] text-red-600">{store.errors.outletId}</p>
          )}
        </div>
      )}
    </div>
  );
}
