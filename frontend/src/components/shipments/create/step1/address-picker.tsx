"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, User, Phone, AlertCircle, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type {
  AddressType,
  OutletAddress,
} from "@/store/api/endpoints/outletApi";
import { AddressModal } from "./address-modal";

export type AddressSlot = "pickup" | "rto" | "delivery" | "billing";

const SLOT_ICON: Record<AddressSlot, string> = {
  pickup: "🏭",
  rto: "↩️",
  delivery: "📦",
  billing: "🧾",
};

interface AddressPickerProps {
  slot: AddressSlot;
  label: string;
  required?: boolean;
  allowedTypes: AddressType[];
  /** Full active address list (all types) — the picker filters by allowedTypes itself. */
  addresses: OutletAddress[];
  value: string;
  onSelect: (address: OutletAddress) => void;
  isOutlet: boolean;
  outletId?: string;
  disabled?: boolean;
  disabledHint?: string;
  isLoading?: boolean;
  error?: string;
}

export function AddressPicker({
  slot,
  label,
  required,
  allowedTypes,
  addresses,
  value,
  onSelect,
  isOutlet,
  outletId,
  disabled,
  disabledHint,
  isLoading,
  error,
}: AddressPickerProps) {
  const [modalMode, setModalMode] = useState<"none" | "create" | "edit">(
    "none",
  );

  const options = useMemo(
    () =>
      addresses.filter((a) =>
        allowedTypes.includes(a.addressType as AddressType),
      ),
    [addresses, allowedTypes],
  );
  const selected = addresses.find((a) => a.id === value) || null;

  function getOptionText(a: OutletAddress) {
    return [a.label, a.name, a.city, a.pincode].filter(Boolean).join(" ");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-foreground">
          {label}
          {required ? "*" : ""}
        </label>
        <button
          type="button"
          onClick={() => setModalMode("create")}
          disabled={disabled}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-2.5 w-2.5" /> Add New Address
        </button>
      </div>

      {disabled ? (
        <div className="flex items-center gap-2 p-3 text-xs text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {disabledHint || "Please select an outlet first."}
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading addresses...
        </div>
      ) : (
        <SearchableSelect<OutletAddress>
          options={options}
          value={selected}
          onSelect={(a) => onSelect(a)}
          getOptionText={getOptionText}
          getDisplayText={(a) =>
            `${a.label || a.name} - ${a.city}, ${a.pincode}`
          }
          placeholder={`Search or select ${label.replace(/^\d+\.\s*/, "").toLowerCase()}...`}
          icon={<span className="text-xs leading-none">{SLOT_ICON[slot]}</span>}
          noResults={
            <span>
              No {label.replace(/^\d+\.\s*/, "").toLowerCase()} found. Use
              &quot;Add New Address&quot; above.
            </span>
          }
          renderOption={(a) => (
            <div>
              <div className="font-semibold text-foreground">
                {a.label || a.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {a.city}, {a.state} - {a.pincode}
              </div>
            </div>
          )}
        />
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {selected && (
        <AddressSummaryCard
          addr={selected}
          onEdit={() => setModalMode("edit")}
        />
      )}

      <AddressModal
        open={modalMode !== "none"}
        onClose={() => setModalMode("none")}
        isOutlet={isOutlet}
        outletId={outletId}
        initialAddress={modalMode === "edit" ? selected : null}
        defaultType={allowedTypes[0]}
        onSaved={(addr) => onSelect(addr)}
      />
    </div>
  );
}

function typeBadgeClass(type: string) {
  switch (type) {
    case "PICKUP":
      return "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
    case "RETURN":
      return "text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800";
    case "DELIVERY":
      return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    case "BILLING":
      return "text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800";
    default:
      return "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
  }
}

function AddressSummaryCard({
  addr,
  onEdit,
}: {
  addr: OutletAddress;
  onEdit: () => void;
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 border border-border text-xs space-y-1 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${typeBadgeClass(addr.addressType)}`}
          >
            {addr.addressType}
          </span>
          {addr.isDefaultPickup && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground">
              Default Pickup
            </span>
          )}
          {addr.isDefaultReturn && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground">
              Default Return
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-muted-foreground hover:text-blue-600 p-1 transition-colors flex-shrink-0"
          title="Edit Address"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <p className="text-foreground leading-relaxed font-normal pt-1">
        {addr.addressLine1}
        {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
        {addr.landmark ? `, Near ${addr.landmark}` : ""}, {addr.city},{" "}
        {addr.state} {addr.pincode}
      </p>
      <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" /> {addr.name}
        </span>
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3" /> {addr.phone}
        </span>
      </div>
    </div>
  );
}
