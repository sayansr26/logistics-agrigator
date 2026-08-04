"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X, Loader2 } from "lucide-react";
import {
  useCreateMyAddressMutation,
  useCreateOutletAddressMutation,
  useUpdateMyAddressMutation,
  useUpdateOutletAddressMutation,
} from "@/store/api/endpoints/outletApi";
import type {
  AddressType,
  CreateAddressRequest,
  OutletAddress,
} from "@/store/api/endpoints/outletApi";
import { usePincodeAutoFill } from "@/hooks/usePincodeAutoFill";

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  /** Outlet role saves to /me/addresses; admin/client saves under outletId. */
  isOutlet: boolean;
  outletId?: string;
  /** Present -> edit mode; absent -> create mode. */
  initialAddress?: OutletAddress | null;
  /** Preselected type in create mode (e.g. the slot's primary type). */
  defaultType?: AddressType;
  onSaved: (address: OutletAddress) => void;
}

const ADDRESS_TYPES: { value: AddressType; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "PICKUP", label: "Pickup" },
  { value: "RETURN", label: "Return / RTO" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "BILLING", label: "Billing" },
];

function emptyForm(defaultType: AddressType): CreateAddressRequest {
  return {
    label: "",
    addressType: defaultType,
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefaultPickup: false,
    isDefaultReturn: false,
  };
}

function formFromAddress(addr: OutletAddress): CreateAddressRequest {
  return {
    label: addr.label,
    addressType: (addr.addressType as AddressType) || "GENERAL",
    name: addr.name,
    phone: addr.phone,
    email: addr.email || "",
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2 || "",
    landmark: addr.landmark || "",
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    country: addr.country || "India",
    isDefaultPickup: addr.isDefaultPickup,
    isDefaultReturn: addr.isDefaultReturn,
  };
}

const inputClass =
  "w-full text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium text-foreground disabled:opacity-60";
const PHONE_RE = /^\+?[1-9]\d{1,14}$/;
const PINCODE_RE = /^[0-9]{6}$/;

export function AddressModal({
  open,
  onClose,
  isOutlet,
  outletId,
  initialAddress,
  defaultType = "GENERAL",
  onSaved,
}: AddressModalProps) {
  const isEdit = !!initialAddress;
  const [form, setForm] = useState<CreateAddressRequest>(() =>
    initialAddress ? formFromAddress(initialAddress) : emptyForm(defaultType),
  );
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initialAddress ? formFromAddress(initialAddress) : emptyForm(defaultType),
    );
    setTouched(false);
    // Re-seed whenever the modal opens for a (possibly new) target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAddress?.id, defaultType]);

  const [createMyAddress, { isLoading: creatingMy }] =
    useCreateMyAddressMutation();
  const [createOutletAddress, { isLoading: creatingOutlet }] =
    useCreateOutletAddressMutation();
  const [updateMyAddress, { isLoading: updatingMy }] =
    useUpdateMyAddressMutation();
  const [updateOutletAddress, { isLoading: updatingOutlet }] =
    useUpdateOutletAddressMutation();
  const saving = creatingMy || creatingOutlet || updatingMy || updatingOutlet;

  const onPincodeFill = (patch: Partial<{ city: string; state: string }>) => {
    setForm((f) => ({
      ...f,
      city: patch.city !== undefined ? patch.city : f.city,
      state: patch.state !== undefined ? patch.state : f.state,
    }));
  };
  const { isFetching: pinLoading, notFound: pinNotFound } = usePincodeAutoFill({
    pincode: form.pincode,
    current: { city: form.city, state: form.state, area: "" },
    onFill: onPincodeFill,
  });

  if (!open) return null;

  function set<K extends keyof CreateAddressRequest>(
    key: K,
    value: CreateAddressRequest[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const errors: Record<string, string> = {};
  if (touched) {
    if (!form.label.trim()) errors.label = "Label is required";
    if (!form.name.trim()) errors.name = "Contact name is required";
    if (!PHONE_RE.test(form.phone)) errors.phone = "Enter a valid phone number";
    if (!form.addressLine1.trim())
      errors.addressLine1 = "Address line 1 is required";
    if (!PINCODE_RE.test(form.pincode))
      errors.pincode = "Enter a valid 6-digit pincode";
    if (!form.city.trim()) errors.city = "City is required";
    if (!form.state.trim()) errors.state = "State is required";
  }
  const isValid =
    form.label.trim() &&
    form.name.trim() &&
    PHONE_RE.test(form.phone) &&
    form.addressLine1.trim() &&
    PINCODE_RE.test(form.pincode) &&
    form.city.trim() &&
    form.state.trim();

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    try {
      let saved: OutletAddress | undefined;
      if (isEdit && initialAddress) {
        const result = isOutlet
          ? await updateMyAddress({
              addressId: initialAddress.id,
              data: form,
            }).unwrap()
          : await updateOutletAddress({
              outletId: outletId as string,
              addressId: initialAddress.id,
              data: form,
            }).unwrap();
        saved = result?.data?.address;
      } else {
        const result = isOutlet
          ? await createMyAddress(form).unwrap()
          : await createOutletAddress({
              outletId: outletId as string,
              data: form,
            }).unwrap();
        saved = result?.data?.address;
      }
      if (saved) onSaved(saved);
      onClose();
    } catch {
      // RTK error middleware surfaces a toast
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground">
            {isEdit ? "Edit Address" : "Add New Address"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Label / Nickname
              </label>
              <input
                placeholder="e.g. Primary Hub"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                className={`${inputClass} ${errors.label ? "border-red-400" : ""}`}
              />
              {errors.label && (
                <p className="text-[11px] text-red-600 mt-1">{errors.label}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Address Type
              </label>
              <select
                value={form.addressType}
                onChange={(e) =>
                  set("addressType", e.target.value as AddressType)
                }
                className={`${inputClass} cursor-pointer`}
              >
                {ADDRESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Contact Name
              </label>
              <input
                placeholder="Contact person name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`${inputClass} ${errors.name ? "border-red-400" : ""}`}
              />
              {errors.name && (
                <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Phone
              </label>
              <input
                placeholder="Mobile number"
                value={form.phone}
                onChange={(e) =>
                  set(
                    "phone",
                    e.target.value.replace(/[^\d+]/g, "").slice(0, 15),
                  )
                }
                className={`${inputClass} ${errors.phone ? "border-red-400" : ""}`}
              />
              {errors.phone && (
                <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Email{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </label>
            <input
              type="email"
              placeholder="email@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Address Line 1
            </label>
            <input
              placeholder="House/Flat/Plot No., Building Name"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
              className={`${inputClass} ${errors.addressLine1 ? "border-red-400" : ""}`}
            />
            {errors.addressLine1 && (
              <p className="text-[11px] text-red-600 mt-1">
                {errors.addressLine1}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Address Line 2{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </label>
            <input
              placeholder="Street, Sector, Area"
              value={form.addressLine2}
              onChange={(e) => set("addressLine2", e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Landmark{" "}
                <span className="text-muted-foreground font-normal">
                  (Optional)
                </span>
              </label>
              <input
                placeholder="Near landmark"
                value={form.landmark}
                onChange={(e) => set("landmark", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Pincode
              </label>
              <div className="relative">
                <input
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) =>
                    set(
                      "pincode",
                      e.target.value.replace(/\D+/g, "").slice(0, 6),
                    )
                  }
                  className={`${inputClass} ${errors.pincode ? "border-red-400" : ""}`}
                />
                {pinLoading && (
                  <Loader2 className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {errors.pincode ? (
                <p className="text-[11px] text-red-600 mt-1">
                  {errors.pincode}
                </p>
              ) : (
                pinNotFound && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Pincode not found
                  </p>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                City
              </label>
              <input
                placeholder="City name"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={`${inputClass} ${errors.city ? "border-red-400" : ""}`}
              />
              {errors.city && (
                <p className="text-[11px] text-red-600 mt-1">{errors.city}</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                State
              </label>
              <input
                placeholder="State name"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                className={`${inputClass} ${errors.state ? "border-red-400" : ""}`}
              />
              {errors.state && (
                <p className="text-[11px] text-red-600 mt-1">{errors.state}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-foreground">
              <input
                type="checkbox"
                checked={!!form.isDefaultPickup}
                onChange={(e) => set("isDefaultPickup", e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 border-input focus:ring-primary"
              />
              Set as default pickup
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-foreground">
              <input
                type="checkbox"
                checked={!!form.isDefaultReturn}
                onChange={(e) => set("isDefaultReturn", e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 border-input focus:ring-primary"
              />
              Set as default return
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-border hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Address"
                  : "Save Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
